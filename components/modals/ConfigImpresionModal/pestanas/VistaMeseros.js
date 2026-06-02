'use client';
import React from 'react';

export default function VistaMeseros({
    handleGuardarMesero,
    editandoMeseroId,
    cancelarEdicionMesero,
    meseroNombre,
    setMeseroNombre,
    meseroActivo,     
    setMeseroActivo,
    guardando,
    busquedaMesero,
    setBusquedaMesero,
    meserosFiltrados,
    seleccionarMeseroParaEditar,
    handleBorrarMesero
}) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* FORMULARIO DINÁMICO SUPERIOR */}
            <form 
                onSubmit={handleGuardarMesero} 
                style={{ 
                    background: editandoMeseroId ? '#eff6ff' : '#f9fafb', 
                    padding: '14px', 
                    borderRadius: '10px', 
                    border: editandoMeseroId ? '2px dashed #3b82f6' : '1px solid #e5e7eb', 
                    transition: 'all 0.3s' 
                }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <h4 style={{ margin: 0, color: editandoMeseroId ? '#1e40af' : '#374151', fontSize: '0.85rem', fontWeight: 'bold', textTransform: 'uppercase' }}>
                        {editandoMeseroId ? '🔄 MODIFICAR VENDEDOR SELECCIONADO' : '👥 REGISTRAR NUEVO VENDEDOR / MESERO'}
                    </h4>
                    {editandoMeseroId && (
                        <button 
                            type="button" 
                            onClick={cancelarEdicionMesero} 
                            style={{ border: 'none', background: '#ef4444', color: 'white', padding: '3px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold', cursor: 'pointer' }}
                        >
                            CREAR NUEVO X
                        </button>
                    )}
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr 0.8fr', gap: '8px', alignItems: 'end' }}>
    <div>
        <label style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#6b7280', display: 'block', marginBottom: '4px' }}>Nombre del Vendedor(a)</label>
        <input 
            type="text" 
            placeholder="Ej: MARÍA ANTONIA o CARLOS PINZÓN" 
            value={meseroNombre} 
            onChange={e => setMeseroNombre(e.target.value)} 
            required 
            style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db', outline: 'none', textTransform: 'uppercase' }} 
        />
    </div>

    {/* 🚀 NUEVO CONTROL CHECKBOX PARA ESTADO ACTIVO */}
    <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#fff', border: '1px solid #d1d5db', borderRadius: '6px', padding: '9px 8px', height: '37px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: 'bold', color: '#374151', cursor: 'pointer', width: '100%' }}>
            <input 
                type="checkbox" 
                checked={meseroActivo} 
                onChange={e => setMeseroActivo(e.target.checked)} 
                style={{ cursor: 'pointer', width: '15px', height: '15px' }} 
            />
            ¿Usuario Activo?
        </label>
    </div>
    
    <button 
        type="submit" 
        disabled={guardando} 
        style={{ 
            padding: '9px', 
            backgroundColor: editandoMeseroId ? '#2563eb' : '#10b981', 
            color: 'white', 
            border: 'none', 
            borderRadius: '6px', 
            fontWeight: 'bold', 
            cursor: 'pointer', 
            fontSize: '0.8rem', 
            textTransform: 'uppercase',
            height: '37px'
        }}
    >
        {editandoMeseroId ? '💾 GUARDAR' : '🚀 AGREGAR'}
    </button>
</div>
            </form>

            {/* TABLA DE PERSONAL ACTIVO */}
            <label style={{ display: 'block', fontWeight: 'bold', fontSize: '0.8rem', color: '#374151', textTransform: 'uppercase', marginBottom: '2px' }}>Vendedores Registrados en el POS (Clic para editar)</label>
            <div style={{ position: 'relative', marginBottom: '8px' }}>
                <input 
                    type="text" 
                    placeholder="🔍 Buscar vendedor por nombre..." 
                    value={busquedaMesero} 
                    onChange={(e) => setBusquedaMesero(e.target.value)} 
                    style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.85rem', outline: 'none', background: '#fff' }} 
                />
            </div>
            
            <div style={{ overflowY: 'auto', maxHeight: '200px', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', backgroundColor: 'white' }}>
                    <thead style={{ position: 'sticky', top: 0, background: '#f3f4f6', zIndex: 10 }}>
                        <tr style={{ borderBottom: '2px solid #e5e7eb', color: '#374151' }}>
                            <th style={{ padding: '10px', textAlign: 'left' }}>NOMBRE DEL PERSONAL</th>
                            <th style={{ padding: '10px', width: '50px', textAlign: 'center' }}></th>
                        </tr>
                    </thead>
                    <tbody>
                        {meserosFiltrados.map((item) => {
                            const siendoEditado = editandoMeseroId === item._id;
                            
                            return (
                                <tr 
                                    key={item._id} 
                                    onClick={() => seleccionarMeseroParaEditar(item)}
                                    style={{ 
                                        borderBottom: '1px solid #f3f4f6', 
                                        cursor: 'pointer', 
                                        backgroundColor: siendoEditado ? '#eff6ff' : 'transparent', 
                                        transition: 'background 0.15s' 
                                    }}
                                    onMouseEnter={(e) => !siendoEditado && (e.currentTarget.style.backgroundColor = '#f9fafb')}
                                    onMouseLeave={(e) => !siendoEditado && (e.currentTarget.style.backgroundColor = 'transparent')}
                                >
                                    <td style={{ padding: '10px', fontWeight: 'bold', color: item.activo !== false ? '#374151' : '#9ca3af', textTransform: 'uppercase' }}>
    👤 {item.nombre} 
    {siendoEditado && <span style={{ color: '#2563eb', fontSize: '0.75rem', fontWeight: 'normal' }}> (en formulario)</span>}
    {/* 🚀 INDICADOR DE ESTADO EN LA LISTA */}
    {item.activo === false && <span style={{ color: '#ef4444', fontSize: '0.7rem', marginLeft: '6px', fontWeight: 'normal', background: '#fee2e2', padding: '2px 6px', borderRadius: '4px' }}>🚫 INACTIVO EN POS</span>}
</td>
                                    <td style={{ padding: '10px', textAlign: 'center' }}>
                                        <button 
                                            onClick={(e) => { 
                                                e.stopPropagation(); 
                                                handleBorrarMesero(item._id); 
                                            }} 
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '1rem' }}
                                        >
                                            🗑️
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                        {meserosFiltrados.length === 0 && (
                            <tr>
                                <td colSpan="2" style={{ padding: '15px', color: '#9ca3af', textAlign: 'center' }}>No hay vendedores registrados en este negocio.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}