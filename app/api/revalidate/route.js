import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { isValidSignature, SIGNATURE_HEADER_NAME } from '@sanity/webhook';
import { createClient } from '@sanity/client';
import imageUrlBuilder from '@sanity/image-url';

const SANITY_WEBHOOK_SECRET = process.env.SANITY_WEBHOOK_SECRET;

// Inicialización de Sanity para resolver imágenes si es necesario
const sanityClient = createClient({
    projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID,
    dataset: process.env.NEXT_PUBLIC_SANITY_DATASET,
    useCdn: false,
    apiVersion: '2026-03-01',
    token: process.env.SANITY_API_TOKEN
});

export async function POST(request) {
    try {
        let body;
        
        // 1. 🛡️ AUTENTICACIÓN: Validar firma del Webhook
        if (SANITY_WEBHOOK_SECRET) {
            const bodyRaw = await request.text();
            const signature = request.headers.get(SIGNATURE_HEADER_NAME);

            if (!signature || !isValidSignature(bodyRaw, signature, SANITY_WEBHOOK_SECRET)) {
                console.warn("⚠️ Webhook rechazado: Firma inválida.");
                return NextResponse.json({ error: "No autorizado" }, { status: 401 });
            }
            body = JSON.parse(bodyRaw);
        } else {
            body = await request.json();
        }

        // 2. 🎯 EXTRACCIÓN DEL TENANT Y DEL DOCUMENTO MUTADO
        const tenantAlias = body?.tenant || body?.tenantAlias;
        const documentoMutado = body; // El body contiene el documento de Sanity que cambió

        if (!tenantAlias || !documentoMutado?._id || !documentoMutado?._type) {
            console.warn("⚠️ Webhook ignorado: Faltan datos estructurales (tenant, _id o _type).");
            return NextResponse.json({ message: "Payload incompleto" }, { status: 400 });
        }

        const cleanAlias = tenantAlias.toString().toLowerCase().trim();
        console.log(`📡 [WEBHOOK SÉNIOR] Mutación detectada para [${cleanAlias}] en tipo: [${documentoMutado._type}]`);

        // 3. 🛰️ LECTURA DEL BÚNKER: Traemos el caché actual de Supabase
        const { data: cacheExistente, error: errFetch } = await supabaseServer
            .from('catalog_cache')
            .select('payload_json')
            .eq('tenant_host', cleanAlias)
            .maybeSingle();

        if (errFetch) {
            console.error("❌ Error recuperando caché en Webhook:", errFetch);
            throw errFetch;
        }

        let nuevoPayload = [];

        if (cacheExistente?.payload_json && Array.isArray(cacheExistente.payload_json)) {
            // 🔄 EL BÚNKER EXISTE: Mapeamos y parchamos quirúrgicamente
            let itemEncontrado = false;
            let arrayCopiado = [...cacheExistente.payload_json];

            // Si es un plato con imagen, le pre-procesamos la URL limpia antes de meterlo al array
            let itemProcesado = { ...documentoMutado };
            // 🚀 CIRUGÍA SÉNIOR: Extractor estático nativo anti-undefined
            if (itemProcesado._type === 'plato' && itemProcesado.imagen?.asset?._ref) {
                try {
                    const ref = itemProcesado.imagen.asset._ref; // Formato: image-assetId-dimension-ext
                    const parts = ref.split('-');
                    if (parts.length >= 4) {
                        const id = parts[1];
                        const dimensions = parts[2];
                        const ext = parts[3];
                        itemProcesado.imagenUrl = `https://cdn.sanity.io/images/${process.env.NEXT_PUBLIC_SANITY_PROJECT_ID}/${process.env.NEXT_PUBLIC_SANITY_DATASET}/${id}-${dimensions}.${ext}`;
                    }
                } catch (imgError) {
                    console.error("⚠️ Error extractor estático en Webhook para:", itemProcesado.nombre);
                }
            }

            // Buscamos si el ítem ya existía en el array para sobreescribirlo
            nuevoPayload = arrayCopiado.map(item => {
                if (item._id === itemProcesado._id) {
                    itemEncontrado = true;
                    return itemProcesado;
                }
                return item;
            });

            // Si el documento es nuevo y no estaba en el array, lo inyectamos al final
            if (!itemEncontrado) {
                nuevoPayload.push(itemProcesado);
            }
        } else {
            // 🚨 EL BÚNKER NO EXISTÍA: Si por alguna razón la fila está vacía, no arriesgamos data parcial.
            // Dejamos que el POS lo regenere limpio desde Sanity en su próximo GET consultando la API de catálogo.
            console.log(`⚠️ El búnker estaba vacío en Supabase para [${cleanAlias}]. Saltando parcheo para forzar inicialización limpia.`);
            return NextResponse.json({ revalidated: false, message: "Caché vacío, requiere GET inicial" });
        }

        // 4. 💾 PERSISTENCIA EN PIEDRA INTELIGENTE: Guardamos el catálogo parchado
        const { error: upsertError } = await supabaseServer
            .from('catalog_cache')
            .upsert({
                tenant_host: cleanAlias,
                payload_json: nuevoPayload,
                updated_at: new Date().toISOString()
            }, { onConflict: 'tenant_host' });

        if (upsertError) {
            console.error(`❌ Error al actualizar mutación en Supabase para [${cleanAlias}]:`, upsertError);
            throw upsertError;
        }

        console.log(`💎 [ESCUDO INFALIBLE] Búnker actualizado quirúrgicamente para: ${cleanAlias} (ID: ${documentoMutado._id})`);
        return NextResponse.json({ revalidated: true, mutatedId: documentoMutado._id });

    } catch (error) {
        console.error("🔥 Error crítico en el Webhook de revalidación quirúrgica:", error);
        return NextResponse.json({ error: "Error interno al mutar la caché" }, { status: 500 });
    }
}