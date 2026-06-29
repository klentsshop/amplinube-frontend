'use client';
import React, { useState, useEffect } from 'react';
import { Trash2, Search, RefreshCw } from 'lucide-react';

export default function VistaVentas({ tenantId }) {
    const [ventas, setVentas] = useState([]);
    const [busqueda, setBusqueda] = useState('');
    const [cargando, setCargando] = useState(false);
    const [ventaDetalle, setVentaDetalle] = useState(null);
    const [pestaña, setPestaña] = useState('ventas'); // 'ventas' o 'eliminadas'
    const [ordenesEliminadas, setOrdenesEliminadas] = useState([]);
    const [ordenEliminadaDetalle, setOrdenEliminadaDetalle] = useState(null);
    

    const cargarVentas = async () => {
        if (!tenantId) return;
        setCargando(true);
        try {
            const res = await fetch(`/api/admin/ventas?tenantId=${tenantId}`);
            const data = await res.json();
            setVentas(Array.isArray(data) ? data : []);
        } catch (e) {
            console.error(e);
        } finally {
            setCargando(false);
        }
    };

    useEffect(() => {
        cargarVentas();
        if (tenantId) cargarOrdenesEliminadas();
    }, [tenantId]);

    const cargarOrdenesEliminadas = async () => {
        if (!tenantId) return;
        setCargando(true);
        try {
            // Cambiamos al endpoint que consulta 'ordenes_eliminadas' en Supabase
            const res = await fetch(`/api/admin/ordenes-eliminadas?tenantId=${tenantId}`);
            const data = await res.json();
            setOrdenesEliminadas(Array.isArray(data) ? data : []);
        } catch (e) {
            console.error("Error cargando auditoría de órdenes borradas:", e);
        } finally {
            setCargando(false);
        }
    };

    const handleAnularVenta = async (transaccionId, folio) => {
        const motivo = prompt(`⚠️ ¿Cuál es el motivo de anulación para la venta con FOLIO [ ${folio} ]?\n\nEsta acción cambiará el estado de la factura a ANULADA en la auditoría.`);
        if (!motivo) return alert('Anulación cancelada. El motivo es obligatorio.');
        if (motivo.trim() === '') return alert('El motivo no puede estar vacío.');
        
        try {
            const res = await fetch('/api/admin/ventas', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ transaccionId, tenantId, motivo: motivo.trim() })
            });
            const data = await res.json();
            if (data.ok) {
                alert('📉 Venta anulada lógicamente en el sistema.');
                await cargarVentas();
            } else {
                alert(`❌ Error: ${data.error}`);
            }
        } catch (e) {
            alert('❌ Fallo de comunicación con el servidor.');
        }
    };

   const filtradas = ventas.filter(v => 
        (v.folio || "").toLowerCase().includes(busqueda.toLowerCase()) ||
        (v.mesa || "").toLowerCase().includes(busqueda.toLowerCase())
    );
const ordenesFiltradas = ordenesEliminadas.filter(o => {
        const query = (busqueda || "").toLowerCase().trim();
        return (
            String(o.mesa || "").toLowerCase().includes(query) ||
            String(o.mesero || "").toLowerCase().includes(query) ||
            String(o.eliminado_por || "").toLowerCase().includes(query)
        );
    });

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '400px' }}>
            {/* 🏁 SWITCHER MILIMÉTRICO DE PESTAÑAS */}
            <div style={{ display: 'flex', gap: '4px', borderBottom: '2px solid #e5e7eb', paddingBottom: '2px' }}>
                <button 
                    onClick={() => setPestaña('ventas')} 
                    style={{ padding: '8px 16px', border: 'none', background: pestaña === 'ventas' ? '#0f766e' : 'transparent', color: pestaña === 'ventas' ? 'white' : '#4b5563', borderRadius: '6px 6px 0 0', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}
                >
                    📋 Historial de Ventas ({filtradas.length})
                </button>
                <button 
                    onClick={() => setPestaña('eliminadas')} 
                    style={{ padding: '8px 16px', border: 'none', background: pestaña === 'eliminadas' ? '#0f766e' : 'transparent', color: pestaña === 'eliminadas' ? 'white' : '#4b5563', borderRadius: '6px 6px 0 0', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}
                >
                    🚨 Órdenes Borradas ({ordenesFiltradas.length})
                </button>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <Search size={16} style={{ position: 'absolute', left: '10px', color: '#9ca3af' }} />
                    <input 
                        type="text" 
                        placeholder="Buscar por Folio o Mesa..." 
                        value={busqueda}
                        onChange={(e) => setBusqueda(e.target.value)}
                        style={{ width: '100%', padding: '8px 8px 8px 32px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.85rem' }}
                    />
                </div>
                <button onClick={pestaña === 'ventas' ? cargarVentas : cargarOrdenesEliminadas} style={{ padding: '8px 12px', background: '#e5e7eb', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
                    <RefreshCw size={16} className={cargando ? 'animate-spin' : ''} />
                </button>
            </div>

            <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', overflowY: 'auto', maxHeight: '280px' }}>
                {pestaña === 'ventas' ? (
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
                    <thead style={{ background: '#f3f4f6', fontWeight: 'bold' }}>
                        <tr>
                            <th style={{ padding: '10px' }}>Folio</th>
                            <th style={{ padding: '10px' }}>Mesa</th>
                            <th style={{ padding: '10px' }}>Mesero</th>
                            <th style={{ padding: '10px' }}>Total</th>
                            <th style={{ padding: '10px', textAlign: 'center' }}>Estado</th>
                            <th style={{ padding: '10px', textAlign: 'center' }}>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtradas.length === 0 ? (
                            <tr><td colSpan="6" style={{ padding: '20px', textAlign: 'center', color: '#6b7280' }}>No se encontraron ventas recientes.</td></tr>
                        ) : (
                            filtradas.map((v) => {
                                const esAnulada = v.activo === false;
                                // 🧬 Verificamos usando transaccion_id para la apertura exacta
                                const esFilaAbierta = ventaDetalle?.transaccion_id === v.transaccion_id;

                                // 🛡️ CAPA DE COMPATIBILIDAD PLANA: Extraemos platos_vendidos o platosVendidosV2 de forma segura
                                let platosVendidosArray = [];
                                try {
                                    const origenPlatos = v.platos_vendidos || v.platosVendidosV2;
                                    platosVendidosArray = Array.isArray(origenPlatos) 
                                        ? origenPlatos 
                                        : JSON.parse(origenPlatos || '[]');
                                } catch (err) {
                                    console.error("Error parseando platos:", err);
                                }

                                return (
                                    <React.Fragment key={v.transaccion_id}>
                                        {/* Fila Principal de la Venta */}
                                        <tr style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: esAnulada ? '#fef2f2' : esFilaAbierta ? '#f8fafc' : 'transparent', color: esAnulada ? '#9ca3af' : 'inherit' }}>
                                            <td style={{ padding: '10px', fontWeight: '600', textDecoration: esAnulada ? 'line-through' : 'none' }}>{v.folio}</td>
                                            <td style={{ padding: '10px' }}>{v.mesa}</td>
                                            <td style={{ padding: '10px' }}>{v.mesero}</td>
                                            <td style={{ padding: '10px', color: esAnulada ? '#9ca3af' : '#10b981', fontWeight: 'bold' }}>${(Number(v.total_pagado || 0) + Number(v.propina_recaudada || 0)).toLocaleString()}</td>
                                            <td style={{ padding: '10px', textAlign: 'center', fontWeight: 'bold', color: esAnulada ? '#ef4444' : '#10b981' }}>
                                                {esAnulada ? '❌ ANULADA' : '✅ ACTIVA'}
                                            </td>
                                            <td style={{ padding: '10px', textAlign: 'center' }}>
                                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', alignItems: 'center' }}>
                                                    {/* 👁️ Interruptor de Expansión Orgánica */}
                                                    <button 
                                                        onClick={() => setVentaDetalle(esFilaAbierta ? null : v)}
                                                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', padding: '4px', backgroundColor: esFilaAbierta ? '#e2e8f0' : 'transparent', borderRadius: '4px' }}
                                                        title="Inspeccionar platos en pantalla"
                                                    >
                                                        👁️
                                                    </button>
                                                    
                                                    <button 
                                                        onClick={() => handleAnularVenta(v.transaccion_id, v.folio)}
                                                        disabled={esAnulada}
                                                        style={{ background: 'none', border: 'none', color: esAnulada ? '#cbd5e1' : '#ef4444', cursor: esAnulada ? 'not-allowed' : 'pointer', padding: '4px' }}
                                                        title={esAnulada ? "Esta venta ya fue anulada" : "Anular Venta"}
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>

                                        {/* 🎯 INYECCIÓN EN LÍNEA IDÉNTICA AL MODAL */}
                                        {esFilaAbierta && (
                                            <tr>
                                                <td colSpan="6" style={{ padding: '12px 20px', backgroundColor: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
                                                    <div style={{ padding: '15px', backgroundColor: 'white', borderRadius: '8px', border: '1px solid #cbd5e1', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }}>
                                                        
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', borderBottom: '2px solid #cbd5e1', paddingBottom: '5px' }}>
                                                            <strong style={{ fontSize: '0.85rem', color: '#1e293b' }}>🛒 DETALLE DE PRODUCTOS: {v.folio}</strong>
                                                            <button onClick={() => setVentaDetalle(null)} style={{ border: 'none', background: 'none', color: '#ef4444', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.8rem' }}>OCULTAR</button>
                                                        </div>

                                                        {/* Lista de Platos Renderizados */}
                                                        <div style={{ maxHeight: '150px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        {platosVendidosArray.length === 0 ? (
                                            <div style={{ fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic' }}>No hay ítems registrados en esta venta.</div>
                                        ) : (
                                            platosVendidosArray.map((plato, idx) => {
                                                const cantidad = Number(plato.cantidad || 1);
                                                const precio = Number(plato.precioUnitario || plato.precio || 0);
                                                return (
                                                    <div key={plato._key || idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#334155', padding: '2px 0' }}>
                                                        <div style={{ flex: 1, paddingRight: '10px' }}>
                                                            <span style={{ fontWeight: 'bold', color: '#0f766e' }}>{cantidad}x</span> {plato.nombrePlato || plato.nombre || 'PRODUCTO'}
                                                            {plato.comentario && <div style={{ fontSize: '0.75rem', color: '#b91c1c', fontStyle: 'italic', marginLeft: '22px' }}>↳ 📝 {plato.comentario}</div>}
                                                        </div>
                                                        <span style={{ fontWeight: 'bold' }}>${(precio * cantidad).toLocaleString()}</span>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>

                                                        {/* Desglose de Totales e Historial Estilo Ticket */}
                                    <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '2px dashed #cbd5e1', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.85rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                                            <span>Subtotal Productos:</span>
                                            <span>${Number(v.total_pagado || 0).toLocaleString()}</span>
                                        </div>

                                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569', fontSize: '0.8rem', fontStyle: 'italic', marginBottom: '2px' }}>
                                            <span>💳 Método de Pago:</span>
                                            <span style={{ textTransform: 'uppercase', fontWeight: 'bold' }}>{v.metodo_pago || 'EFECTIVO'}</span>
                                        </div>

                                        {esAnulada && (
                                            <div style={{ marginTop: '5px', padding: '8px', backgroundColor: '#fef2f2', borderLeft: '4px solid #ef4444', borderRadius: '4px', fontSize: '0.8rem', color: '#991b1b' }}>
                                                📌 <strong>MOTIVO DE ANULACIÓN:</strong> {v.motivo_anulacion || 'No especificado'}
                                            </div>
                                        )}

                                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                                        <span>Valor Propina:</span>
                                        <span>${Number(v.propina_recaudada || 0).toLocaleString()}</span>
                                        </div>

                                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#1e293b', fontSize: '1rem', fontWeight: '900', paddingTop: '4px', borderTop: '1px solid #e2e8f0' }}>
                                        <span>💰 TOTAL + PROPINA:</span>
                                         <span style={{ color: esAnulada ? '#9ca3af' : '#10b981' }}>${(Number(v.total_pagado || 0) + Number(v.propina_recaudada || 0)).toLocaleString()}</span>
                                        </div>
                                    </div>

                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })
                        )}
                    </tbody>
                </table>
                ) : (
                /* ⚡ TABLA SECUNDARIA: ÓRDENES ELIMINADAS (AUDITORÍA DE SUPABASE) */
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
                    <thead style={{ background: '#f3f4f6', fontWeight: 'bold' }}>
                        <tr>
                            <th style={{ padding: '10px' }}>Mesa</th>
                            <th style={{ padding: '10px' }}>Atendido Por</th>
                            <th style={{ padding: '10px' }}>Eliminado Por</th>
                            <th style={{ padding: '10px' }}>Fecha Borrado</th>
                            <th style={{ padding: '10px', textAlign: 'center' }}>Ver</th>
                        </tr>
                    </thead>
                    <tbody>
                        {ordenesFiltradas.length === 0 ? (
                            <tr><td colSpan="5" style={{ padding: '20px', textAlign: 'center', color: '#6b7280' }}>No se encontraron registros de órdenes borradas.</td></tr>
                        ) : (
                            ordenesFiltradas.map((o, idx) => {
                                const esFilaAbierta = ordenEliminadaDetalle?.id === o.id;

                                // Parseamos de forma segura el array de platos_ordenados que viene de Supabase
                                let platosOrdenadosArray = [];
                                try {
                                    platosOrdenadosArray = typeof o.platos_ordenados === 'string' 
                                        ? JSON.parse(o.platos_ordenados) 
                                        : (o.platos_ordenados || []);
                                } catch (err) { console.error(err); }

                                // Sumamos el valor que se perdió/borró del carrito
                                const totalPerdido = platosOrdenadosArray.reduce((acc, curr) => acc + (Number(curr.subtotal || 0)), 0);

                                return (
                                    <React.Fragment key={o.id || idx}>
                                        <tr style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: esFilaAbierta ? '#fff5f5' : 'transparent' }}>
                                            <td style={{ padding: '10px', fontWeight: '600', color: '#ef4444' }}>Mesa {o.mesa}</td>
                                            <td style={{ padding: '10px' }}>{o.mesero || 'Sin asignar'}</td>
                                            <td style={{ padding: '10px', fontWeight: 'bold', color: '#374151' }}>{o.eliminado_por}</td>
                                            <td style={{ padding: '10px' }}>{new Date(o.fecha_eliminacion).toLocaleString('es-CO', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}</td>
                                            <td style={{ padding: '10px', textAlign: 'center' }}>
                                                <button 
                                                    onClick={() => setOrdenEliminadaDetalle(esFilaAbierta ? null : o)} 
                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', backgroundColor: esFilaAbierta ? '#fee2e2' : 'transparent', borderRadius: '4px', padding: '2px 6px' }}
                                                >
                                                    🔍
                                                </button>
                                            </td>
                                        </tr>

                                        {/* Desglose interno del carrito que el cajero eliminó */}
                                        {esFilaAbierta && (
                                            <tr>
                                                <td colSpan="5" style={{ padding: '12px 20px', backgroundColor: '#fff5f5', borderBottom: '1px solid #fca5a5' }}>
                                                    <div style={{ padding: '15px', backgroundColor: 'white', borderRadius: '8px', border: '1px solid #fca5a5' }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', borderBottom: '2px solid #fca5a5', paddingBottom: '5px' }}>
                                                            <strong style={{ fontSize: '0.82rem', color: '#991b1b' }}>🚨 PRODUCTOS ELIMINADOS DE LA ORDEN:</strong>
                                                            <span style={{ fontSize: '0.82rem', color: '#b91c1c', fontWeight: 'bold' }}>PÉRDIDA ESTIMADA: ${totalPerdido.toLocaleString()}</span>
                                                        </div>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '120px', overflowY: 'auto' }}>
                                                            {platosOrdenadosArray.map((plato, pIdx) => (
                                                                <div key={pIdx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#4b5563' }}>
                                                                    <span><strong style={{ color: '#b91c1c' }}>{plato.cantidad || plato.amount || 1}x</strong> {plato.nombrePlato || plato.nombre || 'Producto sin Nombre'}</span>
                                                                    <strong>${Number(plato.subtotal || 0).toLocaleString()}</strong>
                                                                </div>
                                                            ))}
                                                        </div>
                                                        <div style={{ marginTop: '10px', padding: '8px', backgroundColor: '#fef2f2', borderLeft: '4px solid #ef4444', borderRadius: '4px', fontSize: '0.78rem', color: '#991b1b' }}>
                                                            📌 <strong>MOTIVO LOGUEADO:</strong> "{o.motivo_eliminacion}"
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })
                        )}
                    </tbody>
                </table>
                )}
            </div>
        </div>
    );
}