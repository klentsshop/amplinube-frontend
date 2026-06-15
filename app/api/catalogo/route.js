import { NextResponse } from 'next/server';
import { createClient } from '@sanity/client';
import { supabaseServer } from '@/lib/supabase'; // 🛡️ CIRUGÍA 1: Importación oficial corregida

// 🔌 Inicialización limpia de Sanity con control de versionamiento
const sanityClient = createClient({
    projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID,
    dataset: process.env.NEXT_PUBLIC_SANITY_DATASET,
    useCdn: false, // 🛡️ Garantiza consistencia absoluta en el Cache Miss
    apiVersion: '2026-03-01',
    token: process.env.SANITY_API_TOKEN
});

/**
 * 🛰️ EXTRACTOR DE TENANT LIMPIO (Espejo del comportamiento de lib/config.js)
 */
const extractTenantAlias = (hostHeader) => {
    if (!hostHeader) return process.env.NEXT_PUBLIC_TENANT_ID || "demo";

    // Separamos el host del puerto por si estamos en desarrollo (ej: localhost:3000 -> localhost)
    const hostname = hostHeader.split(':')[0].toLowerCase();

    // 1. Aislamiento para entorno de desarrollo local
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return process.env.NEXT_PUBLIC_TENANT_ID || "demo";
    }

    // 2. Extracción estricta del subdominio en producción (Netlify / Vercel / Custom Domain)
    const parts = hostname.split('.');
    if (parts.length >= 3) {
        const subdomain = parts[0];
        // Evitamos falsos positivos con subdominios técnicos globales
        if (subdomain !== 'www' && subdomain !== 'app' && subdomain !== 'api') {
            return subdomain;
        }
    }

    return process.env.NEXT_PUBLIC_TENANT_ID || "demo";
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

        // 📡 CACHE MISS: Una sola consulta masiva y estructurada a Sanity usando el Alias homologado
        const dataFresh = await sanityClient.fetch(
            `*[(_type in ["plato", "categoria", "inventario", "estacionPC", "mesero", "seguridad"]) && tenant == $tenantAlias]`, 
            { tenantAlias }
        );

        // 💾 ALMACENAMIENTO EN PIEDRA: CIRUGÍA 3 -> Usamos supabaseServer para el UPSERT
        const { error: upsertError } = await supabaseServer
            .from('catalog_cache')
            .upsert({ 
                tenant_host: tenantAlias, 
                payload_json: dataFresh,
                updated_at: new Date().toISOString()
            }, { onConflict: 'tenant_host' });

        if (upsertError) {
            console.error("⚠️ Falla no-bloqueante al writear el caché en Supabase:", upsertError);
        }

        return NextResponse.json(dataFresh, {
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