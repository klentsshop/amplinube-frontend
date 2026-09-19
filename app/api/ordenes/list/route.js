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
                        categoria: p.categoria || "",                           // 🛡️ UUID Relacional
                        categoriaNombre: p.categoria_label || p.categoria || "",   // 🖨️ Nombre Legible Impresión
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
        // 🛡️ CONTROL DE CATEGORÍAS Y RESOLUCIÓN BISTURÍ DE NOMBRES DE ESTACIÓN
        // =========================================================================
        let categoriasNoImprimibles = [];
        const mapaTitulosCategorias = new Map();

        // 1. Extraemos catálogo desde la Caché del Tenant
        const { data: cacheRow } = await supabaseServer
            .from('catalog_cache')
            .select('payload_json')
            .eq('tenant_host', cleanTenant)
            .maybeSingle();

        if (cacheRow?.payload_json && Array.isArray(cacheRow.payload_json)) {
            const catalogo = cacheRow.payload_json;
            const categorias = catalogo.filter(item => item._type === 'categoria' || item.titulo);
            
            categoriasNoImprimibles = categorias.filter(c => c.se_imprime === false || c.seImprime === false);

            categorias.forEach(c => {
                const id = String(c._id || c.id || "").trim().toLowerCase();
                const titulo = String(c.titulo || c.nombre || "").trim().toUpperCase();
                if (id && titulo) mapaTitulosCategorias.set(id, titulo);
            });
        }

        // 2. Auxilio desde la tabla 'categorias' si la Caché está vacía
        if (mapaTitulosCategorias.size === 0) {
            const { data: catDbRows } = await supabaseServer
                .from('categorias')
                .select('id, titulo, se_imprime')
                .eq('tenant', cleanTenant);

            if (catDbRows) {
                catDbRows.forEach(c => {
                    const id = String(c.id || "").trim().toLowerCase();
                    const titulo = String(c.titulo || "").trim().toUpperCase();
                    if (id && titulo) mapaTitulosCategorias.set(id, titulo);
                    if (c.se_imprime === false) {
                        categoriasNoImprimibles.push(c);
                    }
                });
            }
        }

        const idsExcluidos = new Set(categoriasNoImprimibles.map(c => String(c._id || c.id || "").trim().toLowerCase()));
        const titulosExcluidos = new Set(categoriasNoImprimibles.map(c => String(c.titulo || c.nombre || "").trim().toUpperCase()));
        const slugsExcluidos = new Set(categoriasNoImprimibles.map(c => String(c.slug?.current || c.slug || "").trim().toLowerCase()));

        const estacionesSet = new Set();

        // 🛡️ Extraemos la lista de nombres reales en mayúsculas de este restaurante
        const titulosValidosNegocio = new Map();
        mapaTitulosCategorias.forEach((titulo, uuid) => {
            titulosValidosNegocio.set(titulo.toUpperCase().trim(), titulo.toUpperCase().trim());
        });

        const platosNormalizados = platosOrdenados.map(p => {
            const catOriginal = typeof p.categoria === 'object'
                ? (p.categoria?.titulo || p.categoria?.nombre || p.categoria?.id || '')
                : String(p.categoria || '').trim();

            const catLabelOriginal = String(p.categoriaNombre || p.categoriaLabel || p.nombreCategoria || '').trim();
            const catUuidLimpio = String(catOriginal).toLowerCase();

            // 🎯 RESOLUCIÓN ESTRICTA:
            // 1. ¿Ya es un nombre válido de categoría en este negocio? (ej: "DIARIO") -> Se respeta.
            // 2. ¿Es un UUID? -> Se traduce con el mapa al nombre real.
            // 3. ¿El label ya traía un nombre válido? -> Se respeta.
            let nombreLegibleCat = "";

            // 1. ¿El texto de categoria o categoriaNombre ya es un título válido del negocio?
            if (titulosValidosNegocio.has(catOriginal.toUpperCase()) && catOriginal.toUpperCase() !== "GENERAL") {
                nombreLegibleCat = titulosValidosNegocio.get(catOriginal.toUpperCase());
            } else if (titulosValidosNegocio.has(catLabelOriginal.toUpperCase()) && catLabelOriginal.toUpperCase() !== "GENERAL") {
                nombreLegibleCat = titulosValidosNegocio.get(catLabelOriginal.toUpperCase());
            } 
            // 2. ¿Es un UUID registrado en el mapa?
            else if (mapaTitulosCategorias.has(catUuidLimpio) && mapaTitulosCategorias.get(catUuidLimpio) !== "GENERAL") {
                nombreLegibleCat = mapaTitulosCategorias.get(catUuidLimpio);
            } 
            // 3. Si venía como "GENERAL" o vacío, buscamos la categoría real del plato en la caché del negocio
            else if (cacheRow?.payload_json && Array.isArray(cacheRow.payload_json)) {
                const platoIdBuscar = String(p._id || p.id || p.plato_id || "").trim();
                const platoMaestro = cacheRow.payload_json.find(item => 
                    (item._id === platoIdBuscar || item.id === platoIdBuscar) ||
                    (item.nombre && item.nombre.trim().toUpperCase() === String(p.nombrePlato || p.nombre).trim().toUpperCase())
                );

                if (platoMaestro) {
                    const cRef = typeof platoMaestro.categoria === 'object' 
                        ? (platoMaestro.categoria?._ref || platoMaestro.categoria?.id) 
                        : platoMaestro.categoria;
                    const cRefLimpio = String(cRef || "").trim().toLowerCase();

                    if (mapaTitulosCategorias.has(cRefLimpio)) {
                        nombreLegibleCat = mapaTitulosCategorias.get(cRefLimpio);
                    } else if (titulosValidosNegocio.has(String(platoMaestro.categoriaNombre || "").toUpperCase())) {
                        nombreLegibleCat = String(platoMaestro.categoriaNombre).toUpperCase();
                    }
                }
            }

            // Si después de todo no resolvió, nunca forzar GENERAL; se conserva texto limpio
            if (!nombreLegibleCat || nombreLegibleCat.toUpperCase() === "GENERAL") {
                nombreLegibleCat = (catLabelOriginal && catLabelOriginal.toUpperCase() !== "GENERAL") 
                    ? catLabelOriginal 
                    : ((catOriginal && catOriginal.toUpperCase() !== "GENERAL") ? catOriginal : "");
            }

            const catSlugLimpio = String(p.categoriaSlug || p.slug || "").trim().toLowerCase();

            // Validación estricta de exclusión
            const esCategoriaExcluida = idsExcluidos.has(catUuidLimpio) || 
                                       titulosExcluidos.has(nombreLegibleCat.toUpperCase()) || 
                                       slugsExcluidos.has(catSlugLimpio);

            const debeImprimir = !esCategoriaExcluida && p.seImprime !== false && p.se_imprime !== false;

            // 🛡️ Solo se agrega a estaciones pendientes si el plato debe imprimirse
            // y tiene una categoría válida real distinta de "GENERAL" y vacíos
            if (debeImprimir && nombreLegibleCat && nombreLegibleCat.toUpperCase() !== 'GENERAL') {
                estacionesSet.add(nombreLegibleCat.toUpperCase());
            }

            // D) Preparación del Comentario de Inventario
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
                categoria: nombreLegibleCat,       // 🖨️ Nombre Legible (ej: "SALSAMENTARIA", "BAR", "RESTAURANTES")
                categoria_label: nombreLegibleCat // 🖨️ Nombre Legible para Impresión
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

        // =========================================================================
        // 🚀 EMISIÓN BÚNKER HACIA RAILWAY (DUMB PIPE)
        // Ejecución inmediata dentro del try antes de responder al cliente
        // =========================================================================
        const misPlatosFormateados = platosNormalizados.map((p, index) => ({
            secuencia_orden: index + 1,
            idx: index,
            line_id: p.line_id,
            _key: p.line_id,
            plato_id: p.plato_id,
            _id: p.plato_id,
            nombre_plato: p.nombre_plato,
            nombrePlato: p.nombre_plato,
            cantidad: Number(p.cantidad || 0),
            precio_unitario: Number(p.precio_unitario || 0),
            precioUnitario: Number(p.precio_unitario || 0),
            subtotal: Number(p.subtotal || 0),
            comentario: p.comentario || "",
            categoria: p.categoria || "",
            categoria_label: p.categoria_label || p.categoria || ""
        }));

        const misEstacionesFormateadas = estacionesPendientes.map(e => ({ estacion: e }));

        // 🚩 Detectamos si es adición: si venía ordenId previo o si ya existía la mesa en la BD
        const esAdicionReal = Boolean(ordenId || idRealOrden);

        const payloadInfladoEstandar = {
            _id: idFinal,
            id: idFinal,
            _type: 'ordenActiva',
            tenant: cleanTenant,
            tenant_id: cleanTenant,
            mesa: mesa.trim(),
            mesero: mesero || 'Caja',
            tipo_orden: tipoOrden || 'mesa',
            tipoOrden: tipoOrden || 'mesa',
            
            // 🖨️ BANDERA DE ADICIÓN PARA IMPRESORA TÉRMICA (C# y Kotlin)
            es_adicion: esAdicionReal,
            esAdicion: esAdicionReal,

            fecha_creacion: new Date().toISOString(),
            fechaCreacion: new Date().toISOString(),
            imprimir_solicitada: valorSolicitada,
            imprimirSolicitada: valorSolicitada,
            imprimir_cliente: valorCliente,
            imprimirCliente: valorCliente,
            cliente_ref: clienteFinalPayload,
            datos_entrega: datosEntrega || null,
            datosEntrega: datosEntrega || null,
            platosOrdenados: misPlatosFormateados,
            platos_ordenados: misPlatosFormateados,
            estacionesPendientes: misEstacionesFormateadas
        };

        const RAILWAY_URL = process.env.RAILWAY_SOCKET_SERVER_URL || process.env.NEXT_PUBLIC_RAILWAY_SOCKET_URL || process.env.RAILWAY_SOCKET_URL;

       if (RAILWAY_URL) {
    fetch(`${RAILWAY_URL}/api/dispatch-print`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadInfladoEstandar)
    }).catch(err => console.error("⚠️ Error enviando evento a Railway:", err.message));
} else {
    console.warn("⚠️ Variable de entorno para el servidor de sockets no definida.");
}
        return NextResponse.json({
            message: ordenId || idRealOrden ? 'Orden actualizada' : 'Orden creada',
            ordenId: idFinal
        }, { status: 200 });

    } catch (error) {
        console.error('🔥 [SUPABASE_ORDENES_POST_ERROR]:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}