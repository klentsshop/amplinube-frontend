'use client';
import React from 'react';
import { User, Phone, MapPin, X, Check, Trash2, UserPlus } from 'lucide-react';

export default function ModalClientesDomicilios({
    isOpen,
    onClose,
    handleGuardarCliente,
    idClienteEditando,
    cancelarEdicion,
    cliNombre,
    setCliNombre,
    cliTelefono,
    setCliTelefono,
    cliDireccion,
    setCliDireccion,
    guardando,
    busquedaCli,
    setBusquedaCli,
    clientesFiltrados,
    seleccionarParaEditar,
    handleBorrarCliente,
    handleCargarALaOrden, // 🚀 El botón maestro para amarrarlo a la comanda viva
    tenantId
}) {
    React.useEffect(() => {
        if (isOpen && !idClienteEditando && /^\d+$/.test(busquedaCli.trim())) {
            if (busquedaCli.trim().length <= 10) { // Límite estándar de celular en Colombia
                setCliTelefono(busquedaCli.trim());
            }
        }
    }, [busquedaCli, isOpen, idClienteEditando, setCliTelefono]);
    if (!isOpen) return null;

    return (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 8000, padding: '15px' }}>
            <div style={{ background: 'white', padding: '25px', borderRadius: '15px', width: '100%', maxWidth: '580px', maxHeight: '92vh', overflowY: 'auto', position: 'relative', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)' }}>
                
                {/* CABECERA DEL MODAL */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', borderBottom: '2px solid #f3f4f6', paddingBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '1.5rem' }}>🛵</span>
                        <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '800', color: '#1e293b' }}>DIRECTORIO DE CLIENTES / DOMICILIOS</h2>
                    </div>
                    <button onClick={onClose} style={{ fontSize: '1.5em', border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8' }}>×</button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    
                    {/* FORMULARIO DINÁMICO SUPERIOR (ESTRUCTURA INVENTARIO COHERENTE) */}
                    <form onSubmit={handleGuardarCliente} style={{ background: idClienteEditando ? '#eff6ff' : '#f8fafc', padding: '14px', borderRadius: '10px', border: idClienteEditando ? '2px dashed #3b82f6' : '1px solid #e2e8f0', transition: 'all 0.3s' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                            <h4 style={{ margin: 0, color: idClienteEditando ? '#1e40af' : '#0f766e', fontSize: '0.8rem', fontWeight: 'bold', letterSpacing: '0.5px' }}>
                                {idClienteEditando ? '🔄 MODIFICAR DATOS DEL CLIENTE' : '➕ REGISTRAR NUEVO CLIENTE EN BASE DE DATOS'}
                            </h4>
                            {idClienteEditando && (
                                <button type="button" onClick={cancelarEdicion} style={{ border: 'none', background: '#ef4444', color: 'white', padding: '3px 8px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 'bold', cursor: 'pointer' }}>CREAR NUEVO X</button>
                            )}
                        </div>
                        
                        {/* FILA 1: NOMBRE Y TELÉFONO */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1.2fr', gap: '8px', marginBottom: '10px' }}>
                            <div>
                                <label style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#475569', display: 'block', marginBottom: '4px' }}>Nombre Completo</label>
                                <input 
                                    type="text" 
                                    placeholder="Ej: JUAN CARLOS GÓMEZ" 
                                    value={cliNombre} 
                                    onChange={e => setCliNombre(e.target.value)} 
                                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); document.getElementById('input_cli_tel')?.focus(); } }} // 👈 Si da Enter, salta al teléfono
                                    required 
                                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', outline: 'none', textTransform: 'uppercase', fontSize: '0.85rem' }} 
                                />
                            </div>
                            <div>
                                <label style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#475569', display: 'block', marginBottom: '4px' }}>Celular / Teléfono</label>
                                <input 
                                    id="input_cli_tel" // 👈 Su identificador para que lo alcancen desde Nombre
                                    type="text" 
                                    placeholder="Ej: 3123456789" 
                                    value={cliTelefono} 
                                    onChange={e => setCliTelefono(e.target.value)} 
                                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); document.getElementById('input_cli_dir')?.focus(); } }} // 👈 Si da Enter, salta a Dirección
                                    required 
                                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', outline: 'none', textAlign: 'center', fontSize: '0.85rem' }} 
                                />
                            </div>
                        </div>

                        {/* FILA 2: DIRECCIÓN Y ACCIÓN */}
                        <div style={{ display: 'grid', gridTemplateColumns: '2.2fr 0.8fr', gap: '8px', alignItems: 'end' }}>
                            <div>
                                <label style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#475569', display: 'block', marginBottom: '4px' }}>Dirección de Entrega</label>
                                <input 
                                    id="input_cli_dir" // 👈 Su identificador para que lo alcancen desde Teléfono
                                    type="text" 
                                    placeholder="Ej: CALLE 15 # 4 - 20 BARRIO CENTRO" 
                                    value={cliDireccion} 
                                    onChange={e => setCliDireccion(e.target.value)} 
                                    required 
                                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', outline: 'none', textTransform: 'uppercase', fontSize: '0.85rem' }} 
                                />
                            </div>
                            <button type="submit" disabled={guardando} style={{ padding: '9px', backgroundColor: idClienteEditando ? '#2563eb' : '#0d9488', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.75rem', textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                {idClienteEditando ? '💾 GUARDAR' : '🚀 AGREGAR'}
                            </button>
                        </div>
                    </form>

                    {/* BUSCADOR DE CLIENTES */}
                    <label style={{ display: 'block', fontWeight: 'bold', fontSize: '0.78rem', color: '#374151', textTransform: 'uppercase', marginBottom: '-6px' }}>
                        Clientes Registrados (Clic para cargar datos al formulario)
                    </label>
                    <div style={{ position: 'relative' }}>
                        <input 
                            type="text" 
                            placeholder="🔍 Buscar por nombre o número de celular..." 
                            value={busquedaCli} 
                            onChange={(e) => setBusquedaCli(e.target.value)} 
                            style={{ width: '100%', padding: '8px 10px 8px 32px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem', outline: 'none', background: '#fff', transition: 'border-color 0.2s' }} 
                            onFocus={(e) => e.target.style.borderColor = '#0d9488'}
                            onBlur={(e) => e.target.style.borderColor = '#cbd5e1'}
                        />
                    </div>
                    
                    {/* TABLA INTERACTIVA DE ENTRADAS */}
                    <div style={{ overflowY: 'auto', maxHeight: '220px', border: '1px solid #e5e7eb', borderRadius: '8px', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', backgroundColor: 'white' }}>
                            <thead style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 10, borderBottom: '2px solid #e2e8f0' }}>
                                <tr style={{ color: '#475569' }}>
                                    <th style={{ padding: '10px', textAlign: 'left' }}>CLIENTE / CONTACTO</th>
                                    <th style={{ padding: '10px', textAlign: 'left' }}>DIRECCIÓN DE ENTREGA</th>
                                    <th style={{ padding: '10px', width: '120px', textAlign: 'center' }}>ACCIONES</th>
                                </tr>
                            </thead>
                            <tbody>
                                {clientesFiltrados.map((item) => {
                                    const siendoEditado = idClienteEditando === item._id;
                                    return (
                                        <tr 
                                            key={item._id} 
                                            onClick={() => seleccionarParaEditar(item)}
                                            style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer', backgroundColor: siendoEditado ? '#eff6ff' : 'transparent', transition: 'background 0.15s' }}
                                            onMouseEnter={(e) => !siendoEditado && (e.currentTarget.style.backgroundColor = '#f8fafc')}
                                            onMouseLeave={(e) => !siendoEditado && (e.currentTarget.style.backgroundColor = 'transparent')}
                                        >
                                            <td style={{ padding: '10px', color: '#1e293b' }}>
                                                <div style={{ fontWeight: 'bold', textTransform: 'uppercase' }}>{item.nombre}</div>
                                                <div style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '3px', marginTop: '2px' }}><Phone size={11}/> {item.telefono}</div>
                                            </td>
                                            <td style={{ padding: '10px', color: '#334155', textTransform: 'uppercase', fontSize: '0.78rem', verticalAlign: 'middle' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><MapPin size={12} style={{ color: '#64748b', flexShrink: 0 }} /> {item.direccion}</div>
                                            </td>
                                            <td style={{ padding: '10px', textAlign: 'center', verticalAlign: 'middle' }}>
                                                <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }} onClick={(e) => e.stopPropagation()}>
                                                    {/* 📌 EL ASIGNADOR MAESTRO: Carga el cliente de la fila a la comanda viva */}
                                                    <button 
                                                    type="button"
                                                    onClick={() => { handleCargarALaOrden(item); onClose(); }} // 👈 Se amarra y se cierra en un solo golpe
                                                    title="Amarrar cliente a este pedido"
                                                    style={{ padding: '4px 8px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '3px' }}
                                                    >
                                                        <Check size={12}/> AMARRAR
                                                    </button>
                                                    <button 
                                                        type="button"
                                                        onClick={() => handleBorrarCliente(item._id)} 
                                                        title="Eliminar del directorio"
                                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '2px' }}
                                                    >
                                                        <Trash2 size={15}/>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {clientesFiltrados.length === 0 && (
                                    <tr>
                                        <td colSpan="3" style={{ padding: '20px', color: '#94a3b8', textAlign: 'center', fontSize: '0.85rem' }}>✍️ No hay clientes con esos criterios. Digita los datos arriba para agregarlo.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                </div>
            </div>
        </div>
    );
}