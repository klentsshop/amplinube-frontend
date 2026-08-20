import { NextResponse } from 'next/server';
import { sanityClientServer } from '@/lib/sanity';
import { supabaseServer } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(request) {
    try {
        const body = await request.json();
        const { fechaInicio, fechaFin, pinAdmin, tenantId } = body;
        
        if (!tenantId) {
            return NextResponse.json({ error: 'Tenant ID no identificado' }, { status: 400 });
        }

        // 🛡️ 1. VALIDACIÓN DIRECTA Y PRIVADA DE PIN ADMIN (Sanity + Backup ENV)
        let PIN_ADMIN_REAL = process.env.PIN_ADMIN;
        let catalogoPlatosLocal = []; 

        try {
            // A. Extraemos el PIN Admin real de forma privada en servidor desde Sanity
            const docSeguridad = await sanityClientServer.fetch(
                `*[_type == "seguridad" && tenant == $tenantId][0]{ pinAdmin }`,
                { tenantId: tenantId.toLowerCase().trim() }
            );

            if (docSeguridad?.pinAdmin) {
                PIN_ADMIN_REAL = String(docSeguridad.pinAdmin).trim();
            }

            // B. Para la lista de platos, seguimos aprovechando la caché ultrarrápida de Supabase
            const { data: configNegocio } = await supabaseServer
                .from('catalog_cache')
                .select('payload_json')
                .eq('tenant_host', tenantId.toLowerCase().trim())
                .maybeSingle();

            const rawPayload = configNegocio?.payload_json;
            if (Array.isArray(rawPayload)) {
                catalogoPlatosLocal = rawPayload.filter(item => item?._type === 'plato');
            } else if (rawPayload) {
                catalogoPlatosLocal = rawPayload.plato || rawPayload.platos || [];
            }
        } catch (dbError) {
            console.warn("⚠️ Error leyendo credenciales/platos, usando fallback por defecto:", dbError.message);
        }

        if (!pinAdmin || String(pinAdmin).trim() !== String(PIN_ADMIN_REAL).trim()) {
            return NextResponse.json(
                { error: '⚠️ No autorizado. PIN administrativo incorrecto.' },
                { status: 401 }
            );
        }
        if (!fechaInicio || !fechaFin) {
            return NextResponse.json(
                { error: 'Faltan rangos de fecha' },
                { status: 400 }
            );
        }

        // 2. 📡 CONSULTA PARALELA: NUEVO RPC COMPLETO + TRANSACCIONES PARA RANKINGS
        const stringInicioLimpio = String(fechaInicio).split(' ')[0].trim(); 
        const stringFinLimpio = String(fechaFin).split(' ')[0].trim();

        const [resTotalesRpc, resVentasDetalle, resGastos] = await Promise.all([
            supabaseServer.rpc('obtener_totales_reporte', {
                p_tenant_id: tenantId,
                p_fecha_inicio: `${stringInicioLimpio} 00:00:00`,
                p_fecha_fin: `${stringFinLimpio} 23:59:59`
            }),
            supabaseServer
                .from('ventas')
                .select('mesero, metodo_pago, detalle_pagos, platos_vendidos, tipo_orden, total_pagado, propina_recaudada, fecha_local')
                .eq('tenant_id', tenantId)
                .eq('activo', true)
                .gte('fecha_local', `${stringInicioLimpio} 00:00:00`)
                .lte('fecha_local', `${stringFinLimpio} 23:59:59`),
            supabaseServer
                .from('gastos')
                .select('*')
                .eq('tenant_id', tenantId)
                .gte('created_at', `${stringInicioLimpio}T00:00:00.000Z`)
                .lte('created_at', `${stringFinLimpio}T23:59:59.999Z`)
        ]);
if (resTotalesRpc.error) throw new Error(`RPC Totales error: ${resTotalesRpc.error.message}`);
        if (resVentasDetalle.error) throw new Error(`Ventas db error: ${resVentasDetalle.error.message}`);
        if (resGastos.error) throw new Error(`Gastos db error: ${resGastos.error.message}`);

        // Extraemos los datos del RPC unificado absoluto (14 columnas)
        const rpcData = resTotalesRpc.data?.[0] || resTotalesRpc.data || {};
        const totalVentasSumadas = Number(rpcData.ventas_totales || 0);
        const totalPropinasReal = Number(rpcData.propinas_totales || 0);
        const totalGastosRealRpc = Number(rpcData.gastos_totales || 0);
        const listaGastosRpc = Array.isArray(rpcData.gastos_json) ? rpcData.gastos_json : [];

        const metodosPagoSincronizados = {
            efectivo: Number(rpcData.efectivo_total || 0),
            tarjeta: Number(rpcData.tarjeta_total || 0),
            digital: Number(rpcData.digital_total || 0)
        };

        const porTipoOrdenSincronizado = {
            mesa: Number(rpcData.canal_mesa || 0),
            domicilio: Number(rpcData.canal_domicilio || 0),
            llevar: Number(rpcData.canal_llevar || 0)
        };

        const productosRfc = rpcData.productos_json || {};
        const preciosRfc = rpcData.precios_json || {};
        const costosRfc = rpcData.precios_costo_json || {};

        const ventasRaw = resVentasDetalle.data || [];
        const gastosRaw = resGastos.data || []; // 👈 INYECCIÓN MAESTRA: Saneamos la referencia para que no sea undefined
        // Mapeamos las ventas manteniendo la consistencia de datos limpios
        const ventas = ventasRaw.map(v => ({
            totalPagado: Number(v.total_pagado || 0),
            propinaRecaudada: Number(v.propina_recaudada || 0),
            mesero: v.mesero,
            metodoPago: v.metodo_pago,
            detallePagos: v.detalle_pagos, 
            platosVendidosV2: v.platos_vendidos,
            fechaLocal: v.fecha_local,
            tipoOrden: v.tipo_orden
        }));

        // Si el select normal de gastos truncó datos, usamos la lista íntegra comprimida por Postgres
        const fuenteGastos = listaGastosRpc.length > gastosRaw.length ? listaGastosRpc : gastosRaw;

        const gastos = fuenteGastos.map(g => ({
            monto: Number(g.monto || 0),
            descripcion: g.descripcion,
            fecha: g.created_at || g.fecha
        }));

        const totalGastosSumados = listaGastosRpc.length > gastosRaw.length ? totalGastosRealRpc : gastos.reduce((acc, g) => acc + Number(g.monto || 0), 0);

        // 📊 3. PROCESAMIENTO EXCLUSIVO DE RANKINGS
        const rankingPlatos = {}; 
        const porMesero = {}; 
        const precios = {};
        const preciosCosto = {};
        const catalogoPlatos = catalogoPlatosLocal;

        ventas.forEach(v => {
            // Mantenemos el conteo relativo por vendedor en la muestra
            const nombreM = v.mesero || "General";
            porMesero[nombreM] = (porMesero[nombreM] || 0) + Number(v.totalPagado || 0);

            v.platosVendidosV2?.forEach(p => {
                const nombre = (p.nombrePlato || p.nombre || "Desconocido").toUpperCase().trim();
                const cantidadReal = Number(p.cantidad || 0);
                const precioU = Number(p.precioUnitario || p.precioNum || p.precio || 0);
                const subtotalReal = Number(p.subtotal || (precioU * cantidadReal));

                const claveUnica = `${nombre}_${precioU}`;

                if (!rankingPlatos[claveUnica]) {
                    rankingPlatos[claveUnica] = {
                        nombre: nombre,
                        precioUnitario: precioU,
                        cantidad: 0,
                        subtotal: 0
                    };
                }

                rankingPlatos[claveUnica].cantidad += cantidadReal;
                rankingPlatos[claveUnica].subtotal += subtotalReal;

                if (!precios[claveUnica]) {
                    precios[claveUnica] = precioU;
                    // 🛡️ BISTURÍ: Coincidencia por plato_id (UUID v4) con fallback a Nombre Legible
                    const platoIdReal = p.plato_id || p._id;
                    const matchPlato = catalogoPlatos.find(item => 
                        (platoIdReal && (item._id === platoIdReal || item.id === platoIdReal)) ||
                        (item.nombre || "").toUpperCase().trim() === nombre
                    );
                    if (matchPlato && matchPlato.precioCosto && Number(matchPlato.precioCosto) > 0) {
                        preciosCosto[claveUnica] = Number(matchPlato.precioCosto);
                    }
                }
            });
        });

        // 🛡️ SIN PARACHES: Como el hook recorre ventas en un .forEach para sumar las ventasTotales de la UI, 
        // le vaciamos el array de la muestra y le inyectamos una única transaccionalidad limpia 
        // con la estructura exacta desglosada del RPC. Cero cálculos flotantes erróneos en el cliente.
        const ventasLimpiasParaUI = [{
            totalPagado: totalVentasSumadas,
            propinaRecaudada: totalPropinasReal,
            mesero: "Caja",
            tipoOrden: "mesa"
        }];

        // Sincronizamos el ranking de vendedores basado en la verdad de la base de datos si solo opera Caja
        if (Object.keys(porMesero).length <= 1) {
            porMesero["Caja"] = totalVentasSumadas;
        }

        return NextResponse.json({ 
            ventas: ventasLimpiasParaUI, 
            gastos: gastos, 
            ventasTotales: totalVentasSumadas,
            gastosTotales: totalGastosSumados,
            totalPropinas: totalPropinasReal,
            porMesero,
            porTipoOrden: porTipoOrdenSincronizado,
            // Si el mapeo local truncó datos por red, usamos el diccionario completo de Postgres
            precios: Object.keys(preciosRfc).length > 0 ? preciosRfc : precios,
            preciosCosto: Object.keys(costosRfc).length > 0 ? costosRfc : preciosCosto,
            productos: Object.keys(productosRfc).length > 0 ? productosRfc : Object.keys(rankingPlatos).reduce((acc, key) => {
                acc[key] = rankingPlatos[key].cantidad;
                return acc;
            }, {}),
            // 📊 REESTRUCTURACIÓN DE NIVEL SENIOR PARA LA UI
            estadisticas: {
                metodosPago: metodosPagoSincronizados, // 👈 Sincronizado directo con la verdad de los 27M de Postgres
                totalPropinas: totalPropinasReal,
                topPlatos: (() => {
                    // Si el RPC trajo datos, armamos el ranking real basado en el 100% de la data de Postgres
                    const usaRfc = Object.keys(productosRfc).length > 0;
                    const origenPlatos = usaRfc ? productosRfc : rankingPlatos;

                    return Object.keys(origenPlatos)
                        .map(key => {
                            if (usaRfc) {
                                const nombre = key.split('_')[0] || 'Desconocido';
                                const precioU = Number(preciosRfc[key] || 0);
                                const cantidad = Number(productosRfc[key] || 0);
                                return { nombre, precioUnitario: precioU, cantidad, subtotal: precioU * cantidad };
                            } else {
                                return {
                                    nombre: rankingPlatos[key].nombre,
                                    precioUnitario: rankingPlatos[key].precioUnitario,
                                    cantidad: rankingPlatos[key].cantidad,
                                    subtotal: rankingPlatos[key].subtotal
                                };
                            }
                        })
                        .filter((plato) => {
                            const n = (plato.nombre || '').toUpperCase();
                            return !n.includes('MERMA') && !n.includes('DESPERDICIO');
                        })
                        .sort((a, b) => b.subtotal - a.subtotal)
                        .slice(0, 5)
                        .map((plato) => ({
                            nombre: plato.nombre,
                            precioUnitario: plato.precioUnitario,
                            subtotal: plato.subtotal,
                            cantidad: Number(plato.cantidad) % 1 !== 0 ? Number(plato.cantidad).toFixed(3) : Number(plato.cantidad)
                        }));
                })()
            }
        });

    } catch (error) {
        console.error('[REPORT_API_ERROR]:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}