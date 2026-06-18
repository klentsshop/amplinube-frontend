import { NextResponse } from 'next/server';
import { sanityClientServer } from '@/lib/sanity';

export const dynamic = 'force-dynamic';

export async function POST(request) {
    try {
        const { ordenId, tenantId } = await request.json();

       if (!ordenId || !tenantId || tenantId === 'undefined') {
    return NextResponse.json(
        { error: 'ordenId y tenantId son requeridos', exists: false },
        { status: 400 }
    );
}

        const query = `
            *[_type == "ordenActiva" && _id == $ordenId && tenant == $tenantId][0] {
                _id,
                tenant,
                mesa,
                mesero,  // 🔥 AGREGADO: Ahora la API sí entregará el nombre (Diana, Mauricio, etc.)
                tipoOrden,
                fechaCreacion,
                imprimirSolicitada,
                clienteRef->{
                _id,
                nombre,
                telefono,
                direccion
                },
                datosEntrega,
                platosOrdenados[] {
                    _key,
                    _id,
                    categoria,
                    nombrePlato,
                    cantidad,
                    precioUnitario,
                    precioCosto,
                    subtotal,
                    comentario,
                    seImprime,
                    controlaInventario,
                    cantidadADescontar,
                    insumoVinculado,
                    recetaInsumos
                }
            }
        `;

        // 🔥 Agregamos { useCdn: false } para que el dato sea 100% fresco al cargar
        const orden = await sanityClientServer.fetch(query, { ordenId, tenantId }, { useCdn: false});
        if (!orden) {
            return NextResponse.json(
                { message: 'Orden no encontrada', exists: false },
                { status: 200 } 
            );
        }

        return new NextResponse(JSON.stringify({ ...orden, exists: true }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
                'Pragma': 'no-cache',
                'Expires': '0',
            },
        });

    } catch (error) {
        console.error('[API_GET_ORDEN_ERROR]:', error);
        return NextResponse.json(
            { error: 'Error interno al obtener la orden', exists: false },
            { status: 500 }
        );
    }
}