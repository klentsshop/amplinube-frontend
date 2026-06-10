import { NextResponse } from 'next/server';
import { createClient } from '@sanity/client';
import { supabase } from '@/lib/supabase'; // 🔌 Ajusta la ruta a tu cliente de Supabase actual

const sanityClient = createClient({
    projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID,
    dataset: process.env.NEXT_PUBLIC_SANITY_DATASET,
    useCdn: false,
    apiVersion: '2026-03-01',
    token: process.env.SANITY_API_TOKEN
});

export async function GET(request) {
    try {
        const host = request.headers.get('host') || 'default';

        // 🛡️ BÚNKER SUPABASE: Intentamos leer el caché persistente en disco duro indexado
        const { data: cacheExistente, error: errCache } = await supabase
            .from('catalog_cache')
            .select('payload_json')
            .eq('tenant_host', host)
            .single();

        // Si existe el caché en Supabase, se lo escupimos al mesero en 15ms. Costo Sanity = $0
        if (cacheExistente && !errCache) {
            return NextResponse.json(cacheExistente.payload_json);
        }

        // 📡 Si no hay caché en Supabase, hacemos el ÚNICO viaje necesario del día a Sanity
        const dataFresh = await sanityClient.fetch(
            `*[_type == "producto" && tenantAlias == $host]`, 
            { host }
        );

        // 💾 Guardamos o actualizamos la copia en piedra dentro de Supabase (Upsert)
        await supabase
            .from('catalog_cache')
            .upsert({ 
                tenant_host: host, 
                payload_json: dataFresh,
                updated_at: new Date().toISOString()
            });

        return NextResponse.json(dataFresh);

    } catch (error) {
        console.error("🔥 Error en el escudo de catálogo con Supabase:", error);
        return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
    }
}