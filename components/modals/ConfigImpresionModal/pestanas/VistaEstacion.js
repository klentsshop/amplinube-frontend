'use client';
import React from 'react';
import { CheckCircle, Save } from 'lucide-react';

export default function VistaEstacion({ 
    nombreEstacion, 
    setNombreEstacion, 
    categorias, 
    toggleCategoria, 
    categoriasSeleccionadas = [], // 🛡️ Evitamos fallos si viene undefined
    guardarEstacion, 
    guardando, 
    onClose 
}) {

    // 🧠 MANEJO DE ENVÍO SEGURO CONTRA ARREGLOS VACÍOS MULTI-TENANT
    const handleSafeGuardar = (e) => {
        if (e) e.preventDefault();
        
        // Si el usuario desmarcó todo, nos aseguramos de que viaje el array vacío
        // de forma atómica para obligar al backend a limpiar el registro en la nube
        const dataEnviar = {
            nombre: nombreEstacion?.trim() || 'Caja Principal',
            categorias: categoriasSeleccionadas.length > 0 ? categoriasSeleccionadas : []
        };
        
        // Ejecutamos tu función nativa de guardado
        guardarEstacion(dataEnviar);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            
            {/* NOMBRE DE LA PC */}
            <div>
                <label style={{ display: 'block', fontWeight: 'bold', fontSize: '0.8rem', color: '#374151', marginBottom: '6px', textTransform: 'uppercase' }}>
                    Nombre de esta PC
                </label>
                <input 
                    type="text" 
                    value={nombreEstacion} 
                    onChange={(e) => setNombreEstacion(e.target.value)} 
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '2px solid #e5e7eb', outline: 'none', fontSize: '0.95rem', transition: 'border-color 0.2s' }} 
                    placeholder="Ej: Caja Principal"
                    onFocus={(e) => e.target.style.borderColor = '#10b981'}
                    onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                />
            </div>

            {/* SECCIÓN CATEGORÍAS */}
            <div>
                <label style={{ display: 'block', fontWeight: 'bold', fontSize: '0.8rem', color: '#374151', marginBottom: '8px', textTransform: 'uppercase' }}>
                    Categorías por Cable (80mm)
                </label>
                
                {/* 🎯 LUPA SÉNIOR: Reducimos la altura máxima y controlamos el scroll para evitar el desborde inferior */}
                <div style={{ maxHeight: '160px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', paddingRight: '4px' }}>
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
                                        justify: 'space-between', 
                                        padding: '10px 14px', 
                                        borderRadius: '10px', 
                                        cursor: 'pointer', 
                                        border: estaSeleccionada ? '2px solid #10b981' : '2px solid #f3f4f6', 
                                        backgroundColor: estaSeleccionada ? '#ecfdf5' : '#f9fafb', 
                                        transition: 'all 0.15s ease' 
                                    }}
                                    onMouseEnter={(e) => !estaSeleccionada && (e.currentTarget.style.backgroundColor = '#f3f4f6')}
                                    onMouseLeave={(e) => !estaSeleccionada && (e.currentTarget.style.backgroundColor = '#f9fafb')}
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

            {/* BOTONERA ACCIONES DE FIJACIÓN */}
            <div style={{ display: 'flex', gap: '10px', marginTop: '10px', borderTop: '1px solid #f3f4f6', paddingTop: '12px' }}>
                <button 
                    onClick={onClose} 
                    style={{ flex: 1, padding: '12px', borderRadius: '10px', fontWeight: 'bold', border: 'none', backgroundColor: '#f3f4f6', color: '#4b5563', cursor: 'pointer', fontSize: '0.85rem' }}
                >
                    Cancelar
                </button>
                <button 
                    onClick={handleSafeGuardar} 
                    disabled={guardando} 
                    style={{ flex: 1, padding: '12px', borderRadius: '10px', fontWeight: 'bold', border: 'none', backgroundColor: '#10b981', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '0.85rem', transition: 'opacity 0.2s' }}
                >
                    <Save size={16} />
                    {guardando ? 'Guardando...' : 'Guardar'}
                </button>
            </div>

        </div>
    );
}