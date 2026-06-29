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

        // 🛡️ CANDADO DE SEGURIDAD MÁXIMA: Validar permiso de cobro en Sanity
        if (mesero !== 'Caja' && mesero !== 'Personal General') {
            const permisoReal = await sanityClientServer.fetch(
                `*[_type == "mesero" && nombre == $nombre && tenant == $tenantId][0].puedeCobrar`,
                { nombre: mesero, tenantId }
            );
            
            if (permisoReal === false) {
                console.warn(`🚨 INTENTO DE COBRO NO AUTORIZADO: El mesero [${mesero}] intentó cobrar sin permisos en el tenant [${tenantId}].`);
                return NextResponse.json({ 
                    ok: false, 
                    error: 'UNAUTHORIZED_ACTION', 
                    message: 'Tu usuario no tiene autorización en el sistema para procesar cobros de dinero.' 
                }, { status: 403 });
            }
        }
        const metodoPagoRaw = payload.metodoPago || 'efectivo';
        const metodoPago = metodoPagoRaw.toLowerCase().trim();
        const totalPagado = Number(payload.totalPagado) || 0;
        const propinaRecaudada = Number(payload.propinaRecaudada) || 0;
        const ordenId = payload.ordenId;
        const tipoOrden = typeof payload.tipoOrden === 'string' ? payload.tipoOrden.trim() : 'mesa';

        // --- 2. FECHAS Y FOLIO (CONSECUTIVO GLOBAL POR TENANT OPTIMIZADO) ---
        // --- 2. FECHAS Y FOLIO (CONSECUTIVO GLOBAL POR TENANT OPTIMIZADO) ---
const now = new Date();
const fechaUTC = now.toISOString();
const fechaLocal = new Date().toLocaleString('sv-SE', { timeZone: 'America/Bogota' });

const datePart = fechaUTC.slice(2, 10).replace(/-/g, ''); // "260625"
const prefix = tenantId.slice(0, 3).toUpperCase(); 

let seed = '';

// 🚀 Forzamos a que SIEMPRE busque el consecutivo numérico en Supabase, ignorando el transaccionId para el folio
const { data: ultimaVenta, error: errUltima } = await supabaseServer
    .from('ventas')
    .select('folio')
    .eq('tenant_id', tenantId)
    .order('fecha_local', { ascending: false })
    .order('folio', { ascending: false })
    .limit(1)
    .maybeSingle();

if (errUltima) {
    console.error('⚠️ Error buscando última venta, paracaídas activado:', errUltima.message);
    seed = crypto.randomBytes(3).toString('hex').toUpperCase(); 
} else if (!ultimaVenta || !ultimaVenta.folio) {
    seed = '000001';
} else {
    // 🧠 BISTURÍ: Extraemos el número final limpiando cualquier carácter extraño o letra de rescate
    // Buscamos la última coincidencia numérica al final del folio
    const matchNumero = ultimaVenta.folio.match(/\d+$/);
    const ultimoNumero = matchNumero ? parseInt(matchNumero[0], 10) : 0;

    if (ultimoNumero === 0) {
        // Si por un fallo catastrófico no había números al final, inicializamos de forma segura
        seed = '000001';
    } else {
        // El consecutivo avanza infinitamente e ignora si la fecha del folio anterior era de ayer
        const siguienteConsecutivo = ultimoNumero + 1;
        seed = String(siguienteConsecutivo).padStart(6, '0'); 
    }
}

const folioGenerado = `${prefix}-${datePart}-${seed}`;
// Mantenemos el transaccionId únicamente para el ID único del registro en la base de datos si existe
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
                precioCosto: Number(p.precioCosto || 0),
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
            const nombreLimpio = item.nombrePlato || item.nombre;
            
            // 🧠 Cruzamos el nombre vendido con la caché recuperada en el paso 4
            const platoMatch = (mapeoSanity || []).find(m => m.nombre === nombreLimpio);
            const costoReal = platoMatch && platoMatch.precioCosto ? platoMatch.precioCosto : Number(item.precioCosto || 0);

            return {
                _key: crypto.randomUUID(),
                _type: 'platoVendidoV2',
                nombrePlato: nombreLimpio,
                cantidad: cantidadFinal,
                precioUnitario: precioFinal,
                precioCosto: Number(costoReal), // 👈 🛡️ ESCUDO MAESTRO: Costo garantizado del Búnker
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
            
            // 🛡️ CONTROL DE CONCURRENCIA MÁXIMA: Si el folio colisionó (Código 23505), regeneramos ID único al vuelo
            if (supabaseError.code === '23505') {
                console.warn('⚠️ Colisión de folio detectada por alta concurrencia. Aplicando paracaídas alfanumérico...');
                const seedRescate = crypto.randomBytes(2).toString('hex').toUpperCase();
                const folioRescate = `${prefix}-${datePart}-C${seedRescate}`;
                
                const { error: errReintento } = await supabaseServer
                    .from('ventas')
                    .insert([{
                        ...payload, // Reutiliza los mismos campos estructurados del insert anterior
                        transaccion_id: `venta-${Date.now()}-${seedRescate}`,
                        folio: folioRescate,
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
                    }]);
                
                if (!errReintento) {
                    console.log(`🎉 Venta salvada exitosamente bajo el folio de emergencia: ${folioRescate}`);
                    return NextResponse.json({ 
                        ok: true, 
                        message: 'Venta registrada (Resolución por concurrencia)',
                        folio: folioRescate
                    }, { status: 201 });
                }
            }
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