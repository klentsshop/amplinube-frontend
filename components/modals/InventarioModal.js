'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useInventario } from '@/hooks/useInventario';
import { sanityClientServer } from '@/lib/sanity'; // 🛡️ Importamos para el Plan B de rescate del escáner

export default function InventarioModal({ isOpen, onClose, tenantId }) {
    
    const [busqueda, setBusqueda] = useState('');
    const [cantidades, setCantidades] = useState({});
    const [confirmacion, setConfirmacion] = useState({});
    const { insumos, cargarStock, cargando } = useInventario(tenantId, busqueda);
    const [procesandoId, setProcesandoId] = useState(null);
    
    const inputBusquedaRef = useRef(null);

    // Mantener foco automático para capturar ráfagas de la pistola láser
    useEffect(() => {
        if (isOpen && inputBusquedaRef.current) {
            inputBusquedaRef.current.focus();
        }
    }, [isOpen]);

    // 🔫 LÓGICA DE ESCANEO COMPUESTA (Supabase + Rescate Sanity)
    useEffect(() => {
        if (!busqueda) return;

        const procesarEscaneoGuns = async () => {
            // Paso A: Buscamos en la memoria rápida local (Supabase)
            const insumoEscaner = insumos?.find(i => 
                (i.barcode && i.barcode === busqueda) || 
                (i.codigoBalanza && i.codigoBalanza === busqueda)
            );

            if (insumoEscaner) {
                const idReal = insumoEscaner.id || insumoEscaner._id;
                handleCargar(idReal, 1);
                setBusqueda('');
                return;
            }

            // 🔥 PLAN B DE RESCATE (Nivel Senior): Si el producto es nuevo en Supabase,
            // lo buscamos en el catálogo de Sanity para recuperar su ID y crearlo al vuelo.
            if (busqueda.length >= 4) { // Evita consultas en falso mientras escriben
                try {
                    const rescateSanity = await sanityClientServer.fetch(
                        `*[_type == "inventario" && tenant == $tenantId && (barcode == $busqueda || codigoBalanza == $busqueda)][0]{ _id }`,
                        { tenantId, busqueda }
                    );

                    if (rescateSanity?._id) {
                        handleCargar(rescateSanity._id, 1);
                        setBusqueda('');
                    }
                } catch (err) {
                    console.error("⚠️ Error en ráfaga de rescate de código:", err);
                }
            }
        };

        procesarEscaneoGuns();
    }, [busqueda, insumos, tenantId]);

    if (!isOpen) return null;

    // Filtro y ordenamiento de la tabla visual
    const insumosProcesados = insumos?.filter(i => 
        (i.nombre || "").toLowerCase().includes(busqueda.toLowerCase()) ||
        (i.barcode || "") === busqueda
    ).sort((a, b) => {
        const criticoA = a.stockActual <= (a.stockMinimo || 5) ? 1 : 0;
        const criticoB = b.stockActual <= (b.stockMinimo || 5) ? 1 : 0;
        return criticoB - criticoA; 
    }) || [];

    const handleCargar = async (id, cantidadManual = null) => {
        if (procesandoId === id) return;
        const cantidad = cantidadManual || cantidades[id];
        if (!cantidad || cantidad <= 0) return;
        try {
        // Encendemos el escudo para este insumo específico
        setProcesandoId(id);
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
    } catch (error) {
        console.error("Error al cargar el stock del insumo:", error);
    } finally {
        // 🚀 CONTROL DE SALIDA: Liberamos el botón únicamente cuando la API de Supabase/Sanity respondió
        setProcesandoId(null);
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
                        // 🚀 BLINDAJE EXTRA PARA GATILLO ENTER MANUAL
                        onKeyDown={async (e) => {
    // 🛡️ EL ESCUDO DE ACERO: Detiene cualquier evento de tecla para que no viaje al carrito de atrás
    e.stopPropagation(); 

    if (e.key === 'Enter') {
        e.preventDefault(); // Evita que se recargue la página o envíe formularios fantasmas
        
        // 🚨 Tu lógica actual intacta de búsqueda:
        let insumo = insumos.find(i => i.barcode === busqueda || i.codigoBalanza === busqueda);
        
        if (insumo) {
            handleCargar(insumo.id || insumo._id, 1);
            setBusqueda('');
        } else {
            // Tu plan B de rescate en Sanity
            const rescate = await sanityClientServer.fetch(
                `*[_type == "inventario" && tenant == $tenantId && (barcode == $busqueda || codigoBalanza == $busqueda)][0]{ _id }`,
                { tenantId, busqueda }
            );
            if (rescate?._id) {
                handleCargar(rescate._id, 1);
                setBusqueda('');
            }
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
                                const insumoId = insumo.id || insumo._id;
                                const esCritico = insumo.stockActual <= (insumo.stockMinimo || 5);
                                const guardadoOk = confirmacion[insumoId];

                                return (
                                    <tr key={insumoId} style={{ 
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
                                                    step="0.001" // 🥩 PERMITE ENTRADA DE GRAMOS Y DECIMALES EXACTOS
                                                    value={cantidades[insumoId] || ''}
                                                    onChange={(e) => setCantidades({...cantidades, [insumoId]: e.target.value})}
                                                    style={{ width: '70px', padding: '8px', borderRadius: '6px', border: '1px solid #D1D5DB', textAlign: 'center', fontWeight: 'bold' }}
                                                />
                                                <button 
    onClick={() => handleCargar(insumoId)}
    // Bloquea el botón si el hook está cargando de forma global, si está confirmado, o si este ID específico está en transmisión
    disabled={cargando || guardadoOk || procesandoId === insumoId}
    style={{ 
        background: guardadoOk ? '#059669' : (procesandoId === insumoId ? '#9CA3AF' : '#10B981'), 
        color: 'white', 
        border: 'none', 
        padding: '8px 15px', 
        borderRadius: '6px', 
        fontWeight: '900', 
        // Cambia el cursor a prohibido si está deshabilitado para que el usuario entienda visualmente que debe esperar
        cursor: (cargando || guardadoOk || procesandoId === insumoId) ? 'not-allowed' : 'pointer', 
        transition: 'all 0.3s ease',
        opacity: (procesandoId === insumoId) ? 0.7 : 1
    }}
>
    {guardadoOk ? '✅' : (procesandoId === insumoId ? '⏳ ...' : '+ OK')}
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