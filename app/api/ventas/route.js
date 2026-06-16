import { NextResponse } from 'next/server';
import { sanityClientServer } from '@/lib/sanity';
import crypto from 'crypto';
import { supabaseServer } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req) {
    try {
        const payload = await req.json();
        const tenantId = payload.tenantId || payload.tenant; 
        const { transaccionId, datosEntrega } = payload;
        if (!tenantId) {
            return NextResponse.json({ ok: false, error: 'TENANT_MISSING' }, { status: 400 });
        }
        
        // --- 1. VARIABLES ORIGINALES ---
        const mesa = payload.mesa || 'General';
        const mesero = payload.mesero || 'Personal General';
        const metodoPagoRaw = payload.metodoPago || 'efectivo';
        const metodoPago = metodoPagoRaw.toLowerCase().trim();
        const totalPagado = Number(payload.totalPagado) || 0;
        const propinaRecaudada = Number(payload.propinaRecaudada) || 0;
        const ordenId = payload.ordenId;
        const tipoOrden = typeof payload.tipoOrden === 'string' ? payload.tipoOrden.trim() : 'mesa';

        // --- 2. FECHAS Y FOLIO ---
        const now = new Date();
        const fechaUTC = now.toISOString();
        const fechaLocal = new Date().toLocaleString('sv-SE', { timeZone: 'America/Bogota' });

        const datePart = fechaUTC.slice(2, 10).replace(/-/g, '');
        const seed = transaccionId ? transaccionId.slice(-4).toUpperCase() : (crypto.randomBytes(2).toString('hex')).toUpperCase();
        const prefix = tenantId.slice(0, 3).toUpperCase(); 
        const folioGenerado = `${prefix}-${datePart}-${seed}`;
        const ventaId = transaccionId ? `venta-${transaccionId}` : `venta-${Date.now()}-${seed}`;
        
        // --- 3. 🛡️ ESCUDO ANTI-FANTASMAS (EL BLOQUEO MAESTRO) ---
        if (ordenId && ordenId !== "undefined" && ordenId !== "null") {
            const mesaExiste = await sanityClientServer.fetch(
                `defined(*[_type == "ordenActiva" && _id == $id && tenant == $tenantId][0])`, 
                { id: ordenId, tenantId }
            );
            
            if (!mesaExiste) {
                console.warn(`⚠️ Cobro duplicado evitado: ${ordenId}`);
                return NextResponse.json({ 
                    ok: true, 
                    yaProcesada: true, 
                    message: 'Esta mesa ya fue cerrada anteriormente.' 
                }, { status: 200 });
            }
        } else {
            const esCajaRapida = mesa === '0' || mesa === 'General' || mesa === '';
            if (!esCajaRapida) {
                return NextResponse.json({ 
                    ok: false, 
                    error: 'REFERENCIA_PERDIDA', 
                    message: 'No se puede cobrar una mesa guardada sin su ID original.' 
                }, { status: 400 });
            }
        }

        // --- 4. 🚀 BÚSQUEDA DE IDS Y RECETAS DESDE EL BÚNKER DE SUPABASE (CON CONTINGENCIA REAL) ---
        const nombresPlatos = (payload.platosVendidosV2 || []).map(item => item.nombrePlato || item.nombre);
        let mapeoSanity = [];
        let usoContingenciaSanity = false;
        
        try {
            // Buscamos el catálogo en la caché en piedra de Supabase
            const { data: cacheRow, error: errCache } = await supabaseServer
                .from('catalog_cache')
                .select('payload_json')
                .eq('tenant_host', tenantId.toLowerCase().trim())
                .maybeSingle(); // 🛡️ Evita lanzar excepciones ruidosas si la tabla está vacía

            // Si hay un error en Supabase o el registro no existe, forzamos la caída al catch de contingencia
            if (errCache || !cacheRow || !cacheRow.payload_json) {
                throw new Error("Cache miss o error de lectura en Supabase");
            }

            const platosBunker = cacheRow.payload_json.plato || cacheRow.payload_json.platos || [];
            
            // Si el búnker existe pero no tiene platos indexados, también es una alerta para usar Sanity
            if (!Array.isArray(platosBunker) || platosBunker.length === 0) {
                throw new Error("El búnker no contiene un arreglo de platos válido");
            }

            // Filtramos en memoria local solo los platos involucrados en esta venta
            mapeoSanity = platosBunker.filter(p => nombresPlatos.includes(p.nombre)).map(p => ({
                nombre: p.nombre,
                _id: p._id,
                controlaInventario: p.controlaInventario || false,
                insumoVinculadoRef: p.insumoVinculadoRef || p.insumoVinculado?._ref || null,
                cantidadADescontar: p.cantidadADescontar || 0,
                recetaInsumos: (p.recetaInsumos || []).map(r => ({
                    insumoId: r.insumo?._ref || r.insumoId || null,
                    cantidad: r.cantidad || 0
                }))
            }));

            // Si por alguna razón el filtro en memoria nos deja vacíos pero la venta sí trae platos, paracaídas inmediato
            if (mapeoSanity.length === 0 && nombresPlatos.length > 0) {
                throw new Error("Platos vendidos no encontrados en la caché de Supabase");
            }

        } catch (cacheError) {
            console.warn(`⚠️ Contingencia activada: [${cacheError.message}]. Extrayendo recetas directo de Sanity en caliente...`);
            usoContingenciaSanity = true;

            const dataFreshSanity = await sanityClientServer.fetch(
               `*[_type == "plato" && tenant == $tenantId && nombre in $nombres]{
                    nombre, _id, controlaInventario,
                    "insumoVinculadoRef": insumoVinculado._ref,
                    cantidadADescontar,
                    recetaInsumos[]{ "insumoId": insumo._ref, cantidad }
                }`,
                { nombres: nombresPlatos, tenantId },
                { useCdn: false } // 🔌 En caliente directo al búnker central sin CDN
            );

            // Homologamos la respuesta de Sanity para que ensamble de forma idéntica con tu lógica del paso D
            mapeoSanity = (dataFreshSanity || []).map(p => ({
                nombre: p.nombre,
                _id: p._id,
                controlaInventario: p.controlaInventario || false,
                insumoVinculadoRef: p.insumoVinculadoRef || null,
                cantidadADescontar: p.cantidadADescontar || 0,
                recetaInsumos: (p.recetaInsumos || []).map(r => ({
                    insumoId: r.insumoId || null,
                    cantidad: r.cantidad || 0
                }))
            }));
        }

        // --- 5. MAPEO DE PLATOS PARA LA VENTA ---
        const platosVenta = (payload.platosVendidosV2 || []).map(item => {
            const precioFinal = Number(item.precioUnitario || item.precioNum || item.precio) || 0;
            const cantidadFinal = Number(item.cantidad) || 1;
            
            return {
                _key: crypto.randomUUID(),
                _type: 'platoVendidoV2',
                nombrePlato: item.nombrePlato || item.nombre,
                cantidad: cantidadFinal,
                precioUnitario: precioFinal,
                precioCosto: Number(item.precioCosto || 0),
                subtotal: Number(item.subtotal) || (precioFinal * cantidadFinal),
                comentario: item.comentario || ""
            };
        });

        const detallePagosValido = (Array.isArray(payload.detallePagos) && payload.detallePagos.length > 0) 
            ? payload.detallePagos 
            : [{ metodo: metodoPagoRaw, monto: totalPagado + propinaRecaudada }];

        const abrirCajon = metodoPago === 'efectivo' || (metodoPago === 'mixto_v2' && detallePagosValido.some(p => p.metodo === 'efectivo'));
        
        let columnaEfectivo = 0;
        let columnaTarjeta = 0;
        let columnaDigital = 0;

        detallePagosValido.forEach(p => {
            const m = p.metodo?.toLowerCase() || 'efectivo';
            const monto = Number(p.monto || 0);
            
            if (m === 'efectivo') columnaEfectivo += monto;
            else if (m === 'tarjeta') columnaTarjeta += monto;
            else if (m === 'digital' || m === 'nequi' || m === 'daviplata') columnaDigital += monto;
        });

        // ==========================================
        // 🏗️ INICIO DE TRANSACCIÓN ATÓMICA ÚNICA
        // ==========================================
        let transaction = sanityClientServer.transaction();

        // B. CREAR TICKET VENTA PARA APK
        transaction = transaction.create({
            _id: `venta-pulso-${Date.now()}-${seed}`,
            _type: 'venta',
            tenant: tenantId,
            metodoPago: abrirCajon ? 'EFECTIVO_MIXTO' : metodoPago 
        });

        // C. BORRAR MESA ACTIVA
        if (ordenId) {
            transaction = transaction.delete(ordenId);
        }

        // ====================================================================
        // --- D. 🔥 POPULARIDAD (Sanity) e INVENTARIO HÍBRIDO (Supabase) ---
        // ====================================================================
        const descuentosSupabase = [];

        (payload.platosVendidosV2 || []).forEach(p => {
            const nombrePlato = p.nombrePlato || p.nombre;
            const match = (mapeoSanity || []).find(m => m.nombre === nombrePlato);
            
            if (match && match._id) {
                // 📈 La popularidad cambia poco, se queda como patch ligero en Sanity
                transaction = transaction.patch(match._id, {
                    setIfMissing: { totalVentas: 0 },
                    inc: { totalVentas: Number(p.cantidad) || 1 }
                });

                // 🥩 LÓGICA DE EXTRACCIÓN: Preparamos los descuentos para Supabase
                if (match.controlaInventario) {
                    const cantVenta = Number(p.cantidad) || 0;
                    const esPesaje = cantVenta % 1 !== 0; 

                    // Caso 1: Recetas multi-insumo
                    if (Array.isArray(match.recetaInsumos) && match.recetaInsumos.length > 0) {
                        match.recetaInsumos.forEach(insumoItem => {
                            if (insumoItem.insumoId) {
                                const montoFinal = esPesaje ? cantVenta : (Number(insumoItem.cantidad) || 1) * cantVenta;
                                descuentosSupabase.push({
                                    insumo_id: insumoItem.insumoId,
                                    cantidad: montoFinal
                                });
                            }
                        });
                    } 
                    // Caso 2: Insumo Vinculado Directo
                    else if (match.insumoVinculadoRef) {
                        const montoFinal = esPesaje ? cantVenta : (Number(match.cantidadADescontar) || 1) * cantVenta;
                        descuentosSupabase.push({
                            insumo_id: match.insumoVinculadoRef,
                            cantidad: montoFinal
                        });
                    }
                }
            }
        });
        
        // ==========================================================
        // 🚀 INYECCIÓN SENIOR EN POSTGRESQL CON TIMEOUT DE 3 SEGUNDOS
        // ==========================================================
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000); 

        let supabaseError = null;
        try {
            const { error } = await supabaseServer
                .from('ventas')
                .insert([{
                    transaccion_id: ventaId,
                    folio: folioGenerado,
                    tenant_id: tenantId,
                    mesa: String(mesa),
                    tipo_orden: tipoOrden,
                    mesero: mesero,
                    metodo_pago: (metodoPago === 'mixto_v2' || detallePagosValido.length > 1) ? 'mixto_v2' : metodoPago,
                    total_pagado: totalPagado,
                    propina_recaudada: propinaRecaudada,
                    fecha_iso: fechaUTC,
                    fecha_local: fechaLocal,
                    datos_entrega: datosEntrega || null,
                    detalle_pagos: detallePagosValido,
                    platos_vendidos: platosVenta,
                    pago_efectivo: columnaEfectivo,
                    pago_tarjeta: columnaTarjeta,
                    pago_digital: columnaDigital
                }])
                .abortSignal(controller.signal); 
            
            supabaseError = error;
        } catch (fetchErr) {
            if (fetchErr.name === 'AbortError') {
                throw new Error("SUPABASE_TIMEOUT: La base de datos tardó más de 3 segundos en responder por lag de red.");
            }
            throw fetchErr;
        } finally {
            clearTimeout(timeoutId); 
        }

        if (supabaseError) {
            console.error('❌ Error inyectando venta en Supabase:', supabaseError.message);
            throw new Error(`SUPABASE_WRITE_FAILED: ${supabaseError.message}`);
        }

        // --- 🚀 EJECUCIÓN FINAL ---
        // 🛡️ PASO A: Aseguramos Sanity primero para liberar la mesa física.
        await transaction.commit();

        // ⚡ PASO B: Con Sanity asegurado, impactamos masivamente el Inventario en Supabase en paralelo
        if (descuentosSupabase.length > 0) {
            await Promise.all(
                descuentosSupabase.map(async (descuento) => {
                    const { error: errStock } = await supabaseServer.rpc('descontar_stock_pos', {
                        p_tenant_id: tenantId,
                        p_insumo_id: descuento.insumo_id,
                        p_cantidad: descuento.cantidad
                    });
                    
                    if (errStock) {
                        console.error(`⚠️ Error descontando stock para insumo ${descuento.insumo_id}:`, errStock.message);
                    }
                })
            );
        }
          
        // 🎉 PASO C: Éxito absoluto y retorno limpio al frontend
        return NextResponse.json({ 
            ok: true, 
            message: 'Venta registrada e Inventario actualizado',
            folio: folioGenerado
        }, { status: 201 });

    } catch (err) {
        console.error('🔥 [FATAL_ERROR_VENTAS]:', err.message);
        return NextResponse.json({ 
            ok: false, 
            error: 'Error en la transacción final',
            details: err.message 
        }, { status: 500 });
    }
}