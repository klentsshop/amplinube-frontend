'use client';
import React from 'react';
import * as XLSX from 'xlsx';

export default function ReporteModal({ 
    isOpen, onClose, cargando, datos, 
    fechaInicio, setFechaInicio, 
    fechaFin, setFechaFin, 
    onGenerar, listaGastos, config
}) {

    const exportarExcelProfesional = () => {
        if (!datos) return;
        
        const gastosParaExcel = Array.from(listaGastos || []);

        // A. Preparar datos de Ventas con lógica de peso/unidades
        const datosVentas = Object.entries(datos.productos || {})
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([nombre, cantidad]) => {
                const precioUnit = datos.precios?.[nombre] || 0;
                // 🥩 Blindaje: Identificamos si es peso por el flag de Sanity o por decimales
                const esPeso = datos.unidadesMedida?.[nombre] === 'kg' || Number(cantidad) % 1 !== 0;

                return {
                    "PRODUCTO / ARTÍCULO": nombre.toUpperCase(),
                    "CANTIDAD": esPeso ? Number(cantidad).toFixed(3) : Math.floor(cantidad),
                    "U. MEDIDA": esPeso ? "KG" : "UND",
                    "VALOR UNITARIO ($)": precioUnit,
                    "TOTAL RECAUDADO ($)": Math.round(precioUnit * cantidad)
                };
            });

        // Agregamos fila de total al final de la hoja de productos
        datosVentas.push({
            "PRODUCTO / ARTÍCULO": ">>> TOTAL RECAUDADO EN VENTAS",
            "CANTIDAD": "",
            "U. MEDIDA": "",
            "VALOR UNITARIO ($)": "",
            "TOTAL RECAUDADO ($)": datos.ventas
        });

        const libro = XLSX.utils.book_new();
        // C. Resumen Contable
        const hojaResumen = XLSX.utils.json_to_sheet([
            { "CONCEPTO": "NEGOCIO", "VALOR": config?.nombre ? config.nombre.toUpperCase() : "Amplinube" },
            { "CONCEPTO": "NIT", "VALOR": config?.nit || "N/A" },
            { "CONCEPTO": "PERIODO", "VALOR": `${fechaInicio} al ${fechaFin}` },
            { "CONCEPTO": "---", "VALOR": "---" },
            { "CONCEPTO": "VENTAS TOTALES (BASE)", "VALOR": datos.ventas },
            { "CONCEPTO": "PROPINAS", "VALOR": datos.totalPropinas || 0 },
            { "CONCEPTO": "GASTOS", "VALOR": datos.gastos },
            { "CONCEPTO": "TOTAL NETO EN CAJA", "VALOR": (datos.ventas + (datos.totalPropinas || 0) - datos.gastos) },
            { "CONCEPTO": "--- DESGLOSE DE VENTAS POR MEDIO ---", "VALOR": "" },
            { "CONCEPTO": "Efectivo", "VALOR": datos.metodosPago?.efectivo || datos.metodos?.efectivo || 0 },
            { "CONCEPTO": "Tarjeta", "VALOR": datos.metodosPago?.tarjeta || datos.metodos?.tarjeta || 0 },
            { "CONCEPTO": "Digital (Nequi/Davi/Transf)", "VALOR": datos.metodosPago?.digital || datos.metodos?.digital || 0 }
           ]);
        const hojaVentas = XLSX.utils.json_to_sheet(datosVentas);
        const hojaGastos = XLSX.utils.json_to_sheet(gastosParaExcel.map(g => {
        const descReal = g.descripcion || g.descripcionGasto || "Gasto sin nombre";
        const fechaReal = g.fecha || g.fechaRegistro || "Sin fecha";
         // 🛡️ Limpieza de fechas ISO completas de Supabase para que el Excel sea legible (AAAA-MM-DD)
        const fechaCorta = String(fechaReal).substring(0, 10);

        return {
        "FECHA REGISTRO": fechaCorta,
        "PROVEEDOR / CONCEPTO": String(descReal).toUpperCase().trim(),
        "MONTO PAGADO ($)": Number(g.monto || g.montoGasto || 0)
         };
        }));
        
        // Configuración de anchos de columna
        hojaResumen['!cols'] = [{ wch: 45 }, { wch: 20 }];
        hojaVentas['!cols'] = [{ wch: 40 }, { wch: 15 }, { wch: 10 }, { wch: 20 }, { wch: 20 }];
        hojaGastos['!cols'] = [{ wch: 25 }, { wch: 55 }, { wch: 20 }];

        XLSX.utils.book_append_sheet(libro, hojaResumen, "Resumen Contable");
        XLSX.utils.book_append_sheet(libro, hojaVentas, "Ventas por Producto");
        XLSX.utils.book_append_sheet(libro, hojaGastos, "Gastos y Proveedores");

     const nombreNegocio = config?.nombre?.replace(/\s+/g, '_') || 'SocioPOS';
     const nombreArchivo = `Cierre_${nombreNegocio}_${fechaInicio}_al_${fechaFin}.xlsx`;
        XLSX.writeFile(libro, nombreArchivo);
    };

    if (!isOpen) return null;

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

                        <div style={{ marginTop: '15px', padding: '10px', backgroundColor: '#F3F4F6', borderRadius: '8px', fontSize: '0.85rem' }}>
                            <p style={{ margin: '0 0 5px 0', fontWeight: 'bold', color: '#4B5563', borderBottom: '1px solid #D1D5DB' }}>💰 DESGLOSE POR MEDIO</p>
                           <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>💵 Efectivo:</span><strong>${(datos.metodosPago?.efectivo || datos.metodos?.efectivo || 0).toLocaleString('es-CO')}</strong></div>
                           <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>💳 Tarjeta:</span><strong>${(datos.metodosPago?.tarjeta || datos.metodos?.tarjeta || 0).toLocaleString('es-CO')}</strong></div>
                           <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>📱 Digital:</span><strong>${(datos.metodosPago?.digital || datos.metodos?.digital || 0).toLocaleString('es-CO')}</strong></div>
                        </div>

                        <button 
                            onClick={exportarExcelProfesional}
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
                                .filter(([nombre, cant]) => datos.unidadesMedida?.[nombre] === 'kg' || Number(cant) % 1 !== 0)
                                .sort(([a], [b]) => a.localeCompare(b))
                                .map(([nombre, cant]) => (
                                    <div key={nombre} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #E5E7EB', padding: '5px 0' }}>
                                        <span style={{ fontSize: '0.85rem' }}>{nombre.toUpperCase()}</span>
                                        <strong style={{ color: '#2563EB' }}>{Number(cant).toFixed(3)} Kg</strong>
                                    </div>
                                ))
                            }

                            {/* 🍺 SECCIÓN: UNIDADES (UND) */}
                            <p style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#4B5563', marginTop: '15px', marginBottom: '5px' }}>PRODUCTOS POR UNIDAD (UND)</p>
                            {Object.entries(datos.productos || {})
                                .filter(([nombre, cant]) => datos.unidadesMedida?.[nombre] !== 'kg' && Number(cant) % 1 === 0)
                                .sort(([a], [b]) => a.localeCompare(b))
                                .map(([nombre, cant]) => (
                                    <div key={nombre} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #E5E7EB', padding: '5px 0' }}>
                                        <span style={{ fontSize: '0.85rem' }}>{nombre.toUpperCase()}</span>
                                        <strong style={{ color: '#1F2937' }}>x{cant} Und</strong>
                                    </div>
                                ))
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