import { useState } from 'react';
import { client } from '@/lib/sanity';

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

            const queryVentas = `
            *[_type == "venta" && tenant == $tenantId && (fechaLocal >= $inicio && fechaLocal <= $fin)]{
                "totalPagado": coalesce(totalPagado, 0),
                "propinaRecaudada": coalesce(propinaRecaudada, 0),
                metodoPago,
                detallePagos,
                platosVendidosV2 
            }
            `;

            const queryGastos = `
            *[_type == "gasto" && tenant == $tenantId && fecha >= $inicio && fecha <= $fin]{
                "monto": coalesce(monto, 0),
                descripcion,
                fecha
            }
            `;

            const [ventas, gastos] = await Promise.all([
                client.fetch(queryVentas, { inicio, fin, tenantId }, { useCdn: false }),
                client.fetch(queryGastos, { inicio, fin, tenantId }, { useCdn: false })
            ]);

            let totalVentasNetas = 0;
            let totalPropinas = 0;
            let productos = {};
            let preciosParaExcel = {};
            let unidadesMedida = {}; // 🥩 Rastreador de tipos (Kg vs Und)
            let metodos = { efectivo: 0, tarjeta: 0, digital: 0 };

            ventas.forEach(v => {
                const ventaNeta = Number(v.totalPagado || 0);
                const propina = Number(v.propinaRecaudada || 0);

                totalVentasNetas += ventaNeta;
                totalPropinas += propina;

                let procesado = false;

                if (v.detallePagos && Array.isArray(v.detallePagos) && v.detallePagos.length > 0) {
                    v.detallePagos.forEach(p => {
                        const m = p.metodo?.toLowerCase() || 'efectivo';
                        const monto = Number(p.monto || 0);
                        if (m === 'efectivo') metodos.efectivo += monto;
                        else if (m === 'tarjeta') metodos.tarjeta += monto;
                        else if (m === 'digital') metodos.digital += monto;
                    });
                    procesado = true;
                }

                if (!procesado) {
                    const mp = v.metodoPago?.toLowerCase() || 'efectivo';
                    if (mp === 'efectivo') metodos.efectivo += ventaNeta;
                    else if (mp === 'tarjeta') metodos.tarjeta += ventaNeta;
                    else metodos.digital += ventaNeta;
                }

                // 🥩 CONTEO DE PRODUCTOS (Precisión para Carnes/Pescados)
                v.platosVendidosV2?.forEach(p => {
                    const nombre = p.nombrePlato || "Desconocido";
                    const cant = Number(p.cantidad || 0);
                    
                    // Sumamos la cantidad real (con decimales si es peso)
                    productos[nombre] = (productos[nombre] || 0) + cant;
                    preciosParaExcel[nombre] = Number(p.precioUnitario || 0);
                    
                    // Si alguna vez se vendió con decimales, lo marcamos como 'kg' para el Excel
                    if (cant % 1 !== 0) {
                        unidadesMedida[nombre] = 'kg';
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
                    tenantId
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

            setPinMemoria(pinFinal);
            setReporteAdmin({
                ventasTotales,
                porMesero,
                gastos: totalGastos,
                porTipoOrden: data.porTipoOrden || { mesa: 0, domicilio: 0, llevar: 0 },
                estadisticas: data.estadisticas || {
                    metodosPago: { efectivo: 0, tarjeta: 0, digital: 0 },
                    topPlatos: [],
                    totalPropinas: 0
                }
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