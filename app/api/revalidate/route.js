import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase'; // 🛡️ CIRUGÍA 1: Importación oficial corregida
import { isValidSignature, SIGNATURE_HEADER_NAME } from '@sanity/webhook';

// 🔑 Secreto del Webhook compartido entre Sanity y tu API (Defínelo en tus variables de entorno)
const SANITY_WEBHOOK_SECRET = process.env.SANITY_WEBHOOK_SECRET;

export async function POST(request) {
    try {
        // 🛡️ REFUERZO DE SEGURIDAD ABSOLUTA: Validar firma del Webhook
        if (SANITY_WEBHOOK_SECRET) {
            const bodyRaw = await request.text(); // Leemos el cuerpo crudo necesario para validar la firma
            const signature = request.headers.get(SIGNATURE_HEADER_NAME);

            if (!signature || !isValidSignature(bodyRaw, signature, SANITY_WEBHOOK_SECRET)) {
                console.warn("⚠️ Intento de revalidación rechazado: Firma inválida o inexistente.");
                return NextResponse.json({ error: "No autorizado" }, { status: 401 });
            }

            // Si la firma es válida, parseamos el JSON para extraer los datos
            var body = JSON.parse(bodyRaw);
        } else {
            // Fallback de desarrollo si no has configurado el secreto aún
            var body = await request.json();
        }

        /**
         * 🎯 CAPTURA DINÁMICA DEL TENANT
         * Sanity te enviará el documento mutado. Si tu webhook envía el documento completo,
         * el alias vendrá en 'body.tenant'. Si configuraste una proyección personalizada,
         * puede venir en 'body.tenantAlias'. Atrapamos ambas para máxima resiliencia.
         */
        const tenantAlias = body?.tenant || body?.tenantAlias;

        if (!tenantAlias) {
            console.warn("⚠️ Webhook recibido pero no se encontró un identificador de Tenant en el payload:", body);
            return NextResponse.json({ message: "Falta el identificador del negocio en el cuerpo" }, { status: 400 });
        }

        // Sanitizamos a minúsculas para mantener consistencia con el catálogo
        const cleanAlias = tenantAlias.toString().toLowerCase().trim();

        // 🪓 GUILLOTINA SELECTIVA MULTI-TENANT: CIRUGÍA 2 -> Usamos supabaseServer
        const { error } = await supabaseServer
            .from('catalog_cache')
            .delete()
            .eq('tenant_host', cleanAlias);

        if (error) {
            console.error(`❌ Error al borrar fila en Supabase para [${cleanAlias}]:`, error);
            throw error;
        }
        
        console.log(`🗑️ [ESCUDO INFALIBLE] Caché destruido en Supabase para el restaurante: ${cleanAlias}`);
        return NextResponse.json({ revalidated: true, tenant: cleanAlias, now: Date.now() });

    } catch (error) {
        console.error("🔥 Error crítico en el receptor del Webhook de revalidación:", error);
        return NextResponse.json({ error: "Error interno al procesar la revalidación" }, { status: 500 });
    }
}