import { sanityClientServer } from '@/lib/sanity';
import { NextResponse } from 'next/server';

export async function POST(request) {
    try {
        const body = await request.json();
        const { fingerprint, nombre, categorias, tenantId } = body;
        
        if (!tenantId) {
            return NextResponse.json({ success: false, error: "Tenant ID requerido" }, { status: 400 });
        }

        // Generamos el ID único determinista para evitar duplicación de estaciones
        const idLimpio = `estacion-${tenantId.toLowerCase().replace(/[^a-z0-9_-]/g, '')}-${fingerprint.toLowerCase().replace(/[^a-z0-9_-]/g, '-')}`;

        // Escritura maestra en Sanity
        const result = await sanityClientServer.createOrReplace({
            _id: idLimpio,
            _type: 'estacionPC',
            tenant: tenantId,
            nombre: nombre || 'Caja Principal',
            pcFingerprint: fingerprint,
            categoriasVinculadas: Array.isArray(categorias) && categorias.length > 0 ? categorias : []
        });

        // 🪓 GUILLOTINA SÍNCRONA: Si cambia el ruteo de impresión, el búnker del POS debe caer inmediatamente
        try {
            const { supabaseServer } = await import('@/lib/supabase');
            await supabaseServer
                .from('catalog_cache')
                .delete()
                .eq('tenant_host', tenantId.toLowerCase().trim());
            console.log(`🗑️ Caché del catálogo purgado síncronamente en mutación de estaciones para: ${tenantId}`);
        } catch (cacheError) {
            console.warn("⚠️ Falla no-bloqueante al purgar búnker desde API estaciones:", cacheError.message);
        }

        return NextResponse.json({ success: true, result });
    } catch (error) {
        console.error("🔥 Error API Estaciones:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}