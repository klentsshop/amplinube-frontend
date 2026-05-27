'use client';
import React from 'react';

export default function VistaSeguridad({
    pinCajero,
    setPinCajero,
    pinAdmin,
    setPinAdmin,
    handleGuardarSeguridad,
    guardando,
    itemIdSeguridad
}) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* CUADRO INFORMATIVO DE SEGURIDAD */}
            <div style={{ background: '#fffbeb', padding: '12px', borderRadius: '8px', border: '1px solid #fef3c7' }}>
                <p style={{ margin: 0, fontSize: '0.78rem', color: '#b45309', lineHeight: '1.4' }}>
                    🔒 <strong>Control de Accesos del POS:</strong> Los PINs deben tener entre 4 y 6 dígitos numéricos o caracteres. Estos códigos se solicitarán en el punto de venta para validar los cobros o restringir la visualización de los reportes administrativos.
                </p>
            </div>

            {/* FORMULARIO ÚNICO DE EDICIÓN */}
            <form 
                onSubmit={handleGuardarSeguridad}
                style={{ 
                    background: 'white', 
                    padding: '16px', 
                    borderRadius: '10px', 
                    border: '1px solid #e5e7eb',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                }}
            >
                <h4 style={{ margin: '0 0 14px 0', color: '#1f2937', fontSize: '0.85rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {itemIdSeguridad ? '⚙️ MODIFICAR PINES DE SEGURIDAD' : '🔑 CONFIGURAR PINES INICIALES'}
                </h4>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
                    {/* CAMPO: PIN CAJERO */}
                    <div>
                        <label style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#4b5563', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>
                            PIN de Cajero (Habilitar Cobro)
                        </label>
                        <input 
                            type="password" 
                            maxLength={6}
                            placeholder="Ej: 1234" 
                            value={pinCajero} 
                            onChange={e => setPinCajero(e.target.value)} 
                            required 
                            style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #d1d5db', outline: 'none', fontSize: '0.9rem', letterSpacing: '3px', fontWeight: 'bold' }} 
                        />
                    </div>
                    
                    {/* CAMPO: PIN ADMIN */}
                    <div>
                        <label style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#4b5563', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>
                            PIN de Administrador (Reportes)
                        </label>
                        <input 
                            type="password" 
                            maxLength={6}
                            placeholder="Ej: 9876" 
                            value={pinAdmin} 
                            onChange={e => setPinAdmin(e.target.value)} 
                            required 
                            style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #d1d5db', outline: 'none', fontSize: '0.9rem', letterSpacing: '3px', fontWeight: 'bold' }} 
                        />
                    </div>
                </div>
                
                {/* BOTÓN DE ACTUALIZACIÓN ÚNICA */}
                <button 
                    type="submit" 
                    disabled={guardando} 
                    style={{ 
                        width: '100%',
                        padding: '10px', 
                        backgroundColor: '#2563eb', 
                        color: 'white', 
                        border: 'none', 
                        borderRadius: '6px', 
                        fontWeight: 'bold', 
                        cursor: 'pointer', 
                        fontSize: '0.8rem', 
                        textTransform: 'uppercase',
                        opacity: guardando ? 0.7 : 1,
                        transition: 'opacity 0.2s'
                    }}
                >
                    {guardando ? '⌛ GUARDANDO CAMBIOS...' : '💾 ACTUALIZAR AJUSTES DE SEGURIDAD'}
                </button>
            </form>
        </div>
    );
}