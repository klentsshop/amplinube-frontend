import { NextResponse } from 'next/server';
import { createClient } from '@sanity/client';
import { supabaseServer } from '@/lib/supabase'; // 🛡️ CIRUGÍA 1: Importación oficial corregida
import imageUrlBuilder from '@sanity/image-url'; // 🚀 SENIOR: Constructor de imágenes oficial

// 🔌 Inicialización limpia de Sanity con control de versionamiento
const sanityClient = createClient({
    projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID,
    dataset: process.env.NEXT_PUBLIC_SANITY_DATASET,
    useCdn: false, // 🛡️ Garantiza consistencia absoluta en el Cache Miss
    apiVersion: '2026-03-01',
    token: process.env.SANITY_API_TOKEN
});

// 🚀 SENIOR: Inicializamos el constructor de imágenes en el backend
const builder = imageUrlBuilder(sanityClient);

/**
 * 🛰️ EXTRACTOR DE TENANT LIMPIO (Espejo del comportamiento de lib/config.js)
 */
const extractTenantAlias = (hostHeader) => {
    if (!hostHeader) return process.env.NEXT_PUBLIC_TENANT_ID || "demo";

    // Separamos el host del puerto (ej: localhost:3000 -> localhost)
    const hostname = hostHeader.split(':')[0].toLowerCase().trim();

    // 1. Aislamiento para entorno de desarrollo local
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return (process.env.NEXT_PUBLIC_TENANT_ID || "demo").toLowerCase().trim();
    }

    // 2. Blindaje para URLs técnicas de Netlify (ej: rama--proyecto.netlify.app)
    if (hostname.includes('--')) {
        const parts = hostname.split('--');
        return parts[0].toLowerCase().trim();
    }

    // 3. Extracción estricta del subdominio en producción (ej: talanquera.sociopos.com)
    const parts = hostname.split('.');
    if (parts.length >= 3) {
        const subdomain = parts[0];
        // Evitamos falsos positivos con subdominios técnicos globales
        if (subdomain !== 'www' && subdomain !== 'app' && subdomain !== 'api') {
            return subdomain.toLowerCase().trim();
        }
    }

    return (process.env.NEXT_PUBLIC_TENANT_ID || "demo").toLowerCase().trim();
};

export async function GET(request) {
    try {
        // 🎯 Capturamos el Host Header e inmediatamente lo sanitizamos al Alias oficial
        const hostHeader = request.headers.get('host') || '';
        const tenantAlias = extractTenantAlias(hostHeader);

        console.log(`🛡️ Escudo procesando petición para el Tenant: [${tenantAlias}]`);

        // 🛡️ BÚNKER PERSISTENTE: CIRUGÍA 2 -> Usamos supabaseServer
        const { data: cacheExistente, error: errCache } = await supabaseServer
            .from('catalog_cache')
            .select('payload_json')
            .eq('tenant_host', tenantAlias)
            .maybeSingle(); // 💡 Senior Tip: maybeSingle() evita lanzar excepciones ruidosas si no existe el registro

        // 💸 IMPACTO CERO ($0): Si el registro en piedra existe, se sirve de inmediato.
        if (cacheExistente && !errCache) {
            return NextResponse.json(cacheExistente.payload_json, {
                headers: { 'X-Cache-Status': 'HIT' }
            });
        }

        // 📡 CACHE MISS: Una sola consulta masiva y estructurada a Sanity
        const dataFresh = await sanityClient.fetch(
    `*[
        (_type in ["plato", "categoria", "inventario", "estacionPC", "mesero", "seguridad"] && tenant == $tenantAlias) ||
        (_type == "negocio" && slug.current == $tenantAlias)
    ]`, 
    { tenantAlias }
        );

        // 🛡️ BLINDAJE ANTI-CAMPOS BLANCOS / ARREGLOS VACÍOS
        // Si Sanity viene vacío, nulo o no es un arreglo válido, aplicamos paracaídas inmediato
        if (!dataFresh || !Array.isArray(dataFresh) || dataFresh.length === 0) {
            console.warn(`⚠️ Sanity mmolvió un catálogo vacío para [${tenantAlias}]. Bloqueando persistencia para evitar sobreescritura fantasma.`);
            
            // Intentamos recuperar lo último que hubiera en Supabase aunque errCache haya dicho algo antes,
            // o simplemente servimos lo que haya sin romper el POS del cliente.
            if (cacheExistente && cacheExistente.payload_json) {
                return NextResponse.json(cacheExistente.payload_json, {
                    headers: { 'X-Cache-Status': 'HIT-PARACHUTE' }
                });
            }
            
            // Si de verdad no hay nada en ningún lado, respondemos vacío pero NO lo guardamos en Supabase
            return NextResponse.json([], { headers: { 'X-Cache-Status': 'MISS-EMPTY' } });
        }

        // 🚀 SENIOR: Aplanamos y resolvemos las imágenes en el servidor de forma ultra segura antes de guardar
        const dataProcesada = dataFresh.map(item => {
            if (item._type === 'plato' && item.imagen?.asset?._ref) {
                try {
                    return {
                        ...item,
                        imagenUrl: builder.image(item.imagen).url() // Inyectamos el string de la URL limpia
                    };
                } catch (imgError) {
                    console.error(`⚠️ No se pudo procesar la imagen del plato: ${item.nombre}`, imgError);
                }
            }
            return item;
        });

        // 💾 ALMACENAMIENTO EN PIEDRA SEGURIZADO: Guardamos el payload ya procesado con las URLs listas
        const { error: upsertError } = await supabaseServer
            .from('catalog_cache')
            .upsert({ 
                tenant_host: tenantAlias, 
                payload_json: dataProcesada, // Guardamos la data limpia procesada
                updated_at: new Date().toISOString()
            }, { onConflict: 'tenant_host' });

        if (upsertError) {
            console.error("⚠️ Falla no-bloqueante al writear el caché en Supabase:", upsertError);
        }

        return NextResponse.json(dataProcesada, {
            headers: { 'X-Cache-Status': 'MISS' }
        });

    } catch (error) {
        console.error("🔥 Error crítico estructural en el escudo de catálogo:", error);
        return NextResponse.json(
            { error: "Error interno del servidor de datos" }, 
            { status: 500 }
        );
    }
}