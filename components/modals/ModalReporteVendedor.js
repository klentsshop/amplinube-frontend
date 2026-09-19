'use client';

import React, { useState, useEffect, useMemo } from 'react';

export default function ModalReporteVendedor({ isOpen, onClose, tenantId, nombreVendedor }) {
    const [fecha, setFecha] = useState(() => new Date().toISOString().split('T')[0]);
    const [ventas, setVentas] = useState([]);
    const [cargando, setCargando] = useState(false);

    const cargarVentas = async () => {
        if (!tenantId || !nombreVendedor) return;
        setCargando(true);
        try {
            const res = await fetch('/api/ventas/historial', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fechaSeleccionada: fecha,
                    fechaFin: fecha,
                    tenantId
                })
            });
            const data = await res.json();
            const lista = data.listaVentas || [];
            
            // Filtro estricto por el nombre del mesero actual
            const misVentas = lista.filter(v => 
                String(v.mesero || '').trim().toUpperCase() === String(nombreVendedor || '').trim().toUpperCase()
            );
            setVentas(misVentas);
        } catch (err) {
            console.error('Error cargando ventas del vendedor:', err);
        } finally {
            setCargando(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            cargarVentas();
        }
    }, [isOpen, fecha, nombreVendedor]);

    // Cálculos matemáticos del 40%
    const { totalVendido, comisionTotal } = useMemo(() => {
        const total = ventas.reduce((acc, v) => acc + Number(v.totalPagado || 0), 0);
        return {
            totalVendido: total,
            comisionTotal: total * 0.40
        };
    }, [ventas]);

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 99999, padding: '15px'
        }}>
            <div style={{
                backgroundColor: '#ffffff', width: '100%', maxWidth: '480px',
                borderRadius: '16px', overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)',
                display: 'flex', flexDirection: 'column', maxHeight: '90vh'
            }}>
                {/* Cabecera */}
                <div style={{ padding: '16px 20px', background: '#111827', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>👤 MI PRODUCCIÓN: {nombreVendedor?.toUpperCase()}</h3>
                        <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: '#9ca3af' }}>Comisión calculada: 40%</p>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: '1.4rem', cursor: 'pointer' }}>✕</button>
                </div>

                {/* Filtro de Fecha */}
                <div style={{ padding: '12px 20px', backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb', display: 'flex', gap: '10px' }}>
                    <input 
                        type="date" 
                        value={fecha} 
                        onChange={(e) => setFecha(e.target.value)}
                        style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontWeight: 'bold' }}
                    />
                    <button 
                        onClick={cargarVentas}
                        style={{ padding: '8px 16px', backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 800, cursor: 'pointer' }}
                    >
                        {cargando ? '...' : 'BUSCAR'}
                    </button>
                </div>

                {/* Tabla de Resultados con Scroll Forzado y Suave */}
                <div style={{ 
                    flex: '1 1 0%', 
                    minHeight: 0, 
                    overflowY: 'auto', 
                    WebkitOverflowScrolling: 'touch', 
                    padding: '12px 20px' 
                }}>
                    {cargando ? (
                        <p style={{ textAlign: 'center', color: '#6b7280', padding: '20px 0' }}>Consultando ventas...</p>
                    ) : ventas.length === 0 ? (
                        <p style={{ textAlign: 'center', color: '#9ca3af', padding: '30px 0' }}>No tienes ventas registradas en esta fecha.</p>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid #e5e7eb', color: '#4b5563', textAlign: 'left' }}>
                                    <th style={{ padding: '8px 4px' }}>MESA</th>
                                    <th style={{ padding: '8px 4px', textAlign: 'right' }}>VALOR</th>
                                    <th style={{ padding: '8px 4px', textAlign: 'right', color: '#059669' }}>40%</th>
                                </tr>
                            </thead>
                            <tbody>
                                {ventas.map((v, i) => {
                                    const val = Number(v.totalPagado || 0);
                                    const com = val * 0.40;
                                    return (
                                        <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                            <td style={{ padding: '10px 4px', fontWeight: 700, color: '#111827' }}>
                                                {v.mesa || 'General'}
                                                <div style={{ fontSize: '0.7rem', color: '#9ca3af', fontWeight: 400 }}>{v.folio}</div>
                                            </td>
                                            <td style={{ padding: '10px 4px', textAlign: 'right', fontWeight: 600 }}>
                                                ${val.toLocaleString('es-CO')}
                                            </td>
                                            <td style={{ padding: '10px 4px', textAlign: 'right', fontWeight: 800, color: '#059669' }}>
                                                ${com.toLocaleString('es-CO')}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Totales y Cierre (Fijo al fondo, inmune a la cantidad de filas) */}
                <div style={{ 
                    padding: '16px 20px', 
                    backgroundColor: '#f9fafb', 
                    borderTop: '2px solid #e5e7eb',
                    flexShrink: 0 
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 700 }}>
                        <span>TOTAL VENTAS:</span>
                        <span>${totalVendido.toLocaleString('es-CO')}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '14px', fontSize: '1.05rem', fontWeight: 900, color: '#059669' }}>
                        <span>TOTAL GANANCIA (40%):</span>
                        <span>${comisionTotal.toLocaleString('es-CO')}</span>
                    </div>
                    <button 
                        onClick={onClose}
                        style={{ width: '100%', padding: '10px', backgroundColor: '#111827', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 800, cursor: 'pointer' }}
                    >
                        CERRAR
                    </button>
                </div>
            </div>
        </div>
    );
}