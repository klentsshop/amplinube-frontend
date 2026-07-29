'use client';
import React, { useState, useEffect } from 'react';
import { CheckCircle, Save, Printer } from 'lucide-react';

export default function VistaEstacion({ 
    categorias = [], 
    toggleCategoria, 
    categoriasSeleccionadas = [], 
    impresoraNombreInicial = '', // 👈 Recibe el valor actual cargado de la BD
    guardarEstacion, 
    guardando, 
    onClose 
}) {
    const [impresoraNombre, setImpresoraNombre] = useState(impresoraNombreInicial);
    useEffect(() => {
        if (impresoraNombreInicial) {
            setImpresoraNombre(impresoraNombreInicial);
        }
    }, [impresoraNombreInicial]);
    const handleSafeGuardar = (e) => {
        if (e) e.preventDefault();
        
        const dataEnviar = {
            categorias: categoriasSeleccionadas.length > 0 ? categoriasSeleccionadas : [],
            impresoraNombre: impresoraNombre.trim() // 👈 Enviamos la impresora
        };
        
        guardarEstacion(dataEnviar);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            {/* SECCIÓN 1: NOMBRE DE IMPRESORA WINDOWS */}
            <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold', fontSize: '0.8rem', color: '#374151', marginBottom: '6px', textTransform: 'uppercase' }}>
                    <Printer size={16} color="#10b981" />
                    Nombre de la Impresora en Windows
                </label>
                <input 
                    type="text"
                    value={impresoraNombre}
                    onChange={(e) => setImpresoraNombre(e.target.value)}
                    placeholder="Ej: POS-58, POS-80, Epson TM-T20..."
                    style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1px solid #d1d5db',
                        fontSize: '0.85rem',
                        fontWeight: '600',
                        color: '#1f2937',
                        outline: 'none',
                        boxSizing: 'border-box'
                    }}
                />
                <span style={{ fontSize: '0.7rem', color: '#6b7280', marginTop: '4px', display: 'block' }}>
                    Debe coincidir exactamente con el nombre de la impresora instalada en el Panel de Control.
                </span>
            </div>

            {/* SECCIÓN 2: CATEGORÍAS */}
            <div>
                <label style={{ display: 'block', fontWeight: 'bold', fontSize: '0.8rem', color: '#374151', marginBottom: '8px', textTransform: 'uppercase' }}>
                    Categorías a Imprimir en esta Estación
                </label>
                
                <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', paddingRight: '4px' }}>
                    {categorias && categorias.length > 0 ? (
                        categorias.map(cat => {
                            const estaSeleccionada = categoriasSeleccionadas.includes(cat);
                            return (
                                <div 
                                    key={cat} 
                                    onClick={() => toggleCategoria(cat)} 
                                    style={{ 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        justifyContent: 'space-between', 
                                        padding: '10px 14px', 
                                        borderRadius: '10px', 
                                        cursor: 'pointer', 
                                        border: estaSeleccionada ? '2px solid #10b981' : '2px solid #f3f4f6', 
                                        backgroundColor: estaSeleccionada ? '#ecfdf5' : '#f9fafb', 
                                        transition: 'all 0.15s ease' 
                                    }}
                                >
                                    <span style={{ fontWeight: '700', color: '#1f2937', fontSize: '0.85rem' }}>
                                        {cat?.toUpperCase()}
                                    </span>
                                    {estaSeleccionada && <CheckCircle size={18} color="#10b981" />}
                                </div>
                            );
                        })
                    ) : (
                        <div style={{ padding: '15px', color: '#9ca3af', textAlign: 'center', fontSize: '0.85rem' }}>
                            No hay categorías configuradas en el sistema.
                        </div>
                    )}
                </div>
            </div>

            {/* BOTONERA DE ACCIONES */}
            <div style={{ display: 'flex', gap: '10px', marginTop: '6px', borderTop: '1px solid #f3f4f6', paddingTop: '12px' }}>
                <button 
                    type="button"
                    onClick={onClose} 
                    style={{ flex: 1, padding: '12px', borderRadius: '10px', fontWeight: 'bold', border: 'none', backgroundColor: '#f3f4f6', color: '#4b5563', cursor: 'pointer', fontSize: '0.85rem' }}
                >
                    Cancelar
                </button>
                <button 
                    type="button"
                    onClick={handleSafeGuardar} 
                    disabled={guardando} 
                    style={{ flex: 1, padding: '12px', borderRadius: '10px', fontWeight: 'bold', border: 'none', backgroundColor: '#10b981', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '0.85rem' }}
                >
                    <Save size={16} />
                    {guardando ? 'Guardando...' : 'Guardar Configuración'}
                </button>
            </div>

        </div>
    );
}