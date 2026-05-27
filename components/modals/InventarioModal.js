'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useInventario } from '@/hooks/useInventario';

export default function InventarioModal({ isOpen, onClose, tenantId }) {
    const { insumos, cargarStock, cargando } = useInventario(tenantId);
    const [busqueda, setBusqueda] = useState('');
    const [cantidades, setCantidades] = useState({});
    const [confirmacion, setConfirmacion] = useState({});
    
    const inputBusquedaRef = useRef(null);

    // Mantener foco para la pistola
    useEffect(() => {
        if (isOpen && inputBusquedaRef.current) {
            inputBusquedaRef.current.focus();
        }
    }, [isOpen]);

    // LÓGICA DE ESCANEO AUTOMÁTICO (IDENTIFICACIÓN POR CÓDIGO)
    useEffect(() => {
        const insumoEscaner = insumos?.find(i => 
            (i.barcode && i.barcode === busqueda) || 
            (i.codigoBalanza && i.codigoBalanza === busqueda)
        );

        if (insumoEscaner) {
            handleCargar(insumoEscaner._id, 1);
            setBusqueda('');
        }
    }, [busqueda, insumos]);

    if (!isOpen) return null;

    const insumosProcesados = insumos?.filter(i => 
        (i.nombre || "").toLowerCase().includes(busqueda.toLowerCase()) ||
        (i.barcode || "") === busqueda
    ).sort((a, b) => {
        const criticoA = a.stockActual <= (a.stockMinimo || 5) ? 1 : 0;
        const criticoB = b.stockActual <= (b.stockMinimo || 5) ? 1 : 0;
        return criticoB - criticoA; 
    }) || [];

    const handleCargar = async (id, cantidadManual = null) => {
        const cantidad = cantidadManual || cantidades[id];
        if (!cantidad || cantidad <= 0) return;
        
        const ok = await cargarStock(id, parseFloat(cantidad), tenantId);
        if (ok) {
            setConfirmacion(prev => ({ ...prev, [id]: true }));
            window.dispatchEvent(new Event('inventarioActualizado'));
            
            setCantidades(prev => {
                const newCantidades = { ...prev };
                delete newCantidades[id];
                return newCantidades;
            });

            setTimeout(() => {
                setConfirmacion(prev => ({ ...prev, [id]: false }));
            }, 2000);
        }
    };

    return (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '15px', zIndex: 10000 }}>
            <div style={{ background: 'white', padding: '25px', borderRadius: '15px', width: '100%', maxWidth: '650px', maxHeight: '90vh', overflowY: 'auto', position: 'relative', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)' }}>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        📊 CONTROL DE STOCK (PISTOLA OK)
                    </h2>
                    <button onClick={onClose} style={{ fontSize: '1.8rem', border: 'none', background: 'none', cursor: 'pointer', color: '#999' }}>✕</button>
                </div>

                <div style={{ backgroundColor: '#F9FAFB', padding: '15px', borderRadius: '12px', marginBottom: '20px', border: '1px solid #E5E7EB' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#4B5563', textTransform: 'uppercase', marginBottom: '5px', display: 'block' }}>
                        🔍 Escanee o busque el Insumo:
                    </label>
                    <input 
    ref={inputBusquedaRef}
    type="text" 
    placeholder="Pistolee el código aquí..." 
    value={busqueda}
    onChange={(e) => setBusqueda(e.target.value)}
    // 🚀 BLINDAJE PARA ENTER Y PEGADO
    onKeyDown={(e) => {
        if (e.key === 'Enter') {
            e.preventDefault(); // Evita ruidos en el DOM
            // Forzamos la búsqueda manual por si el useEffect no ha disparado
            const insumo = insumos.find(i => i.barcode === busqueda || i.codigoBalanza === busqueda);
            if (insumo) {
                handleCargar(insumo._id, 1);
                setBusqueda('');
            }
        }
    }}
    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #D1D5DB', outline: 'none', fontSize: '1rem' }}
/>
                </div>

                <div style={{ maxHeight: '50vh', overflowY: 'auto', borderRadius: '8px', border: '1px solid #F3F4F6' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead style={{ position: 'sticky', top: 0, backgroundColor: '#F1F5F9', zIndex: 10 }}>
                            <tr>
                                <th style={{ padding: '12px', textAlign: 'left', fontSize: '0.7rem', color: '#64748B', textTransform: 'uppercase' }}>Insumo</th>
                                <th style={{ padding: '12px', textAlign: 'center', fontSize: '0.7rem', color: '#64748B', textTransform: 'uppercase' }}>Stock Real</th>
                                <th style={{ padding: '12px', textAlign: 'center', fontSize: '0.7rem', color: '#64748B', textTransform: 'uppercase' }}>Cargar</th>
                            </tr>
                        </thead>
                        <tbody>
                            {insumosProcesados.map((insumo) => {
                                const esCritico = insumo.stockActual <= (insumo.stockMinimo || 5);
                                const guardadoOk = confirmacion[insumo._id];
                                return (
                                    <tr key={insumo._id} style={{ 
                                        borderBottom: '1px solid #F3F4F6',
                                        backgroundColor: guardadoOk ? '#ECFDF5' : (esCritico ? '#FFF7F7' : 'transparent'),
                                        transition: 'background-color 0.3s ease'
                                    }}>
                                        <td style={{ padding: '12px' }}>
                                            <div style={{ fontWeight: '800', fontSize: '0.95rem', color: '#1F2937' }}>{insumo.nombre?.toUpperCase()}</div>
                                            <span style={{ fontSize: '0.65rem', color: '#94A3B8', fontWeight: 'bold' }}>
                                                UNIDAD: {['CARNE', 'LOMO', 'POLLO', 'CERDO', 'PESCADO', 'PULPA'].some(p => insumo.nombre?.toUpperCase().includes(p)) ? 'KILOGRAMOS' : (insumo.unidadMedida?.toUpperCase() || 'UNIDADES')}
                                            </span>
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                            <div style={{ fontSize: '1.2rem', fontWeight: '900', color: esCritico ? '#EF4444' : '#10B981' }}>{insumo.stockActual}</div>
                                        </td>
                                        <td style={{ padding: '12px' }}>
                                            <div style={{ display: 'flex', gap: '5px', justifyContent: 'center' }}>
                                                <input 
                                                    type="number" 
                                                    placeholder="0"
                                                    value={cantidades[insumo._id] || ''}
                                                    onChange={(e) => setCantidades({...cantidades, [insumo._id]: e.target.value})}
                                                    style={{ width: '60px', padding: '8px', borderRadius: '6px', border: '1px solid #D1D5DB', textAlign: 'center', fontWeight: 'bold' }}
                                                />
                                                <button 
                                                    onClick={() => handleCargar(insumo._id)}
                                                    disabled={cargando}
                                                    style={{ background: guardadoOk ? '#059669' : '#10B981', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '6px', fontWeight: '900', cursor: 'pointer', transition: 'all 0.3s ease' }}
                                                >
                                                    {guardadoOk ? '✅' : '+ OK'}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}