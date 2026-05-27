'use client';
import React from 'react';

export default function VistaGastos({
    handleGuardarGasto,
    editandoGastoId,
    cancelarEdicionGasto,
    gastoDescripcion,
    setGastoDescripcion,
    gastoMonto,
    setGastoMonto,
    guardando,
    busquedaGasto,
    setBusquedaGasto,
    gastosFiltrados,
    seleccionarGastoParaEditar,
    handleBorrarGasto
}) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* FORMULARIO DINÁMICO SUPERIOR */}
            <form 
                onSubmit={handleGuardarGasto} 
                style={{ 
                    background: editandoGastoId ? '#eff6ff' : '#f9fafb', 
                    padding: '14px', 
                    borderRadius: '10px', 
                    border: editandoGastoId ? '2px dashed #3b82f6' : '1px solid #e5e7eb', 
                    transition: 'all 0.3s' 
                }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <h4 style={{ margin: 0, color: editandoGastoId ? '#1e40af' : '#374151', fontSize: '0.85rem', fontWeight: 'bold', textTransform: 'uppercase' }}>
                        {editandoGastoId ? '🔄 MODIFICAR GASTO SELECCIONADO' : '💸 REGISTRAR NUEVO GASTO / EGRESO'}
                    </h4>
                    {editandoGastoId && (
                        <button 
                            type="button" 
                            onClick={cancelarEdicionGasto} 
                            style={{ border: 'none', background: '#ef4444', color: 'white', padding: '3px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold', cursor: 'pointer' }}
                        >
                            CREAR NUEVO X
                        </button>
                    )}
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '8px', alignItems: 'end' }}>
                    <div>
                        <label style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#6b7280', display: 'block', marginBottom: '4px' }}>¿En qué se gastó? (Descripción)</label>
                        <input 
                            type="text" 
                            placeholder="Ej: Gas, bolsas, verduras, carbón..." 
                            value={gastoDescripcion} 
                            onChange={e => setGastoDescripcion(e.target.value)} 
                            required 
                            style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db', outline: 'none', textTransform: 'uppercase' }} 
                        />
                    </div>
                    <div>
                        <label style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#6b7280', display: 'block', marginBottom: '4px' }}>Valor ($)</label>
                        <input 
                            type="number" 
                            placeholder="0" 
                            value={gastoMonto} 
                            onChange={e => setGastoMonto(e.target.value)} 
                            required 
                            style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db', outline: 'none', textAlign: 'right' }} 
                        />
                    </div>
                    
                    <button 
                        type="submit" 
                        disabled={guardando} 
                        style={{ 
                            padding: '9px', 
                            backgroundColor: editandoGastoId ? '#2563eb' : '#10b981', 
                            color: 'white', 
                            border: 'none', 
                            borderRadius: '6px', 
                            fontWeight: 'bold', 
                            cursor: 'pointer', 
                            fontSize: '0.8rem', 
                            textTransform: 'uppercase' 
                        }}
                    >
                        {editandoGastoId ? '💾 GUARDAR' : '🚀 AGREGAR'}
                    </button>
                </div>
            </form>

            {/* TABLA SOLO LECTURA INTERACTIVA */}
            <label style={{ display: 'block', fontWeight: 'bold', fontSize: '0.8rem', color: '#374151', textTransform: 'uppercase', marginBottom: '2px' }}>Historial de Egresos (Clic en fila para editar)</label>
            <div style={{ position: 'relative', marginBottom: '8px' }}>
                <input 
                    type="text" 
                    placeholder="🔍 Buscar gasto por descripción..." 
                    value={busquedaGasto} 
                    onChange={(e) => setBusquedaGasto(e.target.value)} 
                    style={{ width: '100%', padding: '6px 10px 6px 10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.85rem', outline: 'none', background: '#fff' }} 
                />
            </div>
            
            <div style={{ overflowY: 'auto', maxHeight: '200px', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', backgroundColor: 'white' }}>
                    <thead style={{ position: 'sticky', top: 0, background: '#f3f4f6', zIndex: 10 }}>
                        <tr style={{ borderBottom: '2px solid #e5e7eb', color: '#374151' }}>
                            <th style={{ padding: '10px', textAlign: 'left' }}>CONCEPTO / FECHA</th>
                            <th style={{ padding: '10px', width: '130px', textAlign: 'right' }}>VALOR CO</th>
                            <th style={{ padding: '10px', width: '50px', textAlign: 'center' }}></th>
                        </tr>
                    </thead>
                    <tbody>
                        {gastosFiltrados.map((item) => {
                            const siendoEditado = editandoGastoId === item._id;
                            const fechaLegible = item.fecha ? new Date(item.fecha).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' }) : 'Sin fecha';
                            
                            return (
                                <tr 
                                    key={item._id} 
                                    onClick={() => seleccionarGastoParaEditar(item)}
                                    style={{ 
                                        borderBottom: '1px solid #f3f4f6', 
                                        cursor: 'pointer', 
                                        backgroundColor: siendoEditado ? '#eff6ff' : 'transparent', 
                                        transition: 'background 0.15s' 
                                    }}
                                    onMouseEnter={(e) => !siendoEditado && (e.currentTarget.style.backgroundColor = '#f9fafb')}
                                    onMouseLeave={(e) => !siendoEditado && (e.currentTarget.style.backgroundColor = 'transparent')}
                                >
                                    <td style={{ padding: '10px' }}>
                                        <div style={{ fontWeight: 'bold', color: '#374151', textTransform: 'uppercase' }}>
                                            {item.descripcion} {siendoEditado && <span style={{ color: '#2563eb', fontSize: '0.75rem', fontWeight: 'normal' }}>(en formulario)</span>}
                                        </div>
                                        <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: '2px' }}>
                                            🗓️ {fechaLegible}
                                        </div>
                                    </td>
                                    <td style={{ padding: '10px', textAlign: 'right', color: '#dc2626', fontWeight: '900', fontSize: '0.95rem' }}>
                                        ${Number(item.monto || 0).toLocaleString('es-CO')}
                                    </td>
                                    <td style={{ padding: '10px', textAlign: 'center' }}>
                                        <button 
                                            onClick={(e) => { 
                                                e.stopPropagation(); 
                                                handleBorrarGasto(item._id); 
                                            }} 
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '1rem' }}
                                        >
                                            🗑️
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                        {gastosFiltrados.length === 0 && (
                            <tr>
                                <td colSpan="3" style={{ padding: '15px', color: '#9ca3af', textAlign: 'center' }}>No se encontraron registros de gastos.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}