import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0; 
export const fetchCache = 'force-no-store';

export async function POST(request) {
    try {
        const body = await request.json();
        const { fechaSeleccionada, tenantId, fechaFin } = body; 
        
        if (!tenantId) {
            return NextResponse.json({ error: 'Tenant ID es obligatorio' }, { status: 400 });
        }
        if (!fechaSeleccionada) {
            return NextResponse.json({ error: 'Falta la fecha inicial' }, { status: 400 });
        }

        const inicioFiltro = `${fechaSeleccionada} 00:00:00`;
        const finFiltro = fechaFin ? `${fechaFin} 23:59:59` : `${fechaSeleccionada} 23:59:59`;

        // 📡 CONSULTA SENIOR COMPUESTA EN PARALELO
        // Llamamos al RPC de totales (fuente de verdad) y traemos TODAS las filas pidiendo 
        // únicamente las columnas esenciales. Al no pedir el '*' pesado, Supabase transmite los miles de registros sin problemas.
        const [resRpc, resVentasRaw] = await Promise.all([
            supabaseServer.rpc('obtener_totales_reporte', {
                p_tenant_id: tenantId,
                p_fecha_inicio: inicioFiltro,
                p_fecha_fin: finFiltro
            }),
            supabaseServer
                .from('ventas')
                .select('folio, mesa, mesero, datos_entrega, total_pagado, propina_recaudada, pago_efectivo, pago_tarjeta, pago_digital, metodo_pago, detalle_pagos, platos_vendidos, fecha_local')
                .eq('tenant_id', tenantId)
                .eq('activo', true)
                .gte('fecha_local', inicioFiltro) 
                .lte('fecha_local', finFiltro)
        ]);

        if (resRpc.error) throw new Error(`RPC Totales Cierre error: ${resRpc.error.message}`);
        if (resVentasRaw.error) throw new Error(`Historial Ventas db error: ${resVentasRaw.error.message}`); // 👈 CORREGIDO: resVentasRaw

        const rpcData = resRpc.data?.[0] || resRpc.data || {};
        
        // 🛡️ VERDAD ABSOLUTA DE BASE DE DATOS (Lo que dice el RPC va a misa)
        const totalVentasSumadas = Number(rpcData.ventas_totales || 0);
        const totalPropinasReal = Number(rpcData.propinas_totales || 0);
        const metodosPagoSincronizados = {
            efectivo: Number(rpcData.efectivo_total || 0),
            tarjeta: Number(rpcData.tarjeta_total || 0),
            digital: Number(rpcData.digital_total || 0)
        };

        // Extraemos las estructuras JSON relacionales mapeadas por Postgres para el Excel
        const productosRfc = rpcData.productos_json || {};
        const preciosRfc = rpcData.precios_json || {};
        const costosRfc = rpcData.precios_costo_json || {};
        const unidadesRfc = rpcData.unidades_json || {};

        const ventasRaw = resVentasRaw.data || [];
        // Mapeamos el 100% de las ventas extraídas para que el bucle del hook procese el inventario completo
        const ventas = ventasRaw.map(v => ({
            folio: v.folio,
            mesa: v.mesa,
            mesero: v.mesero,
            datosEntrega: v.datos_entrega,
            totalPagado: Number(v.total_pagado || 0), 
            propinaRecaudada: Number(v.propina_recaudada || 0),
            metodoPago: v.metodo_pago,
            detallePagos: v.detalle_pagos, 
            platosVendidosV2: v.platos_vendidos,
            pagoEfectivo: Number(v.pago_efectivo || 0),
            pagoTarjeta: Number(v.pago_tarjeta || 0),
            pagoDigital: Number(v.pago_digital || 0),
            fechaLocal: v.fecha_local
        }));

        // Empaquetamos la respuesta estructurada acoplando las realidades sin límite de PostgREST
        return NextResponse.json({
            listaVentas: ventas, 
            metaTotales: {
                ventasTotales: totalVentasSumadas,
                propinasTotales: totalPropinasReal,
                metodosPago: metodosPagoSincronizados
            },
            inventarioConsolidado: {
                productos: productosRfc,
                precios: preciosRfc,
                preciosCosto: costosRfc,
                unidadesMedida: unidadesRfc
            }
        });
    } catch (error) {
        console.error('[HISTORIAL_VENTAS_ERROR]:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}