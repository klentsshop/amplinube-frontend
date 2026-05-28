'use client';
import React from 'react';

export default function VistaCategorias({
    editandoCatId,
    nuevaCatTitulo,
    setNuevaCatTitulo,
    nuevaCatSeImprime,
    setNuevaCatSeImprime,
    setEditandoCatId,
    handleCrearCategoria,
    listaCategoriasCompletas,
    activarEdicion,
    handleEliminarCategoria,
    guardando
}) {
    return (
        <div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', backgroundColor: '#f9fafb', padding: '15px', borderRadius: '12px', border: '1px solid #e5e7eb', marginBottom: '15px' }}>
                <h3 style={{ margin: '0 0 5px 0', fontSize: '0.9rem', fontWeight: 'bold', color: '#111827' }}>
                    {editandoCatId ? '✏️ EDITAR CATEGORÍA' : '✨ CREAR NUEVA CATEGORÍA'}
                </h3>
                <div>
                    <label style={{ display: 'block', fontWeight: 'bold', fontSize: '0.85rem', color: '#374151', marginBottom: '6px' }}>NOMBRE DE LA CATEGORÍA</label>
                    <input 
                        type="text" 
                        value={nuevaCatTitulo} 
                        onChange={(e) => setNuevaCatTitulo(e.target.value)} 
                        style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '2px solid #e5e7eb', outline: 'none', textTransform: 'uppercase' }} 
                        placeholder="Ej: BEBIDAS, CARNES, COMBOS" 
                    />
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', backgroundColor: '#fff', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem', color: '#374151', border: '1px solid #e5e7eb' }}>
                    <input type="checkbox" checked={nuevaCatSeImprime} onChange={(e) => setNuevaCatSeImprime(e.target.checked)} style={{ width: '18px', height: '18px', accentColor: '#10b981' }} />
                    ¿Enviar platos de esta categoría a la cocina?
                </label>
                <div style={{ display: 'flex', gap: '10px', marginTop: '5px' }}>
                    {editandoCatId && (
                        <button onClick={() => { setEditandoCatId(null); setNuevaCatTitulo(''); setNuevaCatSeImprime(true); }} style={{ flex: 1, padding: '10px', borderRadius: '8px', fontWeight: 'bold', border: 'none', backgroundColor: '#e5e7eb', color: '#374151', cursor: 'pointer', fontSize: '0.8rem' }}>Cancelar</button>
                    )}
                    <button onClick={handleCrearCategoria} disabled={guardando} style={{ flex: 2, padding: '10px', borderRadius: '8px', fontWeight: 'bold', border: 'none', backgroundColor: editandoCatId ? '#fbbf24' : '#10b981', color: 'white', cursor: 'pointer', fontSize: '0.85rem' }}>
                        {editandoCatId ? '🔄 Actualizar Cambios' : '➕ Crear Categoría'}
                    </button>
                </div>
            </div>

            <label style={{ display: 'block', fontWeight: 'bold', fontSize: '0.8rem', color: '#374151', marginBottom: '8px', textTransform: 'uppercase' }}>Categorías del Negocio</label>
            <div style={{ maxHeight: '160px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', paddingRight: '4px' }}>
                {listaCategoriasCompletas.map(cat => (
                    <div key={cat._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px', borderRadius: '8px', border: '1px solid #f3f4f6', backgroundColor: '#fff' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontWeight: '600', color: '#1f2937', fontSize: '0.9rem' }}>{cat.titulo}</span>
                            <span style={{ fontSize: '0.7rem', color: cat.seImprime ? '#10b981' : '#ef4444', fontWeight: 'bold' }}>
                                {cat.seImprime ? '🖨️ SE IMPRIME' : '🚫 NO IMPRIME'}
                            </span>
                        </div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                            <button onClick={() => activarEdicion(cat)} style={{ border: 'none', background: '#f3f4f6', color: '#4b5563', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold' }}>✏️</button>
                            <button onClick={() => handleEliminarCategoria(cat._id, cat.titulo)} style={{ border: 'none', background: '#fef2f2', color: '#ef4444', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold' }}>🗑️</button>
                        </div>
                    </div>
                ))}
                {listaCategoriasCompletas.length === 0 && (
                    <p style={{ fontSize: '0.85rem', color: '#9ca3af', textAlign: 'center', margin: '10px 0' }}>No hay categorías creadas aún.</p>
                )}
            </div>
        </div>
    );
}