import { NextResponse } from 'next/server';
import { sanityClientServer } from '@/lib/sanity';

export async function POST(request) {
    try {
        const body = await request.json();
        const { id, tenant } = body;

        if (!id || !tenant) {
            return NextResponse.json(
                { error: 'ID o Tenant faltante' },
                { status: 400 }
            );
        }

        // ✅ Verificar que el cliente exista y pertenezca al tenant
        const cliente = await sanityClientServer.fetch(
            `*[_type == "cliente" && _id == $id && tenant == $tenant][0]`,
            { id, tenant },
            { useCdn: false }
        );

        if (!cliente) {
            return NextResponse.json(
                { error: 'Cliente no encontrado o no pertenece a este comercio.' },
                { status: 404 }
            );
        }

        // ✅ Verificar si existe alguna orden activa usando este cliente
        const ordenVinculada = await sanityClientServer.fetch(
            `*[
                _type == "ordenActiva" &&
                tenant == $tenant &&
                clienteRef._ref == $id
            ][0]{
                _id,
                mesa
            }`,
            { id, tenant },
            { useCdn: false }
        );

        if (ordenVinculada) {
            return NextResponse.json(
                {
                    error:
                        `No se puede eliminar el cliente porque está vinculado a la orden activa "${ordenVinculada.mesa}". Primero cierre o elimine esa orden.`
                },
                { status: 409 }
            );
        }

        // ✅ Borrado seguro
        await sanityClientServer.delete(id);

        return NextResponse.json({
            success: true,
            message: 'Cliente eliminado'
        });

    } catch (error) {
        console.error('🔥 [API_CLIENTE_DELETE_ERROR]:', error);

        return NextResponse.json(
            {
                error: 'Error interno al eliminar cliente.'
            },
            { status: 500 }
        );
    }
}