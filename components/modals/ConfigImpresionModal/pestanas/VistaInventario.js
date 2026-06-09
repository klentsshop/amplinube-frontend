'use client';
import React from 'react';

export default function VistaInventario({
    handleGuardarInventario,
    idItemEditando,
    cancelarEdicion,
    invNombre,
    setInvNombre,
    invStockActual,
    setInvStockActual,
    invStockMinimo,
    setInvStockMinimo,
    invBarcode,
    setInvBarcode,
    invCodigoBalanza,
    setInvCodigoBalanza,
    guardando,
    busquedaInv,
    setBusquedaInv,
    inventarioFiltrado,
    seleccionarParaEditar,
    handleBorrarInventario
}) {
    const [subPestana, setSubPestana] = React.useState(idItemEditando ? 'formulario' : 'listado');
    return (
        /* 📱 CONTENEDOR PADRE BLINDADO: Fija la cabecera con pestañas arriba */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: 'calc(100vh - 140px)', overflowY: 'hidden' }}>
            
            {/* 📑 BOTONERA DE PESTAÑAS RESPONSIVAS */}
            <div style={{ display: 'flex', width: '100%', borderBottom: '2px solid #e5e7eb', backgroundColor: '#fff', borderRadius: '8px 8px 0 0', overflow: 'hidden', flexShrink: 0 }}>
                <button 
                    type="button"
                    onClick={() => setSubPestana('listado')}
                    style={{ flex: 1, padding: '12px', fontSize: '0.85rem', fontWeight: 'bold', border: 'none', backgroundColor: subPestana === 'listado' ? '#fff' : '#f3f4f6', color: subPestana === 'listado' ? '#10b981' : '#6b7280', borderBottom: subPestana === 'listado' ? '3px solid #10b981' : 'none', cursor: 'pointer', transition: 'all 0.2s' }}
                >
                    📋 LISTADO ({inventarioFiltrado.length})
                </button>
                <button 
                    type="button"
                    onClick={() => setSubPestana('formulario')}
                    style={{ flex: 1, padding: '12px', fontSize: '0.85rem', fontWeight: 'bold', border: 'none', backgroundColor: subPestana === 'formulario' ? '#fff' : '#f3f4f6', color: subPestana === 'formulario' ? (idItemEditando ? '#3b82f6' : '#10b981') : '#6b7280', borderBottom: subPestana === 'formulario' ? `3px solid ${idItemEditando ? '#3b82f6' : '#10b981'}` : 'none', cursor: 'pointer', transition: 'all 0.2s' }}
                >
                    {idItemEditando ? '🔄 MODIFICAR INSUMO' : '➕ REGISTRAR STOCK'}
                </button>
            </div>
            {/* VISTA A: FORMULARIO DINÁMICO SUPERIOR */}
            {subPestana === 'formulario' && (
                <form onSubmit={(e) => {
                    handleGuardarInventario(e);
                    setSubPestana('listado'); // Retorna al listado al enviar de forma exitosa
                }} style={{ background: idItemEditando ? '#eff6ff' : '#f9fafb', padding: '14px', borderRadius: '10px', border: idItemEditando ? '2px dashed #3b82f6' : '1px solid #e5e7eb', transition: 'all 0.3s', overflowY: 'auto', paddingBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <h4 style={{ margin: 0, color: idItemEditando ? '#1e40af' : '#374151', fontSize: '0.85rem', fontWeight: 'bold', textTransform: 'uppercase' }}>
                        {idItemEditando ? '🔄 MODIFICAR INSUMO SELECCIONADO' : '➕ REGISTRAR MATERIA PRIMA / STOCK'}
                    </h4>
                    {idItemEditando && (
                        <button type="button" onClick={() => { cancelarEdicion(); setSubPestana('listado'); }} style={{ border: 'none', background: '#ef4444', color: 'white', padding: '3px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold', cursor: 'pointer' }}>CREAR NUEVO X</button>
                    )}
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                    <div>
                        <label style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#6b7280', display: 'block', marginBottom: '4px' }}>Nombre del Ítem</label>
                        <input type="text" placeholder="Ej: Carne o Coca Cola" value={invNombre} onChange={e => setInvNombre(e.target.value)} required style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db', outline: 'none', textTransform: 'uppercase' }} />
                    </div>
                    <div>
                        <label style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#6b7280', display: 'block', marginBottom: '4px' }}>Stock Real</label>
                        <input type="number" placeholder="0" value={invStockActual} onChange={e => setInvStockActual(e.target.value)} required style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db', outline: 'none', textAlign: 'center' }} />
                    </div>
                    <div>
                        <label style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#6b7280', display: 'block', marginBottom: '4px' }}>Alerta Mínimo</label>
                        <input type="number" value={invStockMinimo} onChange={e => setInvStockMinimo(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db', outline: 'none', textAlign: 'center' }} />
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 1fr', gap: '8px', alignItems: 'end' }}>
                    <div>
                        <label style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#6b7280', display: 'block', marginBottom: '4px' }}>Código Barras (Pistola)</label>
                        <input type="text" placeholder="Opcional" value={invBarcode} onChange={e => setInvBarcode(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db', outline: 'none' }} />
                    </div>
                    <div>
                        <label style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#6b7280', display: 'block', marginBottom: '4px' }}>Balanza (Código PLU)</label>
                        <input type="text" maxLength={5} placeholder="Ej: 00120" value={invCodigoBalanza} onChange={e => setInvCodigoBalanza(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db', outline: 'none' }} />
                    </div>
                    <button type="submit" disabled={guardando} style={{ padding: '9px', backgroundColor: idItemEditando ? '#2563eb' : '#10b981', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.8rem', textTransform: 'uppercase' }}>
                        {idItemEditando ? '💾 GUARDAR' : '🚀 AGREGAR'}
                    </button>
                </div>
            </form>
          )}

            {/* VISTA B: TABLA SOLO LECTURA INTERACTIVA */}
            {subPestana === 'listado' && (
                <>
                <label style={{ display: 'block', fontWeight: 'bold', fontSize: '0.8rem', color: '#374151', textTransform: 'uppercase', marginBottom: '2px' }}>Existencias en Sistema (Clic en fila para editar)</label>
            <div style={{ position: 'relative', marginBottom: '8px' }}>
                <input 
                    type="text" 
                    placeholder="🔍 Buscar insumo por nombre..." 
                    value={busquedaInv} 
                    onChange={(e) => setBusquedaInv(e.target.value)} 
                    style={{ width: '100%', padding: '6px 10px 6px 32px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.85rem', outline: 'none', background: '#fff', transition: 'border-color 0.2s' }} 
                    onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                    onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                />
                <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', pointerEvents: 'none', fontSize: '0.9rem' }}></span>
            </div>
            
            <div style={{ overflowY: 'auto', maxHeight: '200px', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', backgroundColor: 'white' }}>
                    <thead style={{ position: 'sticky', top: 0, background: '#f3f4f6', zIndex: 10 }}>
                        <tr style={{ borderBottom: '2px solid #e5e7eb', color: '#374151' }}>
                            <th style={{ padding: '10px', textAlign: 'left' }}>INSUMO</th>
                            <th style={{ padding: '10px', width: '110px', textAlign: 'center' }}>STOCK REAL</th>
                            <th style={{ padding: '10px', width: '90px', textAlign: 'center' }}>MÍNIMO</th>
                            <th style={{ padding: '10px', width: '50px', textAlign: 'center' }}></th>
                        </tr>
                    </thead>
                    <tbody>
                        {inventarioFiltrado.map((item) => {
    // 🧠 BISTURÍ SENIOR: Supabase maneja 'id', Sanity manejaba '_id'. 
    // Capturamos el que venga disponible de forma segura.
    const idReal = item.id || item._id; 
    const siendoEditado = idItemEditando === idReal;
    
    return (
        <tr 
            key={idReal} 
            onClick={() => { seleccionarParaEditar(item); setSubPestana('formulario'); }}
            style={{ 
                borderBottom: '1px solid #f3f4f6', 
                cursor: 'pointer', 
                backgroundColor: siendoEditado ? '#eff6ff' : 'transparent', 
                transition: 'background 0.15s' 
            }}
            onMouseEnter={(e) => !siendoEditado && (e.currentTarget.style.backgroundColor = '#f9fafb')}
            onMouseLeave={(e) => !siendoEditado && (e.currentTarget.style.backgroundColor = 'transparent')}
        >
            <td style={{ padding: '10px', fontWeight: 'bold', color: '#374151', textTransform: 'uppercase' }}>
                {item.nombre} {siendoEditado && <span style={{ color: '#2563eb', fontSize: '0.75rem', fontWeight: 'normal' }}>(en formulario)</span>}
            </td>
            
            {/* 🥩 SOPORTE HÍBRIDO DE COLUMNAS: Lee stockActual o stock_actual según la respuesta */}
            <td style={{ padding: '10px', textAlign: 'center', color: '#dc2626', fontWeight: '900', fontSize: '0.95rem' }}>
                {item.stockActual !== undefined ? item.stockActual : (item.stock_actual || 0)}
            </td>
            
            <td style={{ padding: '10px', textAlign: 'center', color: '#4b5563', fontWeight: '500' }}>
                {item.stockMinimo !== undefined ? item.stockMinimo : (item.stock_minimo || 5)}
            </td>
            
            <td style={{ padding: '10px', textAlign: 'center' }}>
                <button 
                    onClick={(e) => { 
                        e.stopPropagation(); // 🛡️ Evita que se abra el formulario de edición al hacer clic en borrar
                        handleBorrarInventario(idReal); // 🚀 Mandamos el ID real relacional de Supabase
                    }} 
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '1rem' }}
                >
                    🗑️
                </button>
            </td>
        </tr>
    );
})}
{inventarioFiltrado.length === 0 && (
    <tr>
        <td colSpan="4" style={{ padding: '15px', color: '#9ca3af', textAlign: 'center' }}>No se encontraron insumos.</td>
    </tr>
)}
                    </tbody>
                </table>
            </div>
            </>
            )}
        </div>
    );
}