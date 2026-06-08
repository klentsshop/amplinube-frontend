'use client';

import React, { useState } from 'react';

export default function HistorialVentasModal({ isOpen, onClose, onReimprimir, tenantId }) {
    const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
    const [ventas, setVentas] = useState([]);
    const [buscando, setBuscando] = useState(false);
    const [ventaDetalle, setVentaDetalle] = useState(null);

    const obtenerVentas = async () => {
        setBuscando(true);
        setVentaDetalle(null);
        try {
            const res = await fetch('/api/ventas/historial', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fechaSeleccionada: fecha, tenantId: tenantId })
            });
            const data = await res.json();
            setVentas(Array.isArray(data) ? data : []);
        } catch (e) {
            console.error("Error al obtener historial:", e);
            alert("Error al conectar con el servidor");
        } finally {
            setBuscando(false);
        }
    };

    React.useEffect(() => {
        if (isOpen && tenantId) {
            obtenerVentas();
        }
    }, [isOpen, tenantId]);

    if (!isOpen) return null;

    return (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
            {/* 🛡️ CIRUGÍA UX: Altura controlada al 90% de la pantalla y comportamiento Flex */}
            <div style={{ backgroundColor: 'white', width: '95%', maxWidth: '500px', maxHeight: '90vh', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)', display: 'flex', flexDirection: 'column' }}>
                
                {/* Header (ESTÁTICO - SIEMPRE VISIBLE) */}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '15px 20px', borderBottom: '1px solid #eee', backgroundColor: '#f8fafc', flexShrink: 0 }}>
                    <h3 style={{ margin: 0, color: '#1e293b', fontSize: '1.2rem' }}>📋 Historial de Ventas</h3>
                    <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: '24px', cursor: 'pointer', color: '#64748b' }}>×</button>
                </div>

                {/* CUERPO CENTRAL (DINÁMICO - ABSORBE EL SCROLL) */}
                <div style={{ padding: '20px', flex: 1, overflowY: 'auto', minHeight: 0 }}>
                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569', display: 'block', marginBottom: '5px' }}>SELECCIONAR DÍA:</label>
                        <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '1rem', outline: 'none' }} />
                    </div>

                    <button onClick={obtenerVentas} disabled={buscando} style={{ width: '100%', padding: '14px', backgroundColor: buscando ? '#94a3b8' : '#1abc9c', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '1rem', cursor: buscando ? 'not-allowed' : 'pointer', transition: 'background 0.2s' }}>
                        {/* 🛡️ CORRECCIÓN DE VARIABLE: Cambiado 'search' por 'buscando' para evitar crash de React */}
                        {buscando ? 'BUSCANDO...' : '🔍 VER VENTAS'}
                    </button>

                    <div style={{ marginTop: '20px', border: '1px solid #f1f5f9', borderRadius: '8px' }}>
                        {ventas.length > 0 ? (
                            ventas.map(v => {
                                // 🧬 Identificamos si esta fila exacta es la que el usuario quiere desplegar
                                const esFilaAbierta = ventaDetalle?._id === v._id;

                                return (
                                    <div key={v._id} style={{ display: 'flex', flexDirection: 'column', padding: '15px', borderBottom: '1px solid #f1f5f9', backgroundColor: esFilaAbierta ? '#f8fafc' : 'white', transition: 'background-color 0.2s' }}>
                                        
                                        {/* Bloque superior: Fila de la venta */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontWeight: '800', color: '#1e293b', fontSize: '0.95rem' }}>{v.folio || 'S/F'} - {v.mesa}</div>
                                                <div style={{ color: '#64748b', fontSize: '0.8rem', marginTop: '2px' }}>
                                                👤 {v.mesero || 'Caja'} • 💰 <strong>$
                                                {String(
                                               ((v.platosVendidosV2 || []).reduce((acc, plato) => 
                                               acc + (Number(plato.precioUnitario || 0) * Number(plato.cantidad || 1)), 0
                                                ) + Number(v.propinaRecaudada || 0)).toLocaleString()
                                                )}
                                               </strong>
                                                </div>
                                            </div>
                                            
                                            <div style={{ display: 'flex', gap: '6px' }}>
                                                <button 
                                                    // 🔄 Alternador inteligente: si está abierta, la cierra pasándole null; si está cerrada, la abre.
                                                    onClick={() => setVentaDetalle(esFilaAbierta ? null : v)} 
                                                    style={{ backgroundColor: esFilaAbierta ? '#10b981' : '#e2e8f0', color: esFilaAbierta ? 'white' : '#334155', border: 'none', borderRadius: '6px', padding: '8px 12px', fontSize: '0.85rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                                                    title="Ver productos en pantalla"
                                                >
                                                    👁️
                                                </button>
                                                {/* 🖨️ FUNCIÓN DE REIMPRESIÓN ORIGINAL (INTACTA) */}
                                                <button onClick={() => onReimprimir(v)} style={{ backgroundColor: '#334155', color: 'white', border: 'none', borderRadius: '6px', padding: '8px 15px', fontSize: '0.85rem', fontWeight: 'bold', cursor: 'pointer' }}>🖨️ Ticket</button>
                                            </div>
                                        </div>

                                        {/* 🎯 INYECCIÓN ENTRE LÍNEAS: Desplaza las demás filas hacia abajo de forma orgánica */}
                                        {esFilaAbierta && (
                                            <div style={{ marginTop: '12px', padding: '15px', backgroundColor: 'white', borderRadius: '8px', border: '1px solid #cbd5e1', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', borderBottom: '2px solid #cbd5e1', paddingBottom: '5px' }}>
                                                    <strong style={{ fontSize: '0.85rem', color: '#1e293b' }}>🛒 DETALLE: {ventaDetalle.folio}</strong>
                                                    <button onClick={() => setVentaDetalle(null)} style={{ border: 'none', background: 'none', color: '#ef4444', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.8rem' }}>OCULTAR</button>
                                                </div>

                                                <div style={{ maxHeight: '150px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                    {(ventaDetalle.platosVendidosV2 || []).map((plato, idx) => (
                                                        <div key={plato._key || idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#334155', padding: '2px 0' }}>
                                                            <div style={{ flex: 1, paddingRight: '10px' }}>
                                                                <span style={{ fontWeight: 'bold', color: '#0f766e' }}>{plato.cantidad}x</span> {plato.nombrePlato || plato.nombre}
                                                                {plato.comentario && <div style={{ fontSize: '0.75rem', color: '#b91c1c', fontStyle: 'italic', marginLeft: '22px' }}>↳ 📝 {plato.comentario}</div>}
                                                            </div>
                                                            <span style={{ fontWeight: 'bold' }}>${(Number(plato.precioUnitario || 0) * Number(plato.cantidad || 1)).toLocaleString()}</span>
                                                        </div>
                                                    ))}
                                                </div>

                                                {/* DESGLOSE DE TOTALES ESTILO TICKET */}
                                                <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '2px dashed #cbd5e1', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.85rem' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                                                <span>Subtotal Productos:</span>
                                                <span>$
                                                {String(
                                                (ventaDetalle.platosVendidosV2 || []).reduce((acc, plato) => 
                                                 acc + (Number(plato.precioUnitario || 0) * Number(plato.cantidad || 1)), 0
                                                 ).toLocaleString()
                                                 )}
                                                </span>
                                               </div>
                                                    
                                                    {Number(ventaDetalle.propinaRecaudada) > 0 && (
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#0f766e', fontWeight: '500' }}>
                                                            <span>💖 Propina:</span>
                                                            <span>${Number(ventaDetalle.propinaRecaudada).toLocaleString()}</span>
                                                        </div>
                                                    )}

                                                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569', fontSize: '0.8rem', fontStyle: 'italic', marginBottom: '2px' }}>
                                                        <span>💳 Método de Pago:</span>
                                                        <span style={{ textTransform: 'uppercase', fontWeight: 'bold' }}>{ventaDetalle.metodoPago || 'No especificado'}</span>
                                                    </div>

                                                   <div style={{ display: 'flex', justifyContent: 'space-between', color: '#1e293b', fontSize: '1rem', fontWeight: '900', paddingTop: '4px', borderTop: '1px solid #e2e8f0' }}>
                                                   <span>💰 TOTAL:</span>
                                                   <span style={{ color: '#10b981' }}>$
                                                    {String(
                                                    ((ventaDetalle.platosVendidosV2 || []).reduce((acc, plato) => 
                                                    acc + (Number(plato.precioUnitario || 0) * Number(plato.cantidad || 1)), 0
                                                    ) + Number(ventaDetalle.propinaRecaudada || 0)).toLocaleString()
                                                    )}
                                                    </span>
                                                </div>
                                                </div>

                                                {ventaDetalle.datosEntrega && (
                                                    <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px dotted #cbd5e1', fontSize: '0.8rem', color: '#475569' }}>
                                                        📍 <strong>ENTREGA:</strong> {ventaDetalle.datosEntrega.nombreCliente} • {ventaDetalle.datosEntrega.telefono} • {ventaDetalle.datosEntrega.direccion}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        ) : (
                            !buscando && <div style={{ padding: '40px 20px', textAlign: 'center', color: '#94a3b8' }}>No hay ventas para este día.</div>
                        )}
                    </div>
                </div>
                
                {/* Footer (ESTÁTICO - SIEMPRE VISIBLE ABAJO) */}
                <div style={{ padding: '15px 20px', backgroundColor: '#f8fafc', textAlign: 'right', borderTop: '1px solid #eee', flexShrink: 0 }}>
                    <button onClick={onClose} style={{ padding: '10px 20px', borderRadius: '6px', border: '1px solid #cbd5e1', background: 'white', fontWeight: 'bold', cursor: 'pointer' }}>CERRAR</button>
                </div>
            </div>
        </div>
    );
}