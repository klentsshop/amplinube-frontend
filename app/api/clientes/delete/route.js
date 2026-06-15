import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase'; // 🛡️ Conexión oficial a Supabase
import { sanityClientServer } from '@/lib/sanity';   // 🛡️ Mantenemos Sanity solo para el escudo de mesas vivas

export async function POST(request) {
    try {
        const body = await request.json();
        const { id, tenant } = body; // 'id' es el UUID de Supabase, 'tenant' es el código del comercio

        if (!id || !tenant) {
            return NextResponse.json(
                { error: 'ID o Tenant faltante' },
                { status: 400 }
            );
        }

        // 1. 🛡️ VERIFICACIÓN EN SUPABASE: Validar que el cliente exista y pertenezca al negocio
        const { data: cliente, error: errorCliente } = await supabaseServer
            .from('clientes')
            .select('id')
            .eq('id', id)
            .eq('tenant_id', tenant)
            .maybeSingle(); // Evita lanzar excepciones si no encuentra nada

        if (errorCliente) {
            console.error('❌ Error consultando cliente en Supabase:', errorCliente.message);
            throw new Error(`SUPABASE_FETCH_FAILED: ${errorCliente.message}`);
        }

        if (!cliente) {
            return NextResponse.json(
                { error: 'Cliente no encontrado o no pertenece a este comercio.' },
                { status: 404 }
            );
        }

        // 2. 🛡️ ESCUDO DE INTEGRIDAD EN SANITY: Validar si el UUID está amarrado a un pedido vivo (Cocina/Caja)
        // Buscamos si el string del UUID coincide directamente con 'clienteRef' en las mesas activas
        const ordenVinculada = await sanityClientServer.fetch(
            `*[_type == "ordenActiva" && tenant == $tenant && clienteRef == $id][0]{
                _id,
                mesa
            }`,
            { id, tenant },
            { useCdn: false }
        );

        if (ordenVinculada) {
            return NextResponse.json(
                {
                    error: `No se puede eliminar el cliente porque está vinculado a la orden activa "${ordenVinculada.mesa}". Primero cierre o elimine esa orden.`
                },
                { status: 409 }
            );
        }

        // 3. 🗑️ DESTRUCCIÓN ATÓMICA EN POSTGRESQL
        const { error: errorDelete } = await supabaseServer
            .from('clientes')
            .delete()
            .eq('id', id)
            .eq('tenant_id', tenant);

        if (errorDelete) {
            console.error('❌ Error eliminando cliente en Supabase:', errorDelete.message);
            throw new Error(`SUPABASE_DELETE_FAILED: ${errorDelete.message}`);
        }

        // 🪓 GUILLOTINA SÍNCRONA: Si el POS guarda la lista de clientes elegibles en la caché, la destruimos
        try {
            await supabaseServer
                .from('catalog_cache')
                .delete()
                .eq('tenant_host', tenant.toLowerCase().trim());
            console.log(`🗑️ Caché del catálogo purgado síncronamente en eliminación de cliente para: ${tenant}`);
        } catch (cacheError) {
            console.warn("⚠️ Falla no-bloqueante al purgar búnker desde API clientes:", cacheError.message);
        }

        return NextResponse.json({
            success: true,
            message: 'Cliente eliminado correctamente de Supabase.'
        });

    } catch (error) {
        console.error('🔥 [API_CLIENTE_DELETE_ERROR]:', error.message);

        return NextResponse.json(
            {
                error: 'Error interno al intentar eliminar el cliente.',
                details: error.message
            },
            { status: 500 }
        );
    }
}