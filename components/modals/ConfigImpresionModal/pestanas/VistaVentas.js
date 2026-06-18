'use client';
import React, { useState, useEffect } from 'react';
import { Trash2, Search, RefreshCw } from 'lucide-react';

export default function VistaVentas({ tenantId }) {
    const [ventas, setVentas] = useState([]);
    const [busqueda, setBusqueda] = useState('');
    const [cargando, setCargando] = useState(false);

    const cargarVentas = async () => {
        if (!tenantId) return;
        setCargando(true);
        try {
            const res = await fetch(`/api/admin/ventas?tenantId=${tenantId}`);
            const data = await res.json();
            setVentas(Array.isArray(data) ? data : []);
        } catch (e) {
            console.error(e);
        } finally {
            setCargando(false);
        }
    };

    useEffect(() => {
        cargarVentas();
    }, [tenantId]);

    const handleAnularVenta = async (transaccionId, folio) => {
        if (!confirm(`⚠️ ¿ESTÁS SEGURO DE ANULAR LA VENTAS CON FOLIO [ ${folio} ]?\n\nEsta acción eliminará el registro permanente de Supabase y alterará el arqueo de caja.`)) return;
        
        try {
            const res = await fetch('/api/admin/ventas', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ transaccionId, tenantId })
            });
            const data = await res.json();
            if (data.ok) {
                alert('🗑️ Venta eliminada con éxito.');
                await cargarVentas();
            } else {
                alert(`❌ Error: ${data.error}`);
            }
        } catch (e) {
            alert('❌ Fallo de comunicación con el servidor.');
        }
    };

    const filtradas = ventas.filter(v => 
        (v.folio || "").toLowerCase().includes(busqueda.toLowerCase()) ||
        (v.mesa || "").toLowerCase().includes(busqueda.toLowerCase())
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '400px' }}>
            <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <Search size={16} style={{ position: 'absolute', left: '10px', color: '#9ca3af' }} />
                    <input 
                        type="text" 
                        placeholder="Buscar por Folio o Mesa..." 
                        value={busqueda}
                        onChange={(e) => setBusqueda(e.target.value)}
                        style={{ width: '100%', padding: '8px 8px 8px 32px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.85rem' }}
                    />
                </div>
                <button onClick={cargarVentas} style={{ padding: '8px 12px', background: '#e5e7eb', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
                    <RefreshCw size={16} className={cargando ? 'animate-spin' : ''} />
                </button>
            </div>

           <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', overflowY: 'auto', maxHeight: '280px' }}>
    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
                    <thead style={{ background: '#f3f4f6', fontWeight: 'bold' }}>
                        <tr>
                            <th style={{ padding: '10px' }}>Folio</th>
                            <th style={{ padding: '10px' }}>Mesa</th>
                            <th style={{ padding: '10px' }}>Mesero</th>
                            <th style={{ padding: '10px' }}>Total</th>
                            <th style={{ padding: '10px', textAlign: 'center' }}>Acción</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtradas.length === 0 ? (
                            <tr><td colSpan="5" style={{ padding: '20px', textAlign: 'center', color: '#6b7280' }}>No se encontraron ventas recientes.</td></tr>
                        ) : (
                            filtradas.map((v) => (
                                <tr key={v.transaccion_id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                                    <td style={{ padding: '10px', fontWeight: '600' }}>{v.folio}</td>
                                    <td style={{ padding: '10px' }}>{v.mesa}</td>
                                    <td style={{ padding: '10px' }}>{v.mesero}</td>
                                    <td style={{ padding: '10px', color: '#10b981', fontWeight: 'bold' }}>${Number(v.total_pagado).toLocaleString()}</td>
                                    <td style={{ padding: '10px', textAlign: 'center' }}>
                                        <button 
                                            onClick={() => handleAnularVenta(v.transaccion_id, v.folio)}
                                            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}