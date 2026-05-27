import { NextResponse } from 'next/server';
import { sanityClientServer } from '@/lib/sanity';

export const dynamic = 'force-dynamic';

export async function POST(request) {
    try {
        const body = await request.json();
        const { fechaInicio, fechaFin, pinAdmin, tenantId } = body;
        if (!tenantId) {
        return NextResponse.json({ error: 'Tenant ID no identificado' }, { status: 400 });
        }

        // 🛡️ 1. VALIDACIÓN DE PRIVACIDAD
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

        const inicio = fechaInicio; 
        const fin = fechaFin; 
        
        // 2. QUERY AMPLIADA
        const queryVentas = `*[_type == "venta" && tenant == $tenantId && fechaLocal >= $inicio && fechaLocal <= $fin]{
            "totalPagado": coalesce(totalPagado, 0),
            "propinaRecaudada": coalesce(propinaRecaudada, 0),
            mesero,
            metodoPago,
            detallePagos, 
            platosVendidosV2,
            fechaLocal,
            tipoOrden
        }`;

        const queryGastos = `*[_type == "gasto" && tenant == $tenantId && fecha >= $inicio && fecha <= $fin]{
            "monto": coalesce(monto, 0),
            descripcion,
            fecha
        }`;

        const [ventas, gastos] = await Promise.all([
            sanityClientServer.fetch(queryVentas, { inicio, fin, tenantId }, { useCdn: false }),
            sanityClientServer.fetch(queryGastos, { inicio, fin, tenantId }, { useCdn: false })
        ]);

        // 📊 3. PROCESAMIENTO ESTRATÉGICO PARA FAMA
        const metodosPago = { efectivo: 0, tarjeta: 0, digital: 0 };
        const rankingPlatos = {}; // 🥩 Aquí sumaremos Kilos y Unidades
        const porMesero = {}; 
        const porTipoOrden = { mesa: 0, domicilio: 0, llevar: 0 };
        let totalPropinas = 0;

        ventas?.forEach(v => {
            const ventaNeta = Number(v.totalPagado || 0);
            const propina = Number(v.propinaRecaudada || 0);
            const tipo = (v.tipoOrden || 'mesa').toLowerCase().trim();

            totalPropinas += propina;

            // Tipo de Orden
            if (tipo === 'mesa') porTipoOrden.mesa += ventaNeta;
            else if (tipo === 'domicilio' || tipo === 'domi') porTipoOrden.domicilio += ventaNeta;
            else if (tipo === 'llevar') porTipoOrden.llevar += ventaNeta;
            else porTipoOrden.mesa += ventaNeta;
        
            // Meseros
            const nombreM = v.mesero || "General";
            porMesero[nombreM] = (porMesero[nombreM] || 0) + ventaNeta;

            // 🛡️ MÉTODOS DE PAGO
            if (v.detallePagos && v.detallePagos.length > 0) {
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

            // 🥩 RANKING DE VENTAS (Blindado para decimales)
            v.platosVendidosV2?.forEach(p => {
                const nombre = p.nombrePlato || "Desconocido";
                // Usamos Number() para que 1.500 kg se sume correctamente y no como texto
                const cantidadReal = Number(p.cantidad || 0);
                rankingPlatos[nombre] = (rankingPlatos[nombre] || 0) + cantidadReal;
            });
        });

        const totalVentasSumadas = ventas?.reduce((acc, v) => acc + Number(v.totalPagado || 0), 0) || 0;
        const totalGastosSumados = gastos?.reduce((acc, g) => acc + Number(g.monto || 0), 0) || 0;

        return NextResponse.json({ 
            ventas: ventas || [], 
            gastos: gastos || [],
            ventasTotales: totalVentasSumadas,
            gastosTotales: totalGastosSumados,
            porMesero,
            porTipoOrden,
            estadisticas: {
                metodosPago,
                totalPropinas,
                // El Top 5 ahora es real: muestra lo más vendido por volumen (kilos o unidades)
                topPlatos: Object.entries(rankingPlatos)
                .filter(([nombre]) => {
            const n = nombre.toUpperCase();
            // Si el nombre contiene "MERMA" o "Z_MERMA", no entra al Top 5
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