'use client';
import React from 'react';
import { CheckCircle, Save } from 'lucide-react';

export default function VistaEstacion({ 
    nombreEstacion, 
    setNombreEstacion, 
    categorias, 
    toggleCategoria, 
    categoriasSeleccionadas, 
    guardarEstacion, 
    guardando, 
    onClose 
}) {
    return (
        <div>
            <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontWeight: 'bold', fontSize: '0.85rem', color: '#374151', marginBottom: '8px', textTransform: 'uppercase' }}>Nombre de esta PC</label>
                <input type="text" value={nombreEstacion} onChange={(e) => setNombreEstacion(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '2px solid #f3f4f6', outline: 'none', fontSize: '1rem' }} placeholder="Ej: Caja Principal" />
            </div>
            <div>
                <label style={{ display: 'block', fontWeight: 'bold', fontSize: '0.85rem', color: '#374151', marginBottom: '12px', textTransform: 'uppercase' }}>Categorías por Cable (80mm)</label>
                <div style={{ maxHeight: '250px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '5px' }}>
                    {categorias.map(cat => (
                        <div key={cat} onClick={() => toggleCategoria(cat)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', borderRadius: '12px', cursor: 'pointer', border: categoriasSeleccionadas.includes(cat) ? '2px solid #10b981' : '2px solid #f9fafb', backgroundColor: categoriasSeleccionadas.includes(cat) ? '#ecfdf5' : '#f9fafb', transition: 'all 0.2s' }}>
                            <span style={{ fontWeight: '600', color: '#1f2937' }}>{cat}</span>
                            {categoriasSeleccionadas.includes(cat) && <CheckCircle size={20} color="#10b981" />}
                        </div>
                    ))}
                </div>
            </div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                <button onClick={onClose} style={{ flex: 1, padding: '14px', borderRadius: '12px', fontWeight: 'bold', border: 'none', backgroundColor: '#f3f4f6', color: '#4b5563', cursor: 'pointer' }}>Cancelar</button>
                <button onClick={guardarEstacion} disabled={guardando} style={{ flex: 1, padding: '14px', borderRadius: '12px', fontWeight: 'bold', border: 'none', backgroundColor: '#10b981', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}><Save size={18} />{guardando ? 'Guardando...' : 'Guardar'}</button>
            </div>
        </div>
    );
}