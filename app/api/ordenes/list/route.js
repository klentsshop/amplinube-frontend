import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// 🟢 GET: Recupera las mesas vivas desde Supabase Relacional
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const tenantId = searchParams.get('tenantId');
        
        if (!tenantId || tenantId === 'undefined') {
            return NextResponse.json([]);
        }

        const cleanTenant = tenantId.toLowerCase().trim();

        // 1. Extraemos las cabeceras de las órdenes activas del comercio
        const { data: ordenesRows, error: errOrdenes } = await supabaseServer
            .from('ordenes_activas')
            .select('*')
            .eq('tenant', cleanTenant)
            .order('fecha_creacion', { ascending: true });

        if (errOrdenes) throw errOrdenes;
        if (!ordenesRows || ordenesRows.length === 0) return NextResponse.json([]);

       // 2. Extraemos todos los platos vinculados a esas órdenes con filtro estricto de TENANT
        const listaIds = ordenesRows.map(o => o.id);
        const { data: platosRows, error: errPlatos } = await supabaseServer
            .from('platos_ordenados')
            .select('*')
            .eq('tenant', cleanTenant)
            .in('orden_id', listaIds)
            .order('created_at', { ascending: true })
            .order('id', { ascending: true });

        if (errPlatos) throw errPlatos;

       // 3. Extraemos todas las estaciones pendientes filtrando por TENANT
        const { data: pendientesRows, error: errPendientes } = await supabaseServer
            .from('estaciones_pendientes')
            .select('*')
            .eq('tenant', cleanTenant)
            .in('orden_id', listaIds);

        if (errPendientes) throw errPendientes;

        // 4. Reconstruimos la firma JSON exacta orientada a documentos que el POS Frontend espera
        const respuestaFormateada = ordenesRows.map(o => {
            const misPlatos = (platosRows || [])
                .filter(p => p.orden_id === o.id)
                .map(p => {
                    // 🛡️ EXTRACCIÓN SEGURA DE INVENTARIO DESDE EL COMENTARIO
                    let comentarioTexto = p.comentario || "";
                    let controlaInventario = false;
                    let insumoVinculado = null;

                    if (comentarioTexto.trim().startsWith('{')) {
                        try {
                            const jsonComentario = JSON.parse(comentarioTexto);
                            comentarioTexto = jsonComentario.comentarioOriginal || "";
                            insumoVinculado = jsonComentario.insumo || null;
                            controlaInventario = true;
                        } catch (e) {
                            // Si falla, el comentario era un texto común y corriente
                        }
                    }

                    return {
                        _key: p.line_id || Math.random().toString(36).substring(2, 9),
                        _id: p.plato_id,
                        _type: 'platoOrdenado',
                        nombrePlato: p.nombre_plato,
                        cantidad: Number(p.cantidad || 0),
                        precioUnitario: Number(p.precio_unitario || 0),
                        subtotal: Number(p.subtotal || 0),
                        comentario: comentarioTexto,
                        categoria: p.categoria || "",
                        controlaInventario: controlaInventario,
                        amount: Number(p.cantidad || 0), 
                        cantidadADescontar: insumoVinculado ? Number(p.cantidad || 0) : 0,
                        insumoVinculado: insumoVinculado
                    };
                });

            const misEstaciones = (pendientesRows || [])
                .filter(e => e.orden_id === o.id)
                .map(e => e.estacion);

            return {
                _id: o.id, // Sincronía perfecta de llaves con Supabase
                _type: 'ordenActiva', // Requerido para mantener simetría estricta con el Front
                _rev: `supa-rev-${new Date(o.ultima_actualizacion || o.fecha_creacion).getTime()}`,
                tenant: o.tenant,
                mesa: o.mesa,
                mesero: o.mesero || 'Caja',
                tipoOrden: o.tipo_orden,
                fechaCreacion: o.fecha_creacion,
                ultimaActualizacion: o.ultima_actualizacion,
                imprimirSolicitada: o.imprimir_solicitada,
                imprimirCliente: o.imprimir_cliente,
                clienteRef: o.cliente_ref ? JSON.parse(o.cliente_ref) : null,
                datosEntrega: o.datos_entrega,
                platosOrdenados: misPlatos,
                estacionesPendientes: misEstaciones,
                // Inyectamos dinámicamente los cursores en la raíz para que la APK los lea transparente
                ...(typeof o.cursores_estaciones === 'string' ? JSON.parse(o.cursores_estaciones || '{}') : (o.cursores_estaciones || {}))
            };
        });

        return new NextResponse(JSON.stringify(respuestaFormateada), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
            }
        });

    } catch (error) {
        console.error('🔥 [SUPABASE_LIST_GET_ERROR]:', error);
        return new NextResponse(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
}

// 🔵 POST: Transaccionalidad de Guardado y Adiciones sobre Supabase
export async function POST(request) {
    try {
        const body = await request.json();
        const { mesa, mesero, platosOrdenados, ordenId, tipoOrden, clienteRef, datosEntrega } = body;
        const tenantId = body.tenantId || body.tenant;

        if (!tenantId || tenantId === 'undefined') {
            return NextResponse.json({ error: 'Identificador de comercio inválido.' }, { status: 400 });
        }
        if (!mesa || !Array.isArray(platosOrdenados) || platosOrdenados.length === 0) {
            return NextResponse.json({ error: 'Datos incompletos.' }, { status: 400 });
        }

        const cleanTenant = tenantId.toLowerCase().trim();

        // =========================================================================
// 🛡️ CONTROL DE CATEGORÍAS NO IMPRIMIBLES DESDE CATALOG_CACHE / SUPABASE
// =========================================================================
let categoriasNoImprimibles = [];

const { data: cacheRow } = await supabaseServer
    .from('catalog_cache')
    .select('payload_json')
    .eq('tenant_host', cleanTenant)
    .maybeSingle();

if (cacheRow?.payload_json && Array.isArray(cacheRow.payload_json)) {
    const catalogo = cacheRow.payload_json;
    const categorias = catalogo.filter(item => item._type === 'categoria');
    
    // 🧠 BISTURÍ: Soporta tanto 'se_imprime' (DB) como 'seImprime' (CamelCase)
    categoriasNoImprimibles = categorias.filter(c => c.se_imprime === false || c.seImprime === false);
}

// Creamos colecciones de normalización en Mayúsculas para macheo perfecto
const idsExcluidos = new Set(categoriasNoImprimibles.map(c => String(c._id || c.id || "").trim().toLowerCase()));
const titulosExcluidos = new Set(categoriasNoImprimibles.map(c => String(c.titulo || c.nombre || "").trim().toUpperCase()));
const slugsExcluidos = new Set(categoriasNoImprimibles.map(c => String(c.slug?.current || c.slug || "").trim().toLowerCase()));

const estacionesSet = new Set();

const platosNormalizados = platosOrdenados.map(p => {
    const catIdOriginal = typeof p.categoria === 'object' ? (p.categoria?._ref || p.categoria?._id) : p.categoria;
    const catIdLimpio = String(catIdOriginal || "").trim().toLowerCase();
    const catLabelLimpia = String(p.categoriaLabel || p.categoria || "").trim().toUpperCase();
    const catSlugLimpio = String(p.categoriaSlug || p.slug || "").trim().toLowerCase();

    // 🎯 VALIDACIÓN TRIPLE: Si el ID, el Título o el Slug coinciden con una categoría NO imprimible, se apaga
    const esCategoriaExcluida = idsExcluidos.has(catIdLimpio) || titulosExcluidos.has(catLabelLimpia) || slugsExcluidos.has(catSlugLimpio);

    // 🚀 REGLA DE ORO: Si la categoría NO es excluida, SE AGREGA A LA IMPRESIÓN
    const debeImprimir = !esCategoriaExcluida && p.seImprime !== false;

    const categoriaFinal = p.categoriaLabel ? String(p.categoriaLabel).trim().toUpperCase() : catLabelLimpia;

    // Solo si 'debeImprimir' es verdadero y tiene categoría válida, entra a la comanda de cocina
    if (debeImprimir && categoriaFinal) {
        estacionesSet.add(categoriaFinal);
    }

    // 🛡️ BISTURÍ: Empaquetamos los datos de inventario dentro del comentario
    let comentarioFinal = p.comentario || "";
    if (p.controlaInventario && p.insumoVinculado) {
        comentarioFinal = JSON.stringify({
            comentarioOriginal: p.comentario || "",
            insumo: p.insumoVinculado
        });
    }

    const payloadPlato = {
        line_id: p._key || p.lineId || Math.random().toString(36).substring(2, 9),
        plato_id: p._id || p.id,
        nombre_plato: p.nombrePlato || p.nombre,
        cantidad: Number(p.cantidad) || 1,
        precio_unitario: Number(p.precioUnitario || p.precioNum) || 0,
        subtotal: (Number(p.precioUnitario || p.precioNum) || 0) * (Number(p.cantidad) || 1),
        comentario: comentarioFinal,
        categoria: categoriaFinal
    };

    if (p.created_at || p.createdAt) {
        payloadPlato.created_at = p.created_at || p.createdAt;
    }

    return payloadPlato;
});
        const estacionesPendientes = Array.from(estacionesSet);
        const valorSolicitada = body.hasOwnProperty('imprimirSolicitada') ? body.imprimirSolicitada : true;
        const valorCliente = body.hasOwnProperty('imprimirCliente') ? body.imprimirCliente : false;

        // 🛡️ DECLARACIÓN ANTICIPADA: Mapeo elástico para evitar el ReferenceError de clienteFinalPayload
        const clienteFinalPayload = body.cliente ? {
            id: body.cliente.id || body.cliente._id,
            nombre: body.cliente.nombre,
            telefono: body.cliente.telefono,
            direccion: body.cliente.direccion
        } : (typeof clienteRef === 'string' ? JSON.parse(clienteRef) : (clienteRef || null));

        // 🔍 REPARACIÓN: Búsqueda del ID por mesa cuando el Front no envía ordenId
        let idRealOrden = ordenId;
        if (!idRealOrden) {
            const { data: ordenExistente } = await supabaseServer
                .from('ordenes_activas')
                .select('id')
                .eq('tenant', cleanTenant)
                .eq('mesa', mesa.trim())
                .maybeSingle();
            
            if (ordenExistente) idRealOrden = ordenExistente.id;
        }

        // 🚀 BISTURÍ RELOJ SUIZO: Ejecución atómica pura en 1 sola transacción en Postgres
        const { data: idResultado, error: errRpc } = await supabaseServer
            .rpc('guardar_orden_transaccional', {
                p_orden_id: idRealOrden || null,
                p_tenant: cleanTenant,
                p_mesa: mesa.trim(),
                p_mesero: mesero || 'Caja',
                p_tipo_orden: tipoOrden || 'mesa',
                p_imprimir_solicitada: valorSolicitada,
                p_imprimir_cliente: valorCliente,
                p_datos_entrega: datosEntrega || null,
                p_cliente_ref: clienteFinalPayload ? JSON.stringify(clienteFinalPayload) : null,
                p_platos: platosNormalizados,
                p_estaciones: estacionesPendientes
            });

        if (errRpc) throw errRpc;
        const idFinal = idResultado || idRealOrden;
        return NextResponse.json({
            message: ordenId || idRealOrden ? 'Orden actualizada' : 'Orden creada',
            ordenId: idFinal
        }, { status: 200 });

    } catch (error) {
        console.error('🔥 [SUPABASE_ORDENES_POST_ERROR]:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}