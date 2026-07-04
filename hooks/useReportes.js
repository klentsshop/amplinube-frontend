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
                fetch(`/api/gastos?tenantId=${tenantId}&inicio=${encodeURIComponent(inicio)}&fin=${encodeURIComponent(fin)}`, { 
                    method: 'GET'
                })
            ]);

            if (!resVentas.ok || !resGastos.ok) {
                throw new Error("No se pudo obtener la información financiera de Supabase.");
            }

            const respuestaVentasJson = await resVentas.json();
            const gastos = await resGastos.json();

            // Extraemos basándonos en la estructura compuesta de la API
            const metaTotals = respuestaVentasJson.metaTotales || null;
            const invReal = respuestaVentasJson.inventarioConsolidado || null;

            // 🛡️ ENLACE DIRECTO DESDE EL RPC COMPARTIDO SIN PROCESAMIENTOS LOCALES COORTADOS
            const totalVentasNetas = metaTotals ? metaTotals.ventasTotales : 0;
            const totalPropinas = metaTotals ? metaTotals.propinasTotales : 0;
            const metodos = metaTotals ? { ...metaTotals.metodosPago } : { efectivo: 0, tarjeta: 0, digital: 0 };

            const totalGastos = gastos.reduce((acc, g) => acc + Number(g.monto || 0), 0);

            // 🟩 ASIGNACIÓN INDESTRUCTIBLE DIRECTA AL ESTADO DEL MODAL (30 MILLONES REALES)
            setDatosReporte({
                ventas: totalVentasNetas,
                totalPropinas,
                gastos: totalGastos,
                metodosPago: metodos,
                // Inyectamos el objeto relacional completo para burlar el límite físico de red
                inventarioConsolidado: invReal, 
                productos: invReal ? invReal.productos : {},
                precios: invReal ? invReal.precios : {},
                preciosCosto: invReal ? invReal.preciosCosto : {},
                unidadesMedida: invReal ? invReal.unidadesMedida : {}
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
            return true; // 👈 🛡️ Retornamos éxito al padre
        } catch (error) {
            console.error("🔥 Error admin:", error);
            alert(error.message || "Error al cargar reporte administrativo.");
            return false; // 👈 🛡️ Retornamos falla al padre para bloquear UI
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