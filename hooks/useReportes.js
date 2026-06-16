import { useState } from 'react';

export function useReportes(getFechaBogota, tenantId) {
    const [mostrarReporte, setMostrarReporte] = useState(false);
    const [datosReporte, setDatosReporte] = useState({
        ventas: 0,
        totalPropinas: 0,
        gastos: 0,
        productos: {},
        unidadesMedida: {} // 🥩 Nuevo: Para rastrear qué es KG y qué es Und
    });
    const [cargandoReporte, setCargandoReporte] = useState(false);
    const [fechaInicioReporte, setFechaInicioReporte] = useState(getFechaBogota());
    const [fechaFinReporte, setFechaFinReporte] = useState(getFechaBogota());
    const [listaGastosDetallada, setListaGastosDetallada] = useState([]);

    const [mostrarAdmin, setMostrarAdmin] = useState(false);
    const [reporteAdmin, setReporteAdmin] = useState({
        ventasTotales: 0,
        porMesero: {},
        gastos: 0,
        estadisticas: {
            metodosPago: { efectivo: 0, tarjeta: 0, digital: 0 },
            topPlatos: [],
            totalPropinas: 0
        }
    });
    const [cargandoAdmin, setCargandoAdmin] = useState(false);
    const [fechaInicioFiltro, setFechaInicioFiltro] = useState(getFechaBogota());
    const [fechaFinFiltro, setFechaFinFiltro] = useState(getFechaBogota());
    const [pinMemoria, setPinMemoria] = useState(null);

    // ================================================================
    // 📊 1. CIERRE DE DÍA (CAJA RÁPIDA) - VERSIÓN FAMA BLINDADA
    // ================================================================
    const generarCierreDia = async () => {
        setCargandoReporte(true);
        setMostrarReporte(true);
        try {
            const inicio = `${fechaInicioReporte} 00:00:00`;
            const fin = `${fechaFinReporte} 23:59:59`;

           const [resVentas, resGastos] = await Promise.all([
                fetch(`/api/ventas/historial`, { 
                    method: 'POST', 
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ fechaSeleccionada: fechaInicioReporte, fechaFin: fechaFinReporte, tenantId }) 
                }),
                // ↩️ Volvemos a tu ruta original con el tenantId en la URL
                fetch(`/api/gastos?tenantId=${tenantId}&inicio=${encodeURIComponent(inicio)}&fin=${encodeURIComponent(fin)}`, { 
                    method: 'GET'
                })
            ]);

            if (!resVentas.ok || !resGastos.ok) {
                throw new Error("No se pudo obtener la información financiera de Supabase.");
            }

            const ventas = await resVentas.json();
            const gastos = await resGastos.json();

            let totalVentasNetas = 0;
            let totalPropinas = 0;
            let productos = {};
            let preciosParaExcel = {};
            let preciosCostoParaExcel = {};
            let unidadesMedida = {}; // 🥩 Rastreador de tipos (Kg vs Und)
            let metodos = { efectivo: 0, tarjeta: 0, digital: 0 };

            ventas.forEach(v => {
                const ventaNeta = Number(v.totalPagado || 0); // Ya viene limpio sin propina duplicada
                const propina = Number(v.propinaRecaudada || 0);

                totalVentasNetas += ventaNeta;
                totalPropinas += propina;

                // ================================================================
                // 🛡️ REGLA CONTABLE RE-BLINDADA: SUMATORIA DIRECTA POR COLUMNAS
                // Prioridad absoluta a pagoEfectivo, pagoTarjeta y pagoDigital que vienen de Supabase
                // Se descuenta la propina para que el desglose coincida exactamente con las Ventas Netas
                // ================================================================
                if (v.pagoEfectivo > 0 || v.pagoTarjeta > 0 || v.pagoDigital > 0) {
                    let ef = v.pagoEfectivo || 0;
                    let tj = v.pagoTarjeta || 0;
                    let dg = v.pagoDigital || 0;
                    let propinaRestante = propina;

                    // Descontamos la propina del efectivo si existe
                    if (propinaRestante > 0 && ef > 0) {
                        const descuento = Math.min(ef, propinaRestante);
                        ef -= descuento;
                        propinaRestante -= descuento;
                    }
                    // Si aún queda propina por descontar, la quitamos de tarjeta
                    if (propinaRestante > 0 && tj > 0) {
                        const descuento = Math.min(tj, propinaRestante);
                        tj -= descuento;
                        propinaRestante -= descuento;
                    }
                    // Si aún queda, la quitamos de digital
                    if (propinaRestante > 0 && dg > 0) {
                        const descuento = Math.min(dg, propinaRestante);
                        dg -= descuento;
                        propinaRestante -= descuento;
                    }

                    metodos.efectivo += ef;
                    metodos.tarjeta += tj;
                    metodos.digital += dg;
                } else {
                    // Fallback seguro de retrocompatibilidad por si hay registros viejos sin columnas planas
                    let procesado = false;
                    if (v.detallePagos && Array.isArray(v.detallePagos) && v.detallePagos.length > 0) {
                        v.detallePagos.forEach(p => {
                            const m = p.metodo?.toLowerCase() || 'efectivo';
                            const monto = Number(p.monto || 0);
                            if (m === 'efectivo') metodos.efectivo += monto;
                            else if (m === 'tarjeta') metodos.tarjeta += monto;
                            else if (m === 'digital' || m === 'nequi' || m === 'daviplata') metodos.digital += monto;
                        });
                        procesado = true;
                    }

                    if (!procesado) {
                        const mp = v.metodoPago?.toLowerCase() || 'efectivo';
                        if (mp === 'efectivo') metodos.efectivo += ventaNeta;
                        else if (mp === 'tarjeta') metodos.tarjeta += ventaNeta;
                        else metodos.digital += ventaNeta;
                    }
                }

                // 🥩 CONTEO DE PRODUCTOS (Lógica original idéntica)
               v.platosVendidosV2?.forEach(p => {
    const nombre = (p.nombrePlato || p.nombre || "Desconocido").toUpperCase().trim();
    const cant = Number(p.cantidad || 0);
    const precioU = Number(p.precioUnitario || p.precioNum || p.precio || 0);
    const costoU = Number(p.precioCosto || 0);

    // 🛡️ BISTURÍ: Creamos la clave única combinada
    const claveUnica = `${nombre}_${precioU}`;

    // Almacenamos la información indexada por la variación de precio
    productos[claveUnica] = (productos[claveUnica] || 0) + cant;
    preciosParaExcel[claveUnica] = precioU;
    preciosCostoParaExcel[claveUnica] = costoU;

    if (cant % 1 !== 0) {
        unidadesMedida[claveUnica] = 'kg';
    }
}); 
            });

            const totalGastos = gastos.reduce((acc, g) => acc + Number(g.monto || 0), 0);

            setDatosReporte({
                ventas: totalVentasNetas,
                totalPropinas,
                gastos: totalGastos,
                productos,
                precios: preciosParaExcel,
                preciosCosto: preciosCostoParaExcel,
                unidadesMedida, // 🥩 Importante para el ReporteModal
                metodosPago: metodos
            });

            setListaGastosDetallada(gastos);
        } catch (error) {
            console.error("🔥 Error crítico en cierre:", error);
            alert("Error al generar cierre de día.");
        } finally {
            setCargandoReporte(false);
        }
    };

    // ================================================================
    // 🔐 2. REPORTE ADMINISTRATIVO (CONEXIÓN CON API)
    // ================================================================
    const cargarReporteAdmin = async (pinRecibido = null) => {
        let pinFinal = typeof pinRecibido === 'string' ? pinRecibido : pinMemoria;

        if (!pinFinal) pinFinal = prompt("🔑 Ingrese PIN administrativo");
        if (!pinFinal) return;

        setCargandoAdmin(true);
        try {
            const res = await fetch('/api/admin/reportes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fechaInicio: `${fechaInicioFiltro} 00:00:00`,
                    fechaFin: `${fechaFinFiltro} 23:59:59`,
                    pinAdmin: pinFinal,
                    tenantId,
                    tenant: tenantId
                })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Error en el servidor');

            let ventasTotales = 0;
            let porMesero = {};

            (data.ventas || []).forEach(v => {
                const monto = Number(v.totalPagado || 0);
                ventasTotales += monto;
                const nombre = v.mesero || "General";
                porMesero[nombre] = (porMesero[nombre] || 0) + monto;
            });

            const totalGastos = (data.gastos || []).reduce(
                (acc, g) => acc + Number(g.monto || 0),
                0
            );

            // Aseguramos que las llaves internas de métodos de pago en las estadísticas del backend unifiquen billeteras virtuales
let estadisticasSaneadas = data.estadisticas || { metodosPago: { efectivo: 0, tarjeta: 0, digital: 0 }, topPlatos: [], totalPropinas: 0 };
if (data.estadisticas?.metodosPago) {
    const rawMp = data.estadisticas.metodosPago;
    estadisticasSaneadas.metodosPago = {
        efectivo: Number(rawMp.efectivo || 0),
        tarjeta: Number(rawMp.tarjeta || 0),
        digital: Number(rawMp.digital || 0) + Number(rawMp.nequi || 0) + Number(rawMp.daviplata || 0)
    };
}

setPinMemoria(pinFinal);
setReporteAdmin({
    ventasTotales,
    porMesero,
    gastos: totalGastos,
    porTipoOrden: data.porTipoOrden || { mesa: 0, domicilio: 0, llevar: 0 },
    estadisticas: estadisticasSaneadas
});

            setMostrarAdmin(true);
        } catch (error) {
            console.error("🔥 Error admin:", error);
            alert(error.message || "Error al cargar reporte administrativo.");
        } finally {
            setCargandoAdmin(false);
        }
    };

    return {
        mostrarReporte, setMostrarReporte,
        datosReporte,
        cargandoReporte,
        fechaInicioReporte, setFechaInicioReporte,
        fechaFinReporte, setFechaFinReporte,
        listaGastosDetallada,
        generarCierreDia,
        mostrarAdmin, setMostrarAdmin,
        reporteAdmin,
        cargandoAdmin,
        fechaInicioFiltro, setFechaInicioFiltro,
        fechaFinFiltro, setFechaFinFiltro,
        cargarReporteAdmin
    };
}