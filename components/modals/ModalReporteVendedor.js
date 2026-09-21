'use client';

import React, { useState, useEffect, useMemo } from 'react';

export default function ModalReporteVendedor({ isOpen, onClose, tenantId, nombreVendedor }) {
    const hoy = () => new Date().toISOString().split('T')[0];
    const [fechaInicio, setFechaInicio] = useState(hoy);
    const [fechaFin, setFechaFin] = useState(hoy);
    const [ventas, setVentas] = useState([]);
    const [cargando, setCargando] = useState(false);
    const [folioExpandido, setFolioExpandido] = useState(null);
    const [porcentajeManual, setPorcentajeManual] = useState(40);

    const cargarVentas = async () => {
        if (!tenantId || !nombreVendedor) return;
        setCargando(true);
        setFolioExpandido(null);
        try {
            const res = await fetch('/api/ventas/historial', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fechaSeleccionada: fechaInicio,
                    fechaFin: fechaFin,
                    tenantId
                })
            });
            const data = await res.json();
            const lista = data && Array.isArray(data.listaVentas) ? data.listaVentas : [];
            
            // Filtro estricto por el vendedor activo y sin anuladas
            const misVentas = lista.filter(v => 
                v.activo !== false &&
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
    }, [isOpen, fechaInicio, fechaFin, nombreVendedor]);
    // Cálculos matemáticos dinámicos con el porcentaje editable
    const { totalVendido, comisionTotal, pctNum } = useMemo(() => {
        const total = ventas.reduce((acc, v) => acc + Number(v.totalPagado || 0), 0);
        const p = Number(porcentajeManual) || 0;
        return {
            totalVendido: total,
            comisionTotal: Math.round(total * (p / 100)),
            pctNum: p
        };
    }, [ventas, porcentajeManual]);

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
                        <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: '#9ca3af' }}>Comisión calculada: {pctNum}%</p>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: '1.4rem', cursor: 'pointer' }}>✕</button>
                </div>

                {/* Filtro de Fechas (DESDE - HASTA) */}
                <div style={{ padding: '12px 16px', backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#4b5563', display: 'block', marginBottom: '2px' }}>DESDE:</label>
                            <input 
                                type="date" 
                                value={fechaInicio} 
                                onChange={(e) => setFechaInicio(e.target.value)}
                                style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #d1d5db', fontWeight: 'bold', fontSize: '0.8rem' }}
                            />
                        </div>
                        <div style={{ flex: 1 }}>
                            <label style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#4b5563', display: 'block', marginBottom: '2px' }}>HASTA:</label>
                            <input 
                                type="date" 
                                value={fechaFin} 
                                onChange={(e) => setFechaFin(e.target.value)}
                                style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #d1d5db', fontWeight: 'bold', fontSize: '0.8rem' }}
                            />
                        </div>
                    </div>
                    <button 
                        onClick={cargarVentas}
                        disabled={cargando}
                        style={{ width: '100%', padding: '8px', backgroundColor: cargando ? '#9ca3af' : '#10b981', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 800, cursor: cargando ? 'not-allowed' : 'pointer', fontSize: '0.85rem' }}
                    >
                        {cargando ? '⌛ CONSULTANDO...' : '🔍 GENERAR REPORTE'}
                    </button>
                </div>

                {/* Listado con Ojito y Scroll Blindado */}
                <div style={{ 
                    flex: '1 1 0%', 
                    minHeight: 0, 
                    overflowY: 'auto', 
                    overscrollBehavior: 'contain',
                    WebkitOverflowScrolling: 'touch', 
                    padding: '12px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                }}>
                    {cargando ? (
                        <p style={{ textAlign: 'center', color: '#6b7280', padding: '20px 0' }}>Consultando ventas...</p>
                    ) : ventas.length === 0 ? (
                        <p style={{ textAlign: 'center', color: '#9ca3af', padding: '30px 0' }}>No tienes ventas registradas en este periodo.</p>
                    ) : (
                        ventas.map((v, i) => {
                            const val = Number(v.totalPagado || 0);
                            const com = Math.round(val * (pctNum / 100)); // 🧮 Usa el porcentaje editable
                            const idUnico = v.folio || v.id || i;
                            const abierta = folioExpandido === idUnico;
                            const platos = v.platosVendidosV2 || v.platos_vendidos || [];

                            return (
                                <div key={idUnico} style={{ border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden', background: '#fff', flexShrink: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', backgroundColor: abierta ? '#f0fdf4' : '#fff' }}>
                                        <div>
                                            <strong style={{ fontSize: '0.9rem', color: '#111827' }}>Cliente: {v.mesa || 'General'}</strong>
                                            <div style={{ fontSize: '0.7rem', color: '#9ca3af' }}>
                                                {v.folio} {v.fechaLocal ? `• ${v.fechaLocal.split(' ')[1] || ''}` : ''}
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <div style={{ textAlign: 'right' }}>
                                                <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>${val.toLocaleString('es-CO')}</div>
                                                <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#059669' }}>
                                                    {pctNum}%: ${com.toLocaleString('es-CO')}
                                                </div>
                                            </div>

                                            <button 
                                                type="button"
                                                onClick={() => setFolioExpandido(abierta ? null : idUnico)}
                                                title="Ver platos cobrados"
                                                style={{
                                                    backgroundColor: abierta ? '#10b981' : '#e2e8f0',
                                                    color: abierta ? 'white' : '#334155',
                                                    border: 'none',
                                                    borderRadius: '6px',
                                                    padding: '6px 10px',
                                                    cursor: 'pointer',
                                                    fontSize: '0.85rem',
                                                    fontWeight: 'bold'
                                                }}
                                            >
                                                👁️
                                            </button>
                                        </div>
                                    </div>

                                    {/* Platos desplegados al tocar el ojito */}
                                    {abierta && (
                                        <div style={{ padding: '8px 12px', backgroundColor: '#f9fafb', borderTop: '1px dashed #d1d5db', fontSize: '0.78rem' }}>
                                            <span style={{ fontWeight: 800, color: '#4b5563', display: 'block', marginBottom: '4px' }}>SERVICIO O PRODUCTO:</span>
                                            {platos.length === 0 ? (
                                                <span style={{ color: '#9ca3af' }}>Sin detalle de platos</span>
                                            ) : (
                                                platos.map((p, idx) => (
                                                    <div key={p._key || idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', color: '#334155' }}>
                                                        <span><strong>{p.cantidad}x</strong> {p.nombrePlato || p.nombre || 'Ítem'}</span>
                                                        <span>${(Number(p.precioUnitario || p.precio || 0) * Number(p.cantidad || 1)).toLocaleString('es-CO')}</span>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Totales y Cierre (Con Cajita Editable de Porcentaje) */}
                <div style={{ 
                    padding: '14px 20px', 
                    backgroundColor: '#f9fafb', 
                    borderTop: '2px solid #e5e7eb',
                    flexShrink: 0 
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 700, color: '#374151' }}>
                        <span>TOTAL FACTURADO:</span>
                        <span>${totalVendido.toLocaleString('es-CO')}</span>
                    </div>

                    {/* 🧮 LÍNEA DE GANANCIA CON INPUT EDITABLE */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '0.95rem', fontWeight: 900, color: '#059669' }}>GANANCIA (</span>
                            <input 
                            type="number"
                            min="0"
                            max="100"
                            value={porcentajeManual}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => {
                            const v = e.target.value;
                            if (v === '') {
                            setPorcentajeManual('');
                            return;
                            }
                           const num = Number(v);
                           if (num >= 0 && num <= 100) {
                            setPorcentajeManual(v);
                            }
                            }}
                                style={{
                                    width: '52px',
                                    padding: '3px 6px',
                                    fontSize: '0.95rem',
                                    fontWeight: 900,
                                    textAlign: 'center',
                                    borderRadius: '6px',
                                    border: '2px solid #10B981',
                                    outline: 'none',
                                    backgroundColor: '#ECFDF5',
                                    color: '#047857'
                                }}
                            />
                            <span style={{ fontSize: '0.95rem', fontWeight: 900, color: '#059669' }}>%):</span>
                        </div>

                        <span style={{ fontSize: '1.2rem', fontWeight: 950, color: '#059669' }}>
                            ${comisionTotal.toLocaleString('es-CO')}
                        </span>
                    </div>

                    <button 
                        onClick={onClose}
                        style={{ width: '100%', padding: '11px', backgroundColor: '#111827', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 800, cursor: 'pointer', fontSize: '0.9rem' }}
                    >
                        CERRAR
                    </button>
                </div>
            </div>
        </div>
    );
}