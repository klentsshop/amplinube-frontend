'use client';
import React, { useState, useEffect } from 'react';

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
    // 🛡️ Estados internos de control para el mapa completo de permisos granulares
    const [verReporte, setVerReporte] = useState(false);
    const [verAdmin, setVerAdmin] = useState(false);
    const [puedeCargarGasto, setPuedeCargarGasto] = useState(false);
    const [verVentas, setVerVentas] = useState(false);
    const [verInventario, setVerInventario] = useState(false);
    const [puedeCobrar, setPuedeCobrar] = useState(false);
    // 🔌 NUEVO: Control de subpestañas dinámicas
    const [subPestana, setSubPestana] = useState(editandoMeseroId ? 'formulario' : 'listado');

    // Forzar el cambio de pestaña si el usuario selecciona un mesero para editar desde el listado
    useEffect(() => {
        if (editandoMeseroId) {
            setSubPestana('formulario');
        }
    }, [editandoMeseroId]);

    // Sincroniza todos los interruptores al alternar la edición o limpiar el formulario
    useEffect(() => {
        if (!editandoMeseroId) {
            setVerReporte(false);
            setVerAdmin(false);
            setPuedeCargarGasto(false);
            setVerVentas(false);
            setVerInventario(false);
            setPuedeCobrar(false);
        } else {
            const meseroMatch = meserosFiltrados.find(m => m._id === editandoMeseroId);
            if (meseroMatch) {
                setVerReporte(meseroMatch.verReporte || false);
                setVerAdmin(meseroMatch.verAdmin || false);
                setPuedeCargarGasto(meseroMatch.puedeCargarGasto || false);
                setVerVentas(meseroMatch.verVentas || false);
                setVerInventario(meseroMatch.verInventario || false);
                setPuedeCobrar(meseroMatch.puedeCobrar || false);
            }
        }
    }, [editandoMeseroId, meserosFiltrados]);
    return (
        /* 📱 CONTENEDOR PADRE BLINDADO: Fija la cabecera con pestañas arriba y controla el espacio */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: 'calc(100vh - 140px)', overflowY: 'hidden' }}>
            
            {/* 📑 BOTONERA DE PESTAÑAS RESPONSIVAS */}
            <div style={{ display: 'flex', width: '100%', borderBottom: '2px solid #e5e7eb', backgroundColor: '#fff', borderRadius: '8px 8px 0 0', overflow: 'hidden', flexShrink: 0 }}>
                <button 
                    type="button"
                    onClick={() => setSubPestana('listado')}
                    style={{ flex: 1, padding: '12px', fontSize: '0.85rem', fontWeight: 'bold', border: 'none', backgroundColor: subPestana === 'listado' ? '#fff' : '#f3f4f6', color: subPestana === 'listado' ? '#10b981' : '#6b7280', borderBottom: subPestana === 'listado' ? '3px solid #10b981' : 'none', cursor: 'pointer', transition: 'all 0.2s' }}
                >
                    📋 LISTADO ({meserosFiltrados.length})
                </button>
                <button 
                    type="button"
                    onClick={() => setSubPestana('formulario')}
                    style={{ flex: 1, padding: '12px', fontSize: '0.85rem', fontWeight: 'bold', border: 'none', backgroundColor: subPestana === 'formulario' ? '#fff' : '#f3f4f6', color: subPestana === 'formulario' ? (editandoMeseroId ? '#3b82f6' : '#10b981') : '#6b7280', borderBottom: subPestana === 'formulario' ? `3px solid ${editandoMeseroId ? '#3b82f6' : '#10b981'}` : 'none', cursor: 'pointer', transition: 'all 0.2s' }}
                >
                    {editandoMeseroId ? '🔄 MODIFICAR PERMISOS' : '➕ REGISTRAR VENDEDOR'}
                </button>
            </div>

            {/* VISTA A: FORMULARIO DINÁMICO SUPERIOR (Sólo si está en pestaña formulario) */}
            {subPestana === 'formulario' && (
                <form 
                    onSubmit={(e) => {
                        handleGuardarMesero(e);
                        setSubPestana('listado'); // Retorna al listado al enviar de forma exitosa
                    }} 
                    style={{ 
                        background: editandoMeseroId ? '#eff6ff' : '#f9fafb', 
                        padding: '14px', 
                        borderRadius: '10px', 
                        border: editandoMeseroId ? '2px dashed #3b82f6' : '1px solid #e5e7eb', 
                        transition: 'all 0.3s',
                        overflowY: 'auto',
                        paddingBottom: '20px'
                    }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <h4 style={{ margin: 0, color: editandoMeseroId ? '#1e40af' : '#374151', fontSize: '0.85rem', fontWeight: 'bold', textTransform: 'uppercase' }}>
                            {editandoMeseroId ? '🔄 MODIFICAR VENDEDOR SELECCIONADO' : '👥 REGISTRAR NUEVO VENDEDOR / MESERO'}
                        </h4>
                        {editandoMeseroId && (
                            <button 
                                type="button" 
                                onClick={() => { cancelarEdicionMesero(); setSubPestana('listado'); }} 
                                style={{ border: 'none', background: '#ef4444', color: 'white', padding: '3px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold', cursor: 'pointer' }}
                            >
                                CREAR NUEVO X
                            </button>
                        )}
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '2.5fr 1.5fr', gap: '8px', alignItems: 'end' }}>
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
                        </div>

                        {/* SECCIÓN INTERRUPTORES DE RESTRICCIÓN DE ROLES GRANULARES */}
                        <div style={{ background: '#fff', padding: '12px', borderRadius: '8px', border: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <span style={{ fontSize: '0.65rem', fontWeight: '900', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px' }}>🛡️ Permisos autorizados para este usuario</span>
                            
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.7rem', fontWeight: 'bold', color: '#374151', cursor: 'pointer' }}>
                                    <input type="checkbox" checked={verReporte} onChange={e => setVerReporte(e.target.checked)} style={{ width: '14px', height: '14px' }} />
                                    🚨 REPORTE
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.7rem', fontWeight: 'bold', color: '#374151', cursor: 'pointer' }}>
                                    <input type="checkbox" checked={verAdmin} onChange={e => setVerAdmin(e.target.checked)} style={{ width: '14px', height: '14px' }} />
                                    ⚙️ ADMIN
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.7rem', fontWeight: 'bold', color: '#374151', cursor: 'pointer' }}>
                                    <input type="checkbox" checked={puedeCargarGasto} onChange={e => setPuedeCargarGasto(e.target.checked)} style={{ width: '14px', height: '14px' }} />
                                    🔸 GASTOS
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.7rem', fontWeight: 'bold', color: '#374151', cursor: 'pointer' }}>
                                    <input type="checkbox" checked={verVentas} onChange={e => setVerVentas(e.target.checked)} style={{ width: '14px', height: '14px' }} />
                                    📊 VENTAS
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.7rem', fontWeight: 'bold', color: '#374151', cursor: 'pointer' }}>
                                    <input type="checkbox" checked={verInventario} onChange={e => setVerInventario(e.target.checked)} style={{ width: '14px', height: '14px' }} />
                                    📦 STOCK
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.7rem', fontWeight: 'bold', color: '#374151', cursor: 'pointer' }}>
                                    <input type="checkbox" checked={puedeCobrar} onChange={e => setPuedeCobrar(e.target.checked)} style={{ width: '14px', height: '14px' }} />
                                    💵 COBRAR
                                </label>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px', borderTop: '1px dashed #f3f4f6', paddingTop: '8px' }}>
                                <button 
                                    type="button" 
                                    disabled={guardando} 
                                    onClick={(e) => {
                                        e.preventDefault();
                                        // Interceptor atómico de payload completo para inyectar al manejador padre
                                        const pseudoEvento = {
                                            preventDefault: () => {},
                                            target: {
                                                verReporte,
                                                verAdmin,
                                                puedeCargarGasto,
                                                verVentas,
                                                verInventario,
                                                puedeCobrar
                                            }
                                        };
                                        handleGuardarMesero(pseudoEvento);
                                        setSubPestana('listado'); // Retorna al listado de forma limpia
                                    }}
                                    style={{ 
                                        padding: '8px 24px', 
                                        backgroundColor: editandoMeseroId ? '#2563eb' : '#10b981', 
                                        color: 'white', 
                                        border: 'none', 
                                        borderRadius: '6px', 
                                        fontWeight: 'bold', 
                                        cursor: 'pointer', 
                                        fontSize: '0.75rem', 
                                        textTransform: 'uppercase',
                                        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                                    }}
                                >
                                    {editandoMeseroId ? '💾 GUARDAR CAMBIOS' : '🚀 REGISTRAR VENDEDOR'}
                                </button>
                            </div>
                        </div>
                    </div>
                </form>
            )}

            {/* VISTA B: TABLA SOLO LECTURA INTERACTIVA (Sólo si está en pestaña listado) */}
            {subPestana === 'listado' && (
                <>
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
                    
                    <div style={{ overflowY: 'auto', maxHeight: '320px', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
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
                                            onClick={() => {
                                                seleccionarMeseroParaEditar(item);
                                                setSubPestana('formulario'); // Abre automáticamente la pestaña de edición
                                            }}
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
                </>
            )}
        </div>
    );
}