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

        // 🗺️ CONTROL DE RANGO INTELIGENTE
        // Si el frontend envía fechaFin (rango), la usamos. Si no, asumimos que busca solo ese día.
        const inicioFiltro = `${fechaSeleccionada} 00:00:00`;
        const finFiltro = fechaFin ? `${fechaFin} 23:59:59` : `${fechaSeleccionada} 23:59:59`;

        // 📡 CONSULTA DE RANGO SOBRE TEXTO LOCAL
        const { data: ventasRaw, error: supabaseError } = await supabaseServer
            .from('ventas')
            .select('*')
            .eq('tenant_id', tenantId)
            .gte('fecha_local', inicioFiltro) // Mayor o igual al inicio del rango
            .lte('fecha_local', finFiltro)    // Menor o igual al fin del rango
            .order('fecha_local', { ascending: false });

        if (supabaseError) {
            console.error('❌ Error leyendo historial de Supabase:', supabaseError.message);
            throw new Error(`SUPABASE_FETCH_FAILED: ${supabaseError.message}`);
        }

        // ✅ ADAPTACIÓN MÁXIMA: Formato exacto para tu UI
        // ✅ ADAPTACIÓN MÁXIMA: Formato exacto para tu UI con desgloses planos y neto limpio
const ventas = (ventasRaw || []).map(v => ({
    _id: v.transaccion_id,
    folio: v.folio,
    mesa: v.mesa,
    mesero: v.mesero,
    metodoPago: v.metodo_pago,
    // 🛡️ BISTURÍ 1: Dejamos total_pagado puro (solo comida) para que el reporte no duplique la propina abajo
    totalPagado: Number(v.total_pagado || 0), 
    propinaRecaudada: Number(v.propina_recaudada || 0),
    fechaLocal: v.fecha_local,
    platosVendidosV2: v.platos_vendidos, 
    tipoOrden: v.tipo_orden,
    datosEntrega: v.datos_entrega,
    
    // 🛡️ BISTURÍ 2: Exponemos las columnas independientes (forzando conversión numérica limpia)
    pagoEfectivo: Number(v.pago_efectivo || 0),
    pagoTarjeta: Number(v.pago_tarjeta || 0),
    pagoDigital: Number(v.pago_digital || 0)
}));
        return NextResponse.json(ventas);
    } catch (error) {
        console.error('[HISTORIAL_VENTAS_ERROR]:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}