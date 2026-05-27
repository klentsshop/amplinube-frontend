import { NextResponse } from 'next/server';
import { sanityClientServer } from '@/lib/sanity';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// 🟢 GET: Recupera las mesas filtradas por cliente
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        // 🛡️ Fallback: Si no viene tenantId, usamos 'demo' para que no se vea vacío
        const tenantId = searchParams.get('tenantId');
if (!tenantId || tenantId === 'undefined') {
    // Si no hay un cliente real identificado, respondemos vacío de inmediato para proteger los datos
    return NextResponse.json([]);
}

        const query = `*[_type == "ordenActiva" && tenant == $tenantId] | order(fechaCreacion asc) {
            _id, mesa, mesero, tipoOrden, fechaCreacion, platosOrdenados, imprimirSolicitada, tenant
        }`;

        const data = await sanityClientServer.fetch(query, { tenantId }, { useCdn: false });
        return NextResponse.json(data || []);
    } catch (error) {
        console.error('[API_LIST_GET_ERROR]:', error);
        return NextResponse.json([], { status: 200 });
    }
}

// 🔵 POST: Guarda o Actualiza la mesa
export async function POST(request) {
    try {
        const body = await request.json();
        // 🛡️ Extraemos tenantId de forma flexible para que no de error 400
        const { mesa, mesero, platosOrdenados, ordenId, tipoOrden } = body;
        const tenantId = body.tenantId || body.tenant;
if (!tenantId || tenantId === 'undefined') {
    return NextResponse.json({ error: 'Identificador de comercio inválido para registrar pedidos.' }, { status: 400 });
}

        // 1. VALIDACIÓN DE SEGURIDAD
        if (!mesa || !Array.isArray(platosOrdenados)) {
            return NextResponse.json({ error: 'Datos incompletos.' }, { status: 400 });
        }

        // 2. NORMALIZACIÓN DE PLATOS (Tu lógica intacta)
        const estacionesSet = new Set();
        const platosNormalizados = platosOrdenados.map(p => {
            const categoriaPlato = (p.categoria || "").trim().toUpperCase();
            if (p.seImprime === true) estacionesSet.add(categoriaPlato);

            return {
                _key: p._key || p.lineId || Math.random().toString(36).substring(2, 9),
                _id: p._id,
                nombrePlato: p.nombrePlato || p.nombre,
                cantidad: Number(p.cantidad) || 1,
                precioUnitario: Number(p.precioUnitario || p.precioNum) || 0,
                subtotal: (Number(p.precioUnitario || p.precioNum) || 0) * (Number(p.cantidad) || 1),
                comentario: p.comentario || "",
                categoria: categoriaPlato,
                seImprime: p.seImprime === true,
                controlaInventario: p.controlaInventario || false,
                cantidadADescontar: p.cantidadADescontar || 0,
                insumoVinculado: p.insumoVinculado || null
            };
        });

        const estacionesPendientes = Array.from(estacionesSet);
        const fechaActual = new Date().toISOString();
        const valorSolicitada = body.hasOwnProperty('imprimirSolicitada') ? body.imprimirSolicitada : true;

        // 3. BUSCAR ID DESTINO (Búsqueda mejorada)
        let idDestino = ordenId;
        if (!idDestino) {
            idDestino = await sanityClientServer.fetch(
                `*[_type == "ordenActiva" && mesa == $mesa && tenant == $tenantId][0]._id`,
                { mesa, tenantId },
                { useCdn: false }
            );
        }

        let transaction = sanityClientServer.transaction();

        if (idDestino) {
            // ACTUALIZAR MESA EXISTENTE
            transaction = transaction.patch(idDestino, {
                setIfMissing: { estacionesPendientes: [] },
                insert: {
                    after: 'estacionesPendientes[-1]',
                    items: estacionesPendientes
                },
                set: {
                    mesa,
                    tenant: tenantId, 
                    mesero,
                    tipoOrden: tipoOrden || 'mesa',
                    platosOrdenados: platosNormalizados,
                    ultimaActualizacion: fechaActual,
                    imprimirSolicitada: valorSolicitada
                },
                unset: ['impreso', 'imprime']
            });
        } else {
            // CREAR MESA NUEVA
            transaction = transaction.create({
                _id: `orden-${tenantId}-${Date.now()}`, 
                _type: 'ordenActiva',
                tenant: tenantId, 
                mesa,
                mesero,
                tipoOrden: tipoOrden || 'mesa',
                fechaCreacion: fechaActual,
                ultimaActualizacion: fechaActual,
                platosOrdenados: platosNormalizados,
                imprimirSolicitada: valorSolicitada,
                estacionesPendientes: estacionesPendientes
            });
        }

        const result = await transaction.commit();

        return NextResponse.json({
            message: idDestino ? 'Orden actualizada' : 'Orden creada',
            ordenId: idDestino || (result.results[0] ? result.results[0].id : null)
        }, { status: 200 });

    } catch (error) {
        console.error('🔥 [API_ORDENES_POST_ERROR]:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}