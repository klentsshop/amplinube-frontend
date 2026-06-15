import { NextResponse } from 'next/server';
import { sanityClientServer } from '@/lib/sanity';

// ➕ 1. CREAR VENDEDOR
export async function POST(request) {
    try {
        const body = await request.json();
        const { nombre, activo, tenantId } = body;

        if (!tenantId) {
            return NextResponse.json({ error: 'Identificador de negocio ausente.' }, { status: 400 });
        }

        const nuevoMeseroDoc = {
            _type: 'mesero',
            nombre: nombre.trim().toUpperCase(), // Lo guardamos limpio y en mayúsculas
            tenant: tenantId,
            activo: activo !== false
        };

        const result = await sanityClientServer.create(nuevoMeseroDoc);

        // 🪓 GUILLOTINA SÍNCRONA: Purgamos la caché para que el nuevo mesero aparezca en el select del POS
        try {
            const { supabaseServer } = await import('@/lib/supabase');
            await supabaseServer
                .from('catalog_cache')
                .delete()
                .eq('tenant_host', tenantId.toLowerCase().trim());
            console.log(`🗑️ Caché invalidado síncronamente tras crear mesero para: ${tenantId}`);
        } catch (cacheError) {
            console.warn("⚠️ Falla no-bloqueante al purgar el catálogo desde POST meseros:", cacheError.message);
        }

        return NextResponse.json({ ok: true, item: result });
    } catch (error) {
        console.error('🔥 [API_POST_MESEROS_ERROR]:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// 🔄 2. ACTUALIZAR VENDEDOR
export async function PUT(request) {
    try {
        const body = await request.json();
        const { itemId, nombre, activo, tenantId } = body;

        if (!tenantId || !itemId) {
            return NextResponse.json({ error: 'Faltan parámetros críticos (tenantId o itemId).' }, { status: 400 });
        }

        const camposAActualizar = {};
        if (nombre !== undefined) camposAActualizar.nombre = nombre.trim().toUpperCase();
        if (activo !== undefined) camposAActualizar.activo = Boolean(activo);

        const result = await sanityClientServer
            .patch(itemId)
            .set(camposAActualizar)
            .commit();

        // 🪓 GUILLOTINA SÍNCRONA: Si se suspende o edita al mesero, la terminal debe enterarse al instante
        try {
            const { supabaseServer } = await import('@/lib/supabase');
            await supabaseServer
                .from('catalog_cache')
                .delete()
                .eq('tenant_host', tenantId.toLowerCase().trim());
            console.log(`🗑️ Caché invalidado síncronamente tras actualizar mesero para: ${tenantId}`);
        } catch (cacheError) {
            console.warn("⚠️ Falla no-bloqueante al purgar el catálogo desde PUT meseros:", cacheError.message);
        }

        return NextResponse.json({ ok: true, id: result._id });
    } catch (error) {
        console.error('🔥 [API_PUT_MESEROS_ERROR]:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// 🗑️ 3. ELIMINAR VENDEDOR
export async function DELETE(request) {
    try {
        const body = await request.json();
        const { itemId, tenantId } = body;

        if (!tenantId || !itemId) {
            return NextResponse.json({ error: 'Faltan credenciales o el ID para borrar.' }, { status: 400 });
        }

          await sanityClientServer.delete(itemId);

        // 🪓 GUILLOTINA SÍNCRONA: Sacamos de circulación al mesero eliminado eliminando la caché
        try {
            const { supabaseServer } = await import('@/lib/supabase');
            await supabaseServer
                .from('catalog_cache')
                .delete()
                .eq('tenant_host', tenantId.toLowerCase().trim());
            console.log(`🗑️ Caché invalidado síncronamente tras eliminar mesero para: ${tenantId}`);
        } catch (cacheError) {
            console.warn("⚠️ Falla no-bloqueante al purgar el catálogo desde DELETE meseros:", cacheError.message);
        }

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error('🔥 [API_DELETE_MESEROS_ERROR]:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}