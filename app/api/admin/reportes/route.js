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
        // 🛡️ 1. VALIDACIÓN DESDE EL ESCUDO DE SUPABASE (Zero llamadas a Sanity)
        let PIN_ADMIN_REAL = process.env.PIN_ADMIN;

        let catalogoPlatosLocal = []; // 🛡️ Variable local segura por petición

        try {
            const { data: configNegocio } = await supabaseServer
                .from('catalog_cache')
                .select('payload_json')
                .eq('tenant_host', tenantId.toLowerCase().trim())
                .single();

            const rawPayload = configNegocio?.payload_json;
            let pinDesdeEscudo = null;

            if (Array.isArray(rawPayload)) {
                catalogoPlatosLocal = rawPayload.filter(item => item?._type === 'plato');
                const docSeguridad = rawPayload.find(item => item?._type === 'seguridad');
                if (docSeguridad) pinDesdeEscudo = docSeguridad.pinAdmin;
            } else if (rawPayload) {
                catalogoPlatosLocal = rawPayload.plato || rawPayload.platos || [];
                pinDesdeEscudo = rawPayload.seguridad?.pinAdmin || rawPayload.configSeguridad?.pinAdmin || rawPayload.pinAdmin;
            }

            if (pinDesdeEscudo) PIN_ADMIN_REAL = String(pinDesdeEscudo).trim();
        } catch (dbError) {
            console.warn("⚠️ No se pudo leer el PIN desde el Escudo, usando variable de entorno de respaldo.");
        }
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
       // 2. 📡 CONSULTA PARALELA DE ALTA VELOCIDAD EN SUPABASE
        // 🛡️ LUPA SENIOR: Limpiamos los posibles remanentes de horas duplicadas para evitar romper el formato TIMESTAMPTZ de Postgres
        const stringInicioLimpio = String(fechaInicio).split(' ')[0].trim(); // Extrae solo "YYYY-MM-DD"
        const stringFinLimpio = String(fechaFin).split(' ')[0].trim();

        const [resVentas, resGastos] = await Promise.all([
            supabaseServer
                .from('ventas')
                .select('*')
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
        const precios = {};
        const preciosCosto = {};
        let totalPropinas = 0;

        const catalogoPlatos = catalogoPlatosLocal;

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
                const metodo = (v.metodoPago || 'efectivo').toLowerCase();
                if (metodo.includes('tarjeta')) metodosPago.tarjeta += ventaNeta;
                else if (metodo.includes('nequi') || metodo.includes('daviplata') || metodo.includes('digital') || metodo.includes('transferencia')) metodosPago.digital += ventaNeta;
                else metodosPago.efectivo += ventaNeta;
            }

           // ✅ CÓDIGO NUEVO BLINDADO (Cirugía Senior):
v.platosVendidosV2?.forEach(p => {
    const nombre = (p.nombrePlato || p.nombre || "Desconocido").toUpperCase().trim();
    const cantidadReal = Number(p.cantidad || 0);
    const precioU = Number(p.precioUnitario || p.precioNum || p.precio || 0);
    
    // Extraemos el subtotal real cobrado en el ticket, si no viene lo calculamos limpio
    const subtotalReal = Number(p.subtotal || (precioU * cantidadReal));

    // 🛡️ BISTURÍ: Estructuramos la clave combinada única por variación de precio
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

            // 🧠 ACOPLAMIENTO DE COSTOS (Respetando opcionalidad limpia)
            if (!precios[claveUnica]) {
                precios[claveUnica] = precioU;
                const matchPlato = catalogoPlatos.find(item => (item.nombre || "").toUpperCase().trim() === nombre);
                if (matchPlato && matchPlato.precioCosto && Number(matchPlato.precioCosto) > 0) {
                    preciosCosto[claveUnica] = Number(matchPlato.precioCosto);
                }
            }
        })
        });

        const totalVentasSumadas = ventas.reduce((acc, v) => acc + Number(v.totalPagado || 0), 0);
        const totalGastosSumados = gastos.reduce((acc, g) => acc + Number(g.monto || 0), 0);

        return NextResponse.json({ 
            ventas: ventas, // 👈 🛡️ BISTURÍ: Mapeamos el array de objetos procesados para el .forEach del frontend
            gastos: gastos, // 👈 🛡️ BISTURÍ: Mapeamos el array de objetos procesados de gastos
            ventasTotales: totalVentasSumadas,
            gastosTotales: totalGastosSumados,
            totalPropinas,
            porMesero,
            porTipoOrden,
            precios,
            preciosCosto,
            productos: Object.keys(rankingPlatos).reduce((acc, key) => {
                acc[key] = rankingPlatos[key].cantidad;
                return acc;
            }, {}),
            estadisticas: {
                metodosPago,
                totalPropinas,
                topPlatos: Object.values(rankingPlatos)
                    .filter((plato) => {
                        const n = plato.nombre.toUpperCase();
                        return !n.includes('MERMA') && !n.includes('DESPERDICIO');
                    })
                    .sort((a, b) => b.subtotal - a.subtotal)
                    .slice(0, 5)
                    .map((plato) => ({
                        nombre: plato.nombre,
                        precioUnitario: plato.precioUnitario,
                        subtotal: plato.subtotal,
                        cantidad: Number(plato.cantidad) % 1 !== 0 ? Number(plato.cantidad).toFixed(3) : Number(plato.cantidad)
                    }))
            }
        });

    } catch (error) {
        console.error('[REPORT_API_ERROR]:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}