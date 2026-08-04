import { NextResponse } from 'next/server';
import { sanityClientServer } from '@/lib/sanity';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
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
        
        // 🛡️ BISTURÍ: Declaración segura de la constante limpia para queries de Supabase
        const cleanTenant = tenantId.toLowerCase().trim();
        
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
        
        // --- 3. 🛡️ ESCUDO ANTI-FANTASMAS (EL BLOQUEO MAESTRO EN SUPABASE) ---
        if (ordenId && ordenId !== "undefined" && ordenId !== "null") {
            const { data: mesaExiste, error: errCheckMesa } = await supabaseServer
                .from('ordenes_activas')
                .select('id')
                .eq('id', ordenId)
                .eq('tenant', cleanTenant)
                .maybeSingle();
            
            if (errCheckMesa || !mesaExiste) {
                console.warn(`⚠️ Cobro duplicado evitado o mesa inexistente en Supabase: ${ordenId}`);
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
        // --- 4. 🚀 BÚSQUEDA DE PLATOS Y RECETAS DIRECTAS EN TABLAS DE SUPABASE ---
        const nombresPlatos = (payload.platosVendidosV2 || []).map(item => item.nombrePlato || item.nombre);
        let mapeoPlatosRecetas = [];

        try {
            // 1. Obtener los platos vendidos y sus IDs relacionales
            const { data: platosDb } = await supabaseServer
                .from('platos')
                .select('id, nombre, precio_costo, controla_inventario')
                .eq('tenant', cleanTenant)
                .in('nombre', nombresPlatos);

            if (Array.isArray(platosDb) && platosDb.length > 0) {
                const platoIds = platosDb.map(p => p.id);

                // 2. Traer las recetas asociadas desde public.recetas (Tabla Pivote)
                const { data: recetasDb } = await supabaseServer
                    .from('recetas')
                    .select('plato_id, insumo_id, cantidad')
                    .eq('tenant', cleanTenant)
                    .in('plato_id', platoIds);

                const recetasGrupales = recetasDb || [];

                // 3. Mapear estructura
                mapeoPlatosRecetas = platosDb.map(p => ({
                    id: p.id,
                    nombre: p.nombre,
                    precioCosto: Number(p.precio_costo || 0),
                    controlaInventario: p.controla_inventario === true,
                    recetas: recetasGrupales.filter(r => r.plato_id === p.id)
                }));
            }
        } catch (dbError) {
            console.error("⚠️ Error consultando recetas relacionales en Supabase:", dbError.message);
        }

        // --- 5. MAPEO DE PLATOS PARA LA VENTA Y CÁLCULO DE DESCUENTOS ---
        const descuentosSupabase = [];

        const platosVenta = (payload.platosVendidosV2 || []).map(item => {
            const precioFinal = Number(item.precioUnitario || item.precioNum || item.precio) || 0;
            const cantidadFinal = Number(item.cantidad) || 1;
            const nombreLimpio = item.nombrePlato || item.nombre;
            
            // Cruzar con la consulta relacional de Supabase
            const platoMatch = (mapeoPlatosRecetas || []).find(m => m.nombre === nombreLimpio);
            const costoReal = platoMatch ? platoMatch.precioCosto : Number(item.precioCosto || 0);

            // Si el plato controla inventario, acumular sus descuentos de la tabla pivote public.recetas
            if (platoMatch && platoMatch.controlaInventario && Array.isArray(platoMatch.recetas)) {
                platoMatch.recetas.forEach(recetaItem => {
                    if (recetaItem.insumo_id) {
                        const montoADescontar = (Number(recetaItem.cantidad) || 1) * cantidadFinal;
                        descuentosSupabase.push({
                            insumo_id: recetaItem.insumo_id, // UUID directo de public.inventarios
                            cantidad: montoADescontar
                        });
                    }
                });
            }

            return {
                _key: crypto.randomUUID(),
                _type: 'platoVendidoV2',
                nombrePlato: nombreLimpio,
                cantidad: cantidadFinal,
                precioUnitario: precioFinal,
                precioCosto: Number(costoReal),
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
        // ==========================================================
        // 🚀 EJECUCIÓN 100% ATÓMICA EN POSTGRESQL (RPC ÚNICA)
        // ==========================================================
        const objetoVentaDb = {
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
        };

        const { data: resAtomica, error: errAtomico } = await supabaseServer.rpc('procesar_venta_atomica', {
            p_venta_data: objetoVentaDb,
            p_orden_id: ordenId || null,
            p_abrir_cajon: abrirCajon,
            p_descuentos: descuentosSupabase
        });

        if (errAtomico) {
            console.error('❌ Fallo en la transacción atómica de venta:', errAtomico.message);
            throw new Error(`TRANSACCION_FALLIDA: ${errAtomico.message}`);
        }

        console.log(`⚡ [VENTA ATÓMICA EXITOSA]: Folio ${folioGenerado} guardado e inventario descontado en <50ms.`);
          
        // 🎉 Retorno limpio al frontend de Next.js
        return NextResponse.json({ 
            ok: true, 
            message: 'Venta registrada e Inventario actualizado en Supabase',
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