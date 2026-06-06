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

        // 🛡️ 1. VALIDACIÓN DE PRIVACIDAD DESDE SANITY (Echematype estático)
        const seguridad = await sanityClientServer.fetch(
            `*[_type == "seguridad" && tenant == $tenantId][0]{ pinAdmin }`,
            { tenantId }, 
            { useCdn: false }
        );

        const PIN_ADMIN_REAL = seguridad?.pinAdmin || process.env.PIN_ADMIN;

        if (!pinAdmin || pinAdmin !== PIN_ADMIN_REAL) {
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

        // 2. 📡 CONSULTA PARALELA DE ALTA VELOCIDAD EN SUPABASE
        const [resVentas, resGastos] = await Promise.all([
            supabaseServer
                .from('ventas')
                .select('*')
                .eq('tenant_id', tenantId)
                .gte('fecha_local', fechaInicio)
                .lte('fecha_local', fechaFin),
            supabaseServer
                .from('gastos')
                .select('*')
                .eq('tenant_id', tenantId)
                .gte('created_at', new Date(fechaInicio).toISOString())
                .lte('created_at', new Date(fechaFin).toISOString())
        ]);

        if (resVentas.error) throw new Error(`Ventas db error: ${resVentas.error.message}`);
        if (resGastos.error) throw new Error(`Gastos db error: ${resGastos.error.message}`);

        const ventasRaw = resVentas.data || [];
        const gastosRaw = resGastos.data || [];

        // Mapeamos las ventas de Supabase al formato exacto que espera tu algoritmo de procesamiento
        const ventas = ventasRaw.map(v => ({
            totalPagado: Number(v.total_pagado || 0),
            propinaRecaudada: Number(v.propina_recaudada || 0),
            mesero: v.mesero,
            metodoPago: v.metodo_pago,
            detallePagos: v.detalle_pago || v.detalle_pagos, 
            platosVendidosV2: v.platos_vendidos,
            fechaLocal: v.fecha_local,
            tipoOrden: v.tipo_orden
        }));

        // Mapeamos los gastos de Supabase
        const gastos = gastosRaw.map(g => ({
            monto: Number(g.monto || 0),
            descripcion: g.descripcion,
            fecha: g.created_at
        }));

        // 📊 3. PROCESAMIENTO ESTRATÉGICO TOTALMENTE PRESERVADO
        const metodosPago = { efectivo: 0, tarjeta: 0, digital: 0 };
        const rankingPlatos = {}; 
        const porMesero = {}; 
        const porTipoOrden = { mesa: 0, domicilio: 0, llevar: 0 };
        let totalPropinas = 0;

        ventas.forEach(v => {
            const ventaNeta = Number(v.totalPagado || 0);
            const propina = Number(v.propinaRecaudada || 0);
            const tipo = (v.tipoOrden || 'mesa').toLowerCase().trim();

            totalPropinas += propina;

            // Tipo de Orden
            if (tipo === 'mesa') porTipoOrden.mesa += ventaNeta;
            else if (tipo === 'domicilio' || tipo === 'domi' || tipo === 'domicilios') porTipoOrden.domicilio += ventaNeta;
            else if (tipo === 'llevar') porTipoOrden.llevar += ventaNeta;
            else porTipoOrden.mesa += ventaNeta;
        
            // Meseros
            const nombreM = v.mesero || "General";
             porMesero[nombreM] = (porMesero[nombreM] || 0) + ventaNeta;

            // 🛡️ MÉTODOS DE PAGO
            if (v.detallePagos && Array.isArray(v.detallePagos) && v.detallePagos.length > 0) {
                v.detallePagos.forEach(p => {
                    const m = (p.metodo || 'efectivo').toLowerCase();
                    const montoP = Number(p.monto || 0);
                    if (m.includes('tarjeta')) metodosPago.tarjeta += montoP;
                    else if (m.includes('nequi') || m.includes('daviplata') || m.includes('digital') || m.includes('transferencia')) metodosPago.digital += montoP;
                    else metodosPago.efectivo += montoP;
                });
            } else {
                const montoTotal = ventaNeta + propina;
                const metodo = (v.metodoPago || 'efectivo').toLowerCase();
                if (metodo.includes('tarjeta')) metodosPago.tarjeta += montoTotal;
                else if (metodo.includes('nequi') || metodo.includes('daviplata') || metodo.includes('digital') || metodo.includes('transferencia')) metodosPago.digital += montoTotal;
                else metodosPago.efectivo += montoTotal;
            }

            // 🥩 RANKING DE VENTAS (Kilos y Unidades)
            v.platosVendidosV2?.forEach(p => {
                const nombre = p.nombrePlato || "Desconocido";
                const cantidadReal = Number(p.cantidad || 0);
                rankingPlatos[nombre] = (rankingPlatos[nombre] || 0) + cantidadReal;
            });
        });

        const totalVentasSumadas = ventas.reduce((acc, v) => acc + Number(v.totalPagado || 0), 0);
        const totalGastosSumados = gastos.reduce((acc, g) => acc + Number(g.monto || 0), 0);

        return NextResponse.json({ 
            ventas, 
            gastos,
            ventasTotales: totalVentasSumadas,
            gastosTotales: totalGastosSumados,
            porMesero,
            porTipoOrden,
            estadisticas: {
                metodosPago,
                totalPropinas,
                topPlatos: Object.entries(rankingPlatos)
                    .filter(([nombre]) => {
                        const n = nombre.toUpperCase();
                        return !n.includes('MERMA') && !n.includes('DESPERDICIO');
                    })
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 5)
                    .map(([nombre, cant]) => ({
                        nombre,
                        cantidad: Number(cant) % 1 !== 0 ? cant.toFixed(3) : cant
                    }))
            }
        });

    } catch (error) {
        console.error('[REPORT_API_ERROR]:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}