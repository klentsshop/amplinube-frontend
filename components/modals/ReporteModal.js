'use client';
import React from 'react';
import * as XLSX from 'xlsx';

export default function ReporteModal({ 
    isOpen, onClose, cargando, datos, 
    fechaInicio, setFechaInicio, 
    fechaFin, setFechaFin, 
    onGenerar, listaGastos, config
}) {
    const [gastosNequiManual, setGastosNequiManual] = React.useState(0);
    const [gastosTarjetaManual, setGastosTarjetaManual] = React.useState(0);

    const exportarExcelProfesional = (gTarjeta = 0, gDigital = 0) => {
        if (!datos) return;
        
        const gastosParaExcel = Array.from(listaGastos || []);

        // --- MATEMÁTICA EN VIVO REPLICADA ---
        const totalGastosGlobal = Number(datos?.gastos || 0);
        const efectivoBruto = Number(datos?.metodosPago?.efectivo || datos?.metodos?.efectivo || 0);
        const tarjetaBruto = Number(datos?.metodosPago?.tarjeta || datos?.metodos?.tarjeta || 0);
        const digitalBruto = Number(datos?.metodosPago?.digital || datos?.metodos?.digital || 0);

        const valTarjeta = Math.min(Number(gTarjeta) || 0, tarjetaBruto, totalGastosGlobal);
        const valDigital = Math.min(Number(gDigital) || 0, digitalBruto, totalGastosGlobal);

        const gastosEfecCalculado = Math.max(0, totalGastosGlobal - valTarjeta - valDigital);
        const efectivoEnCajaReal = Math.max(0, efectivoBruto - gastosEfecCalculado);

        const datosVentas = Object.entries(datos.productos || {})
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([clave, cantidad]) => {
                const [nombre, precioUnit] = clave.split('_');
                const esPeso = datos.unidadesMedida?.[clave] === 'kg' || Number(cantidad) % 1 !== 0;

                return {
                    "PRODUCTO / ARTÍCULO": nombre.toUpperCase(),
                    "PRECIO UNITARIO ($)": Number(precioUnit),
                    "CANTIDAD": esPeso ? Number(cantidad).toFixed(3) : Math.floor(cantidad),
                    "U. MEDIDA": esPeso ? "KG" : "UND",
                    "TOTAL RECAUDADO ($)": Math.round(Number(precioUnit) * cantidad)
                };
            });

        datosVentas.push({
            "PRODUCTO / ARTÍCULO": ">>> TOTAL RECAUDADO EN VENTAS",
            "PRECIO UNITARIO ($)": "",
            "CANTIDAD": "",
            "U. MEDIDA": "",
            "TOTAL RECAUDADO ($)": datos.ventas
        });

        const libro = XLSX.utils.book_new();
        // C. Resumen Contable Dinámico
        const hojaResumen = XLSX.utils.json_to_sheet([
            { "CONCEPTO": "NEGOCIO", "VALOR": config?.nombre ? config.nombre.toUpperCase() : "Amplinube" },
            { "CONCEPTO": "NIT", "VALOR": config?.nit || "N/A" },
            { "CONCEPTO": "PERIODO", "VALOR": `${fechaInicio} al ${fechaFin}` },
            { "CONCEPTO": "---------------------------------------", "VALOR": "-------------------" },
            { "CONCEPTO": "VENTAS TOTALES (BASE)", "VALOR": datos.ventas },
            { "CONCEPTO": "PROPINAS", "VALOR": datos.totalPropinas || 0 },
            { "CONCEPTO": "GASTOS TOTALES", "VALOR": totalGastosGlobal },
            { "CONCEPTO": "TOTAL NETO EN CAJA (CONCILIADO)", "VALOR": (datos.ventas + (datos.totalPropinas || 0) - totalGastosGlobal) },
            { "CONCEPTO": "---------------------------------------", "VALOR": "-------------------" },
            { "CONCEPTO": "💵 EFECTIVO INICIAL (CON PROPINAS)", "VALOR": efectivoBruto },
            { "CONCEPTO": "📉 (-) GASTOS DESCARGO EFECTIVO", "VALOR": gastosEfecCalculado },
            { "CONCEPTO": "💰 VALOR EN EFECTIVO CAJA REAL", "VALOR": efectivoEnCajaReal },
            { "CONCEPTO": "---------------------------------------", "VALOR": "-------------------" },
            { "CONCEPTO": "💳 TARJETA BRUTA", "VALOR": tarjetaBruto },
            { "CONCEPTO": "📉 (-) GASTOS ASIGNADOS A TARJETA", "VALOR": valTarjeta },
            { "CONCEPTO": "📱 DIGITAL / NEQUI BRUTO", "VALOR": digitalBruto },
            { "CONCEPTO": "📉 (-) GASTOS ASIGNADOS A DIGITAL", "VALOR": valDigital }
        ]);
let totalUtilidadGlobal = 0;
        const datosRentabilidad = Object.entries(datos.productos || {})
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([clave, cantidad]) => {
                // 🛡️ BISTURÍ SENIOR: Desestructuramos para limpiar el nombre y el precio unitario
                const [nombreReal] = clave.split('_');
                
                // 🛡️ REPARACIÓN DE ENLACE DIRECTO (Sin opcionales cruzados)
                const precioVenta = datos.precios && datos.precios[clave] ? Number(datos.precios[clave]) : 0;
                const precioCosto = datos.preciosCosto && datos.preciosCosto[clave] ? Number(datos.preciosCosto[clave]) : 0;

                const totalVenta = precioVenta * cantidad;
                const totalCosto = precioCosto * cantidad;
                const utilidad = totalVenta - totalCosto;

                // 🛡️ FILTRO DE SINCERIDAD CONTABLE: Solo sumamos a la utilidad global si el artículo tiene un costo real parametrizado (> 0)
                if (precioCosto > 0) {
                    totalUtilidadGlobal += utilidad;
                }

                return {
                    "PRODUCTO": nombreReal.toUpperCase(),
                    "UNIDADES VENDIDAS": Number(cantidad) % 1 !== 0 ? Number(cantidad) : Math.floor(cantidad),
                    "PRECIO COSTO": precioCosto,
                    "PRECIO VENTA": precioVenta,
                    "UTILIDAD": utilidad
                };
            });

        // Inyectamos fila de cierre de utilidad totalizada
        datosRentabilidad.push({
            "PRODUCTO": ">>> TOTAL UTILIDAD BRUTA DEL PERIODO",
            "UNIDADES VENDIDAS": "",
            "PRECIO COSTO": "",
            "PRECIO VENTA": "",
            "UTILIDAD": Math.round(totalUtilidadGlobal)
        });
        const hojaVentas = XLSX.utils.json_to_sheet(datosVentas);
        const hojaRentabilidad = XLSX.utils.json_to_sheet(datosRentabilidad);
        const filasGastos = gastosParaExcel.map(g => {
            const descReal = g.descripcion || g.descripcionGasto || "Gasto sin nombre";
            const fechaReal = g.fecha || g.fechaRegistro || "Sin fecha";
            const fechaCorta = String(fechaReal).substring(0, 10);

            return {
                "FECHA REGISTRO": fechaCorta,
                "PROVEEDOR / CONCEPTO": String(descReal).toUpperCase().trim(),
                "MONTO PAGADO ($)": Number(g.monto || g.montoGasto || 0)
            };
        });

        // 🛡️ Insertamos el renglón final con el total de gastos acumulado de SocioPOS
        filasGastos.push({
            "FECHA REGISTRO": ">>> TOTAL EGRESOS EN GASTOS",
            "PROVEEDOR / CONCEPTO": "",
            "MONTO PAGADO ($)": datos.gastos
        });

        const hojaGastos = XLSX.utils.json_to_sheet(filasGastos);
        // Configuración de anchos de columna
        hojaResumen['!cols'] = [{ wch: 45 }, { wch: 20 }];
        hojaVentas['!cols'] = [{ wch: 40 }, { wch: 15 }, { wch: 10 }, { wch: 20 }, { wch: 20 }];
        hojaGastos['!cols'] = [{ wch: 25 }, { wch: 55 }, { wch: 20 }];

        hojaRentabilidad['!cols'] = [ { wch: 40 },{ wch: 18 },{ wch: 18 },{ wch: 18 },{ wch: 18 }];
        XLSX.utils.book_append_sheet(libro, hojaResumen, "Resumen Contable");
        XLSX.utils.book_append_sheet(libro, hojaVentas, "Ventas por Producto");
        XLSX.utils.book_append_sheet(libro, hojaRentabilidad, "Rentabilidad");
        XLSX.utils.book_append_sheet(libro, hojaGastos, "Gastos y Proveedores");

     const nombreNegocio = config?.nombre?.replace(/\s+/g, '_') || 'SocioPOS';
     const nombreArchivo = `Cierre_${nombreNegocio}_${fechaInicio}_al_${fechaFin}.xlsx`;
        XLSX.writeFile(libro, nombreArchivo);
    };

    if (!isOpen) return null;
    // 🧮 LÓGICA DE DESGLOSE DINÁMICO SANITIZADA Y RE-CORREGIDA
    const totalGastosGlobal = Number(datos?.gastos || 0);
    const totalPropinasBase = Number(datos?.totalPropinas || 0);
    const totalVentasBase = Number(datos?.ventas || 0);

    // Valores brutos que ya traen las propinas de forma innata
    const efectivoBrutoVentas = Number(datos?.metodosPago?.efectivo || datos?.metodos?.efectivo || 0);
    const tarjetaBrutoVentas = Number(datos?.metodosPago?.tarjeta || datos?.metodos?.tarjeta || 0);
    const digitalBrutoVentas = Number(datos?.metodosPago?.digital || datos?.metodos?.digital || 0);

    // Filtros estrictos para que los inputs no superen sus fondos ni el gasto global
    const valTarjetaManual = Math.min(Number(gastosTarjetaManual) || 0, tarjetaBrutoVentas, totalGastosGlobal);
    const valDigitalManual = Math.min(Number(gastosNequiManual) || 0, digitalBrutoVentas, totalGastosGlobal);

    // Por descarte: todo gasto que no se pagó con tarjeta o digital, se pagó con el efectivo del cajón
    const gastosEfectivoCalculado = Math.max(0, totalGastosGlobal - valTarjetaManual - valDigitalManual);

    // 💵 El efectivo real que debe quedar físicamente en el cajón
    const efectivoRealEnCaja = Math.max(0, efectivoBrutoVentas - gastosEfectivoCalculado);
    return (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 7000 }}>
            <div style={{ background: 'white', padding: '25px', borderRadius: '15px', width: '95%', maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto' }}>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
                    <h2 style={{ margin: 0, fontSize: '1.4rem' }}>📊 Cierre y Análisis</h2>
                    <button onClick={onClose} style={{ fontSize: '1.5em', border: 'none', background: 'none', cursor: 'pointer' }}>×</button>
                </div>

                <div style={{ backgroundColor: '#F9FAFB', padding: '15px', borderRadius: '10px', marginBottom: '20px', border: '1px solid #E5E7EB' }}>
                    <p style={{ margin: '0 0 10px 0', fontSize: '0.9rem', fontWeight: 'bold', textAlign: 'center' }}>PERIODO: {fechaInicio} al {fechaFin}</p>
                    <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                        <div style={{ flex: 1 }}><label style={{ fontSize: '0.7rem', fontWeight: 'bold' }}>DESDE:</label><input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} style={{ width: '100%', padding: '8px', border: '1px solid #D1D5DB', borderRadius: '5px' }} /></div>
                        <div style={{ flex: 1 }}><label style={{ fontSize: '0.7rem', fontWeight: 'bold' }}>HASTA:</label><input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} style={{ width: '100%', padding: '8px', border: '1px solid #D1D5DB', borderRadius: '5px' }} /></div>
                    </div>
                    <button onClick={onGenerar} style={{ width: '100%', padding: '10px', backgroundColor: '#10B981', color: 'white', border: 'none', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer' }}>🔍 ACTUALIZAR</button>
                </div>

                {cargando ? <p style={{ textAlign: 'center' }}>Calculando...</p> : (
                    <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#1F2937', marginBottom: '5px' }}><span>Ventas Netas:</span><strong>${datos.ventas.toLocaleString('es-CO')}</strong></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#059669', marginBottom: '5px' }}><span>(+) Propinas:</span><strong>${(datos.totalPropinas || 0).toLocaleString('es-CO')}</strong></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#DC2626', marginBottom: '10px' }}><span>(-) Gastos:</span><strong>${datos.gastos.toLocaleString('es-CO')}</strong></div>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', backgroundColor: '#FEF3C7', padding: '12px', borderRadius: '10px', border: '1px solid #FCD34D', textAlign: 'center', marginBottom: '15px' }}>
                            <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#92400E' }}>TOTAL RECAUDADO EN CAJA</span>
                            <span style={{ fontSize: '1.6rem', fontWeight: '900' }}>${(datos.ventas + (datos.totalPropinas || 0) - datos.gastos).toLocaleString('es-CO')}</span>
                        </div>

                       {/* 📊 SECCIÓN DE ARQUEO Y DESGLOSE INTEGRADO */}
                        <div style={{ marginTop: '15px', padding: '12px', backgroundColor: '#F3F4F6', borderRadius: '10px', fontSize: '0.85rem', border: '1px solid #D1D5DB' }}>
                            <p style={{ margin: '0 0 10px 0', fontWeight: 'bold', color: '#4B5563', borderBottom: '1px solid #D1D5DB', paddingBottom: '4px' }}>💰 DESGLOSE POR MEDIO Y CONTROL DE EGRESOS</p>
                            
                            {/* Línea Tarjeta + Input Gasto */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '10px', alignItems: 'center', marginBottom: '8px' }}>
                                <div><span>💳 Tarjeta:</span> <strong>${tarjetaBrutoVentas.toLocaleString('es-CO')}</strong></div>
                                <input 
                                    type="number" 
                                    placeholder="Gasto Tarjeta $0" 
                                    value={gastosTarjetaManual === 0 ? '' : gastosTarjetaManual} 
                                    onChange={(e) => setGastosTarjetaManual(Math.min(Number(e.target.value) || 0, tarjetaBrutoVentas, totalGastosGlobal))}
                                    style={{ width: '100%', padding: '4px 6px', borderRadius: '5px', border: '1px solid #D1D5DB', fontSize: '0.8rem', textAlign: 'center', outline: 'none' }} 
                                />
                            </div>

                            {/* Línea Digital + Input Gasto */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '10px', alignItems: 'center', marginBottom: '8px' }}>
                                <div><span>📱 Digital / Nequi:</span> <strong>${digitalBrutoVentas.toLocaleString('es-CO')}</strong></div>
                                <input 
                                    type="number" 
                                    placeholder="Gasto Nequi $0" 
                                    value={gastosNequiManual === 0 ? '' : gastosNequiManual} 
                                    onChange={(e) => setGastosNequiManual(Math.min(Number(e.target.value) || 0, digitalBrutoVentas, totalGastosGlobal))}
                                    style={{ width: '100%', padding: '4px 6px', borderRadius: '5px', border: '1px solid #D1D5DB', fontSize: '0.8rem', textAlign: 'center', outline: 'none' }} 
                                />
                            </div>

                            {/* Línea Efectivo Base + Resta Informativa de Gastos en caja */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '10px', alignItems: 'center', paddingBottom: '8px', borderBottom: '1px dashed #D1D5DB', marginBottom: '10px' }}>
                                <div><span>💵 Efectivo Inicial:</span> <strong>${efectivoBrutoVentas.toLocaleString('es-CO')}</strong></div>
                                <div style={{ fontSize: '0.75rem', color: '#DC2626', textAlign: 'center', backgroundColor: '#FEE2E2', borderRadius: '5px', padding: '3px' }}>
                                    Gastos Efec: -${gastosEfectivoCalculado.toLocaleString('es-CO')}
                                </div>
                            </div>

                            {/* 🟩 TOTAL EN VERDE CON EMOJI: VALOR REAL EN CAJA FISICA */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', backgroundColor: '#D1FAE5', borderRadius: '6px', border: '1px solid #10B981' }}>
                                <span style={{ fontWeight: 'bold', color: '#065F46' }}>💰 Valor en Efectivo Caja:</span>
                                <strong style={{ color: '#047857', fontSize: '1.1rem', fontWeight: '900' }}>
                                    ${efectivoRealEnCaja.toLocaleString('es-CO')}
                                </strong>
                            </div>
                        </div>

                        <button 
                            onClick={() => exportarExcelProfesional(gastosTarjetaManual, gastosNequiManual)}
                            style={{
                                width: '100%', padding: '15px', backgroundColor: '#1D6F42', color: 'white', border: 'none', borderRadius: '8px',
                                fontWeight: '900', fontSize: '0.9rem', marginTop: '20px', cursor: 'pointer', display: 'flex',
                                alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                            }}
                        >
                            📥 DESCARGAR EXCEL CONTABLE
                        </button>

                        <h3 style={{ marginTop: '20px', fontSize: '1rem', borderBottom: '2px solid #F3F4F6', paddingBottom: '5px' }}>📋 Inventario Vendido</h3>
                        <div style={{ backgroundColor: '#F3F4F6', padding: '10px', borderRadius: '8px' }}>
                            {/* 🥩 SECCIÓN: PESADOS (KG) */}
                            <p style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#2563EB', marginBottom: '5px' }}>PRODUCTOS POR PESO (KG)</p>
                            {Object.entries(datos.productos || {})
                            .filter(([clave, cant]) => datos.unidadesMedida?.[clave] === 'kg' || Number(cant) % 1 !== 0)
                            .sort(([a], [b]) => a.localeCompare(b))
                            .map(([clave, cant]) => {
                             const [nombre, precio] = clave.split('_'); // 🛡️ BISTURÍ
                             return (
                              <div key={clave} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #E5E7EB', padding: '5px 0' }}>
                               <span style={{ fontSize: '0.85rem' }}>{nombre.toUpperCase()} <small>(${Number(precio).toLocaleString()})</small></span>
                               <strong style={{ color: '#2563EB' }}>{Number(cant).toFixed(3)} Kg</strong>
                             </div>
                              );
                             })
                             }

                            {/* 🍺 SECCIÓN: UNIDADES (UND) */}
                            <p style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#4B5563', marginTop: '15px', marginBottom: '5px' }}>PRODUCTOS POR UNIDAD (UND)</p>
                            {Object.entries(datos.productos || {})
                             .filter(([clave, cant]) => datos.unidadesMedida?.[clave] !== 'kg' && Number(cant) % 1 === 0)
                             .sort(([a], [b]) => a.localeCompare(b))
                              .map(([clave, cant]) => {
                              const [nombre, precio] = clave.split('_'); // 🛡️ BISTURÍ
                             return (
                             <div key={clave} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #E5E7EB', padding: '5px 0' }}>
                             <span style={{ fontSize: '0.85rem' }}>{nombre.toUpperCase()} <small>(${Number(precio).toLocaleString()})</small></span>
                              <strong style={{ color: '#1F2937' }}>x{cant} Und</strong>
                              </div>
                              );
                              })
                              }
                        </div>

                        <h3 style={{ marginTop: '20px', fontSize: '1rem', borderBottom: '2px solid #FEE2E2', paddingBottom: '5px' }}>💸 Gastos</h3>
                        <div style={{ border: '1px solid #FEE2E2', padding: '10px', borderRadius: '8px' }}>
                            {(listaGastos || [])
                                .sort((a, b) => new Date(a.fecha) - new Date(b.fecha))
                                .map((g, idx) => (
                                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #FFF5F5', padding: '5px 0' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span>{String(g.descripcion || "GASTO").toUpperCase()}</span>
                                    <small style={{ fontSize: '0.7rem', color: '#666' }}>{String(g.fecha || "").substring(0, 10)}</small>
                                    </div>
                                    <strong style={{ color: '#DC2626' }}>${Number(g.monto || 0).toLocaleString('es-CO')}</strong>
                                    </div>
                                ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}