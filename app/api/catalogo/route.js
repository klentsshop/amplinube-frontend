import { NextResponse } from 'next/server';
import { createClient } from '@sanity/client';
import { supabase } from '@/lib/supabase'; // 🔌 Verifica que esta ruta apunte a tu instancia actual de Supabase

// 🔌 Inicialización limpia de Sanity
const sanityClient = createClient({
    projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID,
    dataset: process.env.NEXT_PUBLIC_SANITY_DATASET,
    useCdn: false, 
    apiVersion: '2026-03-01',
    token: process.env.SANITY_API_TOKEN
});

export async function GET(request) {
    try {
        // 🎯 Capturamos el subdominio/alias exacto (Ej: asaderolatalanquera.sociopos.com)
        const host = request.headers.get('host') || 'default';

        // 🛡️ BÚNKER PERSISTENTE: Consultamos la tabla caché en Supabase en lugar de la RAM efímera
        const { data: cacheExistente, error: errCache } = await supabase
            .from('catalog_cache')
            .select('payload_json')
            .eq('tenant_host', host)
            .single();

        // 💸 IMPACTO CERO: Si el registro en piedra existe, responde de inmediato. Sanity ni se entera.
        if (cacheExistente && !errCache) {
            return NextResponse.json(cacheExistente.payload_json);
        }

        // 📡 CONTROL DE FLUJO MULTI-TABLA: Captura platos, categorías, inventarios, estaciones, meseros y seguridad
        // Filtra estrictamente que pertenezcan al 'tenant' que hace la consulta
        const dataFresh = await sanityClient.fetch(
            `*[(_type in ["plato", "categoria", "inventario", "estacionPC", "mesero", "seguridad"]) && tenant == $host]`, 
            { host }
        );

        // 💾 ALMACENAMIENTO SEGURO: Registramos o actualizamos la copia JSON en tu tabla de Supabase
        await supabase
            .from('catalog_cache')
            .upsert({ 
                tenant_host: host, 
                payload_json: dataFresh,
                updated_at: new Date().toISOString()
            });

        return NextResponse.json(dataFresh);

    } catch (error) {
        console.error("🔥 Error crítico en el escudo de catálogo con Supabase:", error);
        return NextResponse.json({ error: "Error interno del servidor de datos" }, { status: 500 });
    }
}