'use client';
import React, { useState } from 'react';

export default function AdminModal({ 
    isOpen, onClose, fechaInicio, setFechaInicio, fechaFin, setFechaFin, onGenerar, cargando, reporte, tenantId
}) {
    if (!isOpen) return null;

   // ✅ DESPUÉS (Quirúrgico - Acepta ambos formatos de propiedad):
const balanceNeto = (reporte?.ventasTotales || 0) - (reporte?.gastosTotales || reporte?.gastos || 0);

    return (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '15px', zIndex: 9999 }}>
            <div style={{ background: 'white', padding: '25px', borderRadius: '15px', width: '100%', maxWidth: '550px', maxHeight: '90vh', overflowY: 'auto', position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                    <h2 style={{ margin: 0 }}>💼 Panel Administrativo {tenantId && ` - ${tenantId}`}</h2>
                    <button onClick={onClose} style={{ fontSize: '1.5em', border: 'none', background: 'none', cursor: 'pointer' }}>×</button>
                </div>

                {/* --- FILTROS DE FECHA --- */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px', backgroundColor: '#F9FAFB', padding: '15px', borderRadius: '10px' }}>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ fontSize: '0.8em', fontWeight: 'bold' }}>DESDE:</label>
                            <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '5px', border: '1px solid #ccc' }} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <label style={{ fontSize: '0.8em', fontWeight: 'bold' }}>HASTA:</label>
                            <input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '5px', border: '1px solid #ccc' }} />
                        </div>
                    </div>
                    <button onClick={onGenerar} style={{ width: '100%', padding: '12px', backgroundColor: '#10B981', color: 'white', border: 'none', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer' }}>
                        🔍 GENERAR REPORTE ESTRATÉGICO
                    </button>
                </div>

                {cargando ? (
                    <p style={{ textAlign: 'center', padding: '20px' }}>⌛ Analizando finanzas...</p>
                ) : (
                    <>
                        {/* --- RESUMEN DE IMPACTO --- */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '20px' }}>
                            <div style={{ padding: '12px', background: '#ECFDF5', borderRadius: '10px', textAlign: 'center' }}>
                                <small style={{ color: '#047857', fontWeight: 'bold' }}>VENTAS</small><br/>
                                <strong style={{ fontSize: '1.1em' }}>${(reporte?.ventasTotales || 0).toLocaleString('es-CO')}</strong>
                            </div>
                            <div style={{ padding: '12px', background: '#FEF2F2', borderRadius: '10px', textAlign: 'center' }}>
                                <small style={{ color: '#B91C1C', fontWeight: 'bold' }}>GASTOS</small><br/>
                                <strong style={{ fontSize: '1.1em' }}>${(reporte?.gastosTotales || reporte?.gastos || 0).toLocaleString('es-CO')}</strong>
                            </div>
                            <div style={{ padding: '12px', background: balanceNeto >= 0 ? '#EFF6FF' : '#FFF7ED', borderRadius: '10px', textAlign: 'center', border: '1px solid #DBEAFE' }}>
                                <small style={{ color: '#1E40AF', fontWeight: 'bold' }}>UTILIDAD</small><br/>
                                <strong style={{ fontSize: '1.1em' }}>${balanceNeto.toLocaleString('es-CO')}</strong>
                            </div>
                        </div>

                        {/* --- DISTRIBUCIÓN DE CAJA --- */}
                        <h4 style={{ margin: '15px 0 8px 0', fontSize: '0.9em', color: '#4B5563', textTransform: 'uppercase' }}>💰 Distribución de Caja (Ventas Netas)</h4>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: '#F3F4F6', borderRadius: '8px', fontSize: '0.85em' }}>
                           <div>💵 Efec: <strong>${(reporte?.estadisticas?.metodosPago?.efectivo || reporte?.estadisticas?.metodos?.efectivo || 0).toLocaleString('es-CO')}</strong></div>
                           <div>💳 Tarj: <strong>${(reporte?.estadisticas?.metodosPago?.tarjeta || reporte?.estadisticas?.metodos?.tarjeta || 0).toLocaleString('es-CO')}</strong></div>
                           <div>📱 Dig: <strong>${(reporte?.estadisticas?.metodosPago?.digital || reporte?.estadisticas?.metodos?.digital || 0).toLocaleString('es-CO')}</strong></div>
                        </div>
                        
                        {/* --- CANALES DE VENTA --- */}
                        <h4 style={{ margin: '20px 0 8px 0', fontSize: '0.9em', color: '#4B5563', textTransform: 'uppercase' }}>🚀 Canales de Venta</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                            <div style={{ padding: '10px', background: 'white', borderRadius: '8px', border: '1px solid #E5E7EB', textAlign: 'center' }}>
                                <span style={{ display: 'block', fontSize: '1.1rem' }}>🏪</span>
                                <small style={{ color: '#6B7280', fontSize: '0.65rem', fontWeight: 'bold' }}>Mostrador</small><br/>
                                <strong style={{ fontSize: '0.9rem' }}>${(reporte?.porTipoOrden?.mesa || 0).toLocaleString('es-CO')}</strong>
                            </div>
                            <div style={{ padding: '10px', background: 'white', borderRadius: '8px', border: '1px solid #E5E7EB', textAlign: 'center' }}>
                                <span style={{ display: 'block', fontSize: '1.1rem' }}>🛵</span>
                                <small style={{ color: '#10B981', fontSize: '0.65rem', fontWeight: 'bold' }}>DOMI</small><br/>
                                <strong style={{ fontSize: '0.9rem', color: '#059669' }}>${(reporte?.porTipoOrden?.domicilio || 0).toLocaleString('es-CO')}</strong>
                            </div>
                            <div style={{ padding: '10px', background: 'white', borderRadius: '8px', border: '1px solid #E5E7EB', textAlign: 'center' }}>
                                <span style={{ display: 'block', fontSize: '1.1rem' }}>📋</span>
                                <small style={{ color: '#F59E0B', fontSize: '0.65rem', fontWeight: 'bold' }}>Encargo</small><br/>
                                <strong style={{ fontSize: '0.9rem', color: '#D97706' }}>${(reporte?.porTipoOrden?.llevar || 0).toLocaleString('es-CO')}</strong>
                            </div>
                        </div>

                        {/* --- PROPINAS --- */}
                        <div style={{ marginTop: '20px', padding: '12px', background: '#F9FAFB', border: '1px dashed #D1D5DB', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.9em', color: '#374151', fontWeight: 'bold' }}>🎁 PROPINAS RECAUDADAS:</span>
                            <strong style={{ fontSize: '1.1em', color: '#111827' }}>${(reporte?.estadisticas?.totalPropinas || 0).toLocaleString('es-CO')}</strong>
                        </div>

                        {/* --- 🔥 RANKING DE PRODUCTOS (CORREGIDO PARA FAMA) --- */}
<h4 style={{ margin: '20px 0 8px 0', fontSize: '0.9em', color: '#4B5563', textTransform: 'uppercase' }}>🔥 Top 5 Productos</h4>
<div style={{ backgroundColor: 'white', border: '1px solid #F3F4F6', borderRadius: '8px', padding: '5px 12px' }}>
    {reporte?.estadisticas?.topPlatos?.length > 0 ? (
        reporte.estadisticas.topPlatos.map((plato, idx) => {
            // 🛡️ Extraemos los datos
            const nombre = plato.nombre || plato[0] || "Desconocido";
            const cant = plato.cantidad || plato[1] || 0;

            const esProductoPeso = plato.esVentaPorPeso === true || (Number(cant) % 1 !== 0);

            return (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: idx === (reporte.estadisticas.topPlatos.length - 1) ? 'none' : '1px solid #F3F4F6', fontSize: '0.9em' }}>
                    <span>{idx + 1}. {nombre.toUpperCase()}</span>
                    <strong style={{ color: esProductoPeso ? '#2563EB' : '#10B981' }}>
                        {esProductoPeso ? `${Number(cant).toFixed(3)} Kg` : `x${cant} Und`}
                    </strong>
                </div>
            );
        })
    ) : (
        <p style={{ fontSize: '0.8em', color: '#9CA3AF', padding: '10px 0' }}>Sin datos de platos</p>
    )}
</div>

                        {/* --- VENTAS POR MESERO CON AUDITORÍA (OJITO + COMISIÓN 40%) --- */}
                        <h4 style={{ margin: '20px 0 8px 0', fontSize: '0.9em', color: '#4B5563', textTransform: 'uppercase' }}>
                            👤 Ventas y Rendimiento por Vendedor
                        </h4>

                        <SeccionMeserosAuditoria 
                            porMesero={reporte?.porMesero} 
                            fechaInicio={fechaInicio} 
                            fechaFin={fechaFin} 
                            tenantId={tenantId} 
                        />
                    </>
                )}
            </div>
        </div>
    );
}
function SeccionMeserosAuditoria({ porMesero = {}, fechaInicio, fechaFin, tenantId }) {
    const [meseroSeleccionado, setMeseroSeleccionado] = useState(null);
    const [cargandoDetalle, setCargandoDetalle] = useState(false);
    const [ventasMesero, setVentasMesero] = useState([]);
    const [folioExpandido, setFolioExpandido] = useState(null);
    const [porcentajes, setPorcentajes] = useState({}); // 🧮 Almacena el % manual por vendedor

    const toggleAuditoriaMesero = async (nombre) => {
        if (meseroSeleccionado === nombre) {
            setMeseroSeleccionado(null);
            setVentasMesero([]);
            setFolioExpandido(null);
            return;
        }

        setMeseroSeleccionado(nombre);
        setFolioExpandido(null);
        setCargandoDetalle(true);

        try {
            const res = await fetch('/api/ventas/historial', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fechaSeleccionada: fechaInicio,
                    fechaFin: fechaFin,
                    tenantId: tenantId
                })
            });

            const data = await res.json();
            const lista = data && Array.isArray(data.listaVentas) ? data.listaVentas : [];

            const filtradas = lista.filter(v => 
                v.activo !== false && 
                String(v.mesero || 'Caja').trim().toUpperCase() === String(nombre).trim().toUpperCase()
            );

            setVentasMesero(filtradas);
        } catch (error) {
            console.error("Error auditando mesero:", error);
            alert("No se pudo cargar el detalle de ventas del mesero");
        } finally {
            setCargandoDetalle(false);
        }
    };

    const listaEntries = Object.entries(porMesero || {});
    if (listaEntries.length === 0) {
        return <p style={{ fontSize: '0.8em', color: '#9CA3AF' }}>Sin datos de meseros</p>;
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {listaEntries.map(([nombre, totalVendido]) => {
                // 🧮 Cálculo interactivo: toma el % manual escrito o 40% por defecto
                const pctActual = porcentajes[nombre] !== undefined ? porcentajes[nombre] : 40;
                const valorPct = Number(pctActual) || 0;
                const comision = Math.round(Number(totalVendido || 0) * (valorPct / 100));
                const estaAbierto = meseroSeleccionado === nombre;

                return (
                    <div 
                        key={nombre} 
                        style={{ 
                            border: '1px solid #E5E7EB', 
                            borderRadius: '8px', 
                            backgroundColor: estaAbierto ? '#F9FAFB' : '#FFFFFF',
                            overflow: 'hidden'
                        }}
                    >
                        {/* Fila superior: Vendedor + Input de % manual + Totales + Ojito */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px' }}>
                            <div>
                                <strong style={{ fontSize: '0.95rem', color: '#111827' }}>👤 {nombre}</strong>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '3px' }}>
                                    {/* 🧮 Casilla calculadora de porcentaje */}
                                    <input 
                                        type="number"
                                        min="0"
                                        max="100"
                                        value={pctActual}
                                        onClick={(e) => e.stopPropagation()}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setPorcentajes(prev => ({ ...prev, [nombre]: val }));
                                        }}
                                        style={{
                                            width: '45px',
                                            padding: '2px 4px',
                                            fontSize: '0.75rem',
                                            fontWeight: 'bold',
                                            textAlign: 'center',
                                            borderRadius: '4px',
                                            border: '1px solid #10B981',
                                            outline: 'none',
                                            backgroundColor: '#ECFDF5',
                                            color: '#047857'
                                        }}
                                    />
                                    <span style={{ fontSize: '0.78rem', color: '#059669', fontWeight: '700' }}>
                                        % Comisión: ${comision.toLocaleString('es-CO')}
                                    </span>
                                </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <strong style={{ fontSize: '1rem', color: '#111827' }}>
                                    ${Number(totalVendido || 0).toLocaleString('es-CO')}
                                </strong>

                                <button
                                    type="button"
                                    onClick={() => toggleAuditoriaMesero(nombre)}
                                    title="Ver mesas y platos vendidos"
                                    style={{
                                        backgroundColor: estaAbierto ? '#10B981' : '#E2E8F0',
                                        color: estaAbierto ? 'white' : '#334155',
                                        border: 'none',
                                        borderRadius: '6px',
                                        padding: '6px 10px',
                                        cursor: 'pointer',
                                        fontWeight: 'bold',
                                        fontSize: '0.9rem'
                                    }}
                                >
                                    👁️
                                </button>
                            </div>
                        </div>

                        {/* Despliegue de Ventas y Platos (SCROLL INDEPENDIENTE BLINDADO) */}
                        {estaAbierto && (
                            <div style={{ padding: '10px 12px', borderTop: '1px dashed #D1D5DB', backgroundColor: '#FFFFFF' }}>
                                {cargandoDetalle ? (
                                    <p style={{ fontSize: '0.8rem', color: '#6B7280', margin: 0, padding: '10px 0', textAlign: 'center' }}>
                                        ⌛ Obteniendo facturas de {nombre}...
                                    </p>
                                ) : ventasMesero.length === 0 ? (
                                    <p style={{ fontSize: '0.8rem', color: '#9CA3AF', margin: 0, padding: '10px 0', textAlign: 'center' }}>
                                        No hay registros detallados para este periodo.
                                    </p>
                                ) : (
                                    <div style={{ 
                                        maxHeight: '300px', 
                                        minHeight: 0,
                                        overflowY: 'auto', 
                                        overscrollBehavior: 'contain', // 🛡️ Evita que el scroll se trabe con el modal padre
                                        WebkitOverflowScrolling: 'touch',
                                        display: 'flex', 
                                        flexDirection: 'column', 
                                        gap: '8px', 
                                        paddingRight: '6px' 
                                    }}>
                                        {ventasMesero.map(v => {
                                            const subtotalVenta = Number(v.totalPagado || 0);
                                            const comisionMesa = Math.round(subtotalVenta * (valorPct / 100));
                                            const platos = v.platosVendidosV2 || v.platos_vendidos || [];
                                            const detalleAbierto = folioExpandido === v.folio;

                                            return (
                                                <div 
                                                    key={v.folio} 
                                                    style={{ 
                                                        border: '1px solid #F1F5F9', 
                                                        borderRadius: '6px', 
                                                        padding: '8px', 
                                                        backgroundColor: detalleAbierto ? '#F8FAFC' : '#FFFFFF',
                                                        flexShrink: 0
                                                    }}
                                                >
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <div>
                                                            <strong style={{ fontSize: '0.85rem', color: '#1E293B' }}>
                                                                Cliente: {v.mesa || 'General'}
                                                            </strong>
                                                            <div style={{ fontSize: '0.7rem', color: '#64748B' }}>
                                                                {v.folio} {v.fechaLocal ? `• ${v.fechaLocal.split(' ')[1] || ''}` : ''}
                                                            </div>
                                                        </div>

                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            <div style={{ textAlign: 'right' }}>
                                                                <div style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>
                                                                    ${subtotalVenta.toLocaleString('es-CO')}
                                                                </div>
                                                                <div style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 'bold' }}>
                                                                    ${comisionMesa.toLocaleString('es-CO')}
                                                                </div>
                                                            </div>

                                                            <button
                                                                type="button"
                                                                onClick={() => setFolioExpandido(detalleAbierto ? null : v.folio)}
                                                                style={{
                                                                    border: 'none',
                                                                    background: 'none',
                                                                    color: detalleAbierto ? '#EF4444' : '#2563EB',
                                                                    cursor: 'pointer',
                                                                    fontSize: '0.75rem',
                                                                    fontWeight: 'bold',
                                                                    padding: '4px'
                                                                }}
                                                            >
                                                                {detalleAbierto ? 'OCULTAR' : 'VER'}
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* Lista de productos cobrados */}
                                                    {detalleAbierto && (
                                                        <div style={{ marginTop: '8px', paddingTop: '6px', borderTop: '1px dashed #E2E8F0', fontSize: '0.78rem' }}>
                                                            {platos.map((p, idx) => (
                                                                <div key={p._key || idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', color: '#334155' }}>
                                                                    <span><strong>{p.cantidad}x</strong> {p.nombrePlato || p.nombre || 'Ítem'}</span>
                                                                    <span>${(Number(p.precioUnitario || p.precio || 0) * Number(p.cantidad || 1)).toLocaleString('es-CO')}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}