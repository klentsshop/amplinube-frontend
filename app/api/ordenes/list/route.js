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
            _id, mesa, mesero, tipoOrden, fechaCreacion, platosOrdenados, imprimirSolicitada, tenant,
    clienteRef, datosEntrega
        }`;

      const data = await sanityClientServer.fetch(query, { tenantId }, { useCdn: false });
        
        // 🛡️ MITIGACIÓN DE API REQUESTS: Cabeceras de control estricto para frenar el desangre de consultas fantasmas
        return new NextResponse(JSON.stringify(data || []), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
                'Pragma': 'no-cache',
                'Expires': '0',
            }
        });
    } catch (error) {
        console.error('[API_LIST_GET_ERROR]:', error);
        return new NextResponse(JSON.stringify([]), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

// 🔵 POST: Guarda o Actualiza la mesa
export async function POST(request) {
    try {
        const body = await request.json();
        // 🛡️ Extraemos tenantId de forma flexible para que no de error 400
        const { mesa, mesero, platosOrdenados, ordenId, tipoOrden, clienteRef, datosEntrega } = body;
        const tenantId = body.tenantId || body.tenant;
if (!tenantId || tenantId === 'undefined') {
    return NextResponse.json({ error: 'Identificador de comercio inválido para registrar pedidos.' }, { status: 400 });
}

        // 1. VALIDACIÓN DE SEGURIDAD
        if (
    !mesa ||
    !Array.isArray(platosOrdenados) ||
    platosOrdenados.length === 0
) {
            return NextResponse.json({ error: 'Datos incompletos.' }, { status: 400 });
        }
// ✅ REEMPLAZAR POR ESTE BLOQUE:
// Traemos tanto el _id como el titulo de las categorías con impresión desactivada
// 🛡️ LECTURA DESDE EL ESCUDO DE SUPABASE (Costo Sanity: $0)
        let categoriasNoImprimibles = [];
        try {
            const { supabaseServer } = await import('@/lib/supabase');
            const { data: cacheRow } = await supabaseServer
                .from('catalog_cache')
                .select('payload_json')
                .eq('tenant_host', tenantId.toLowerCase().trim())
                .single();

            const categoriasBunker = cacheRow?.payload_json?.categoria || cacheRow?.payload_json?.categorias || [];
            categoriasNoImprimibles = categoriasBunker.filter(c => c.seImprime === false);
        } catch (cacheError) {
            console.error("⚠️ Falló búnker de caché. Activando contingencia directa en Sanity para salvar tiqueteras...");
            try {
                // Plan de rescate: Si Supabase no responde, sacrificamos una API request a Sanity antes de mandar basura a las impresoras
                categoriasNoImprimibles = await sanityClientServer.fetch(
                    `*[_type == "categoria" && tenant == $tenantId && seImprime == false]{ _id, titulo }`,
                    { tenantId },
                    { useCdn: false }
                );
            } catch (sanityFatalError) {
                console.error("🔥 Error crítico global: Sin acceso a catálogos para mapear impresión.", sanityFatalError.message);
            }
        }

// Estructuramos conjuntos indexados (Set) para búsquedas instantáneas
const idsExcluidos = new Set((categoriasNoImprimibles || []).map(c => String(c._id).trim()));
const titulosExcluidos = new Set((categoriasNoImprimibles || []).map(c => String(c.titulo).trim().toUpperCase()));

// ✅ REEMPLAZAR POR ESTE BLOQUE:
const estacionesSet = new Set();
const platosNormalizados = platosOrdenados.map(p => {
    // Extraemos de forma elástica el ID de la categoría (si viene como string o como objeto de referencia)
    const catIdOriginal = typeof p.categoria === 'object' ? (p.categoria?._ref || p.categoria?._id) : p.categoria;
    const catIdLimpio = String(catIdOriginal || "").trim();
    
    // Extraemos el nombre de la categoría (usando p.categoriaLabel o la propiedad cruda)
    const catLabelLimpia = String(p.categoriaLabel || p.categoria || "").trim().toUpperCase();
    
    // Un plato NO se imprime si su ID de categoría está excluido O si su nombre de texto coincide con uno excluido
    const esCategoriaExcluida = idsExcluidos.has(catIdLimpio) || titulosExcluidos.has(catLabelLimpia);
    
    // Condición maestra final
    const debeImprimirPlato = p.seImprime === true && !esCategoriaExcluida;
    
    // Definimos la etiqueta limpia que leerá el despachador de la comanda
    const categoriaFinal = p.categoriaLabel ? String(p.categoriaLabel).trim().toUpperCase() : catLabelLimpia;
    
    if (debeImprimirPlato && categoriaFinal) {
        estacionesSet.add(categoriaFinal);
    }

    return {
        _key: p._key || p.lineId || Math.random().toString(36).substring(2, 9),
        _id: p._id,
        nombrePlato: p.nombrePlato || p.nombre,
        cantidad: Number(p.cantidad) || 1,
        precioUnitario: Number(p.precioUnitario || p.precioNum) || 0,
        precioCosto: Number(p.precioCosto || 0),
        subtotal: (Number(p.precioUnitario || p.precioNum) || 0) * (Number(p.cantidad) || 1),
        comentario: p.comentario || "",
        categoria: categoriaFinal, 
        seImprime: debeImprimirPlato, 
        controlaInventario: p.controlaInventario || false,
        amount: Number(p.cantidad) || 1,
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
                setIfMissing: { estacionesPendientes: [],
                                mesero
                 },
                insert: {
                    after: 'estacionesPendientes[-1]',
                    items: estacionesPendientes
                },
                set: {
                    mesa,
                    tenant: tenantId, 
                    tipoOrden: tipoOrden || 'mesa',
                    platosOrdenados: platosNormalizados,
                    ultimaActualizacion: fechaActual,
                    imprimirSolicitada: valorSolicitada,                
                   clienteRef: body.cliente ? {
                   _id: body.cliente.id || body.cliente._id, 
                   nombre: body.cliente.nombre,
                   telefono: body.cliente.telefono,
                   direccion: body.cliente.direccion
                   } : null,
                   ...(datosEntrega ? { datosEntrega } : {})
                    
                   },
                unset:  [
                         'impreso',
                         'imprime',
                          ...(clienteRef ? [] : ['clienteRef']),
                         ...(datosEntrega ? [] : ['datosEntrega'])
                        ]
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
                estacionesPendientes: estacionesPendientes,
                ...(clienteRef ? { clienteRef } : {}),
                ...(datosEntrega ? { datosEntrega } : {})
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