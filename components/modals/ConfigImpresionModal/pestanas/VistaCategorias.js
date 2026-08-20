'use client';
import React, { useState } from 'react';

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
    // 📑 Estado para alternar entre 'listado' y 'formulario'
    const [subPestana, setSubPestana] = useState(editandoCatId ? 'formulario' : 'listado');
    const [busquedaCat, setBusquedaCat] = useState('');

    // 🔍 Filtrado dinámico por nombre
    const categoriasFiltradas = listaCategoriasCompletas.filter(cat => {
        const titulo = String(cat.titulo || cat.nombre || '').toLowerCase();
        return titulo.includes(busquedaCat.toLowerCase().trim());
    });

    return (
        /* 📱 CONTENEDOR PADRE BLINDADO */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: 'calc(100vh - 140px)', overflowY: 'hidden' }}>
            
            {/* 📑 BOTONERA DE PESTAÑAS RESPONSIVAS */}
            <div style={{ display: 'flex', width: '100%', borderBottom: '2px solid #e5e7eb', backgroundColor: '#fff', borderRadius: '8px 8px 0 0', overflow: 'hidden', flexShrink: 0 }}>
                <button 
                    type="button"
                    onClick={() => setSubPestana('listado')}
                    style={{ flex: 1, padding: '12px', fontSize: '0.85rem', fontWeight: 'bold', border: 'none', backgroundColor: subPestana === 'listado' ? '#fff' : '#f3f4f6', color: subPestana === 'listado' ? '#10b981' : '#6b7280', borderBottom: subPestana === 'listado' ? '3px solid #10b981' : 'none', cursor: 'pointer', transition: 'all 0.2s' }}
                >
                    📋 CATEGORÍAS ({listaCategoriasCompletas.length})
                </button>
                <button 
                    type="button"
                    onClick={() => setSubPestana('formulario')}
                    style={{ flex: 1, padding: '12px', fontSize: '0.85rem', fontWeight: 'bold', border: 'none', backgroundColor: subPestana === 'formulario' ? '#fff' : '#f3f4f6', color: subPestana === 'formulario' ? (editandoCatId ? '#3b82f6' : '#10b981') : '#6b7280', borderBottom: subPestana === 'formulario' ? `3px solid ${editandoCatId ? '#3b82f6' : '#10b981'}` : 'none', cursor: 'pointer', transition: 'all 0.2s' }}
                >
                    {editandoCatId ? '🔄 EDITAR CATEGORÍA' : '➕ NUEVA CATEGORÍA'}
                </button>
            </div>

            {/* VISTA A: FORMULARIO DINÁMICO */}
            {subPestana === 'formulario' && (
                <div style={{ background: editandoCatId ? '#eff6ff' : '#f9fafb', padding: '16px', borderRadius: '10px', border: editandoCatId ? '2px dashed #3b82f6' : '1px solid #e5e7eb', transition: 'all 0.3s' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <h4 style={{ margin: 0, color: editandoCatId ? '#1e40af' : '#374151', fontSize: '0.85rem', fontWeight: 'bold', textTransform: 'uppercase' }}>
                            {editandoCatId ? '✏️ EDITAR CATEGORÍA SELECCIONADA' : '✨ CREAR NUEVA CATEGORÍA'}
                        </h4>
                        {editandoCatId && (
                            <button 
                                type="button" 
                                onClick={() => { 
                                    setEditandoCatId(null); 
                                    setNuevaCatTitulo(''); 
                                    setNuevaCatSeImprime(true); 
                                    setSubPestana('listado'); 
                                }} 
                                style={{ border: 'none', background: '#ef4444', color: 'white', padding: '4px 10px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold', cursor: 'pointer' }}
                            >
                                CANCELAR X
                            </button>
                        )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div>
                            <label style={{ display: 'block', fontWeight: 'bold', fontSize: '0.8rem', color: '#374151', marginBottom: '6px' }}>NOMBRE DE LA CATEGORÍA</label>
                            <input 
                                type="text" 
                                value={nuevaCatTitulo} 
                                onChange={(e) => setNuevaCatTitulo(e.target.value)} 
                                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db', outline: 'none', textTransform: 'uppercase' }} 
                                placeholder="Ej: BEBIDAS, CARNES, ABARROTES" 
                            />
                        </div>

                        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', backgroundColor: '#fff', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem', color: '#374151', border: '1px solid #e5e7eb' }}>
                            <input 
                                type="checkbox" 
                                checked={nuevaCatSeImprime} 
                                onChange={(e) => setNuevaCatSeImprime(e.target.checked)} 
                                style={{ width: '18px', height: '18px', accentColor: '#10b981' }} 
                            />
                            ¿Enviar productos de esta categoría a impresión en comanda?
                        </label>

                        <button 
                            type="button"
                            onClick={async () => {
                                await handleCrearCategoria();
                                setSubPestana('listado'); // Retorna al listado tras guardar
                            }} 
                            disabled={guardando} 
                            style={{ width: '100%', padding: '12px', borderRadius: '8px', fontWeight: 'bold', border: 'none', backgroundColor: editandoCatId ? '#2563eb' : '#10b981', color: 'white', cursor: 'pointer', fontSize: '0.85rem', textTransform: 'uppercase', marginTop: '6px' }}
                        >
                            {editandoCatId ? '💾 GUARDAR CAMBIOS' : '🚀 CREAR CATEGORÍA'}
                        </button>
                    </div>
                </div>
            )}

            {/* VISTA B: LISTADO INTERACTIVO CON BUSCADOR */}
            {subPestana === 'listado' && (
                <>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ display: 'block', fontWeight: 'bold', fontSize: '0.8rem', color: '#374151', textTransform: 'uppercase' }}>
                            Categorías Registradas
                        </label>
                        
                        {/* 🔍 BARRA DE BÚSQUEDA */}
                        <div style={{ position: 'relative' }}>
                            <input 
                                type="text" 
                                placeholder="🔍 Buscar categoría por nombre..." 
                                value={busquedaCat} 
                                onChange={(e) => setBusquedaCat(e.target.value)} 
                                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.85rem', outline: 'none', background: '#fff' }} 
                            />
                        </div>
                    </div>

                    {/* LISTA SCROLLABLE ALTURA AMPLIA */}
                    <div style={{ overflowY: 'auto', maxHeight: '280px', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }}>
                        {categoriasFiltradas.map(cat => {
                            const idCat = cat.id || cat._id;
                            const tituloCat = String(cat.titulo || cat.nombre || 'SIN NOMBRE').toUpperCase();
                            const imprime = cat.se_imprime !== false && cat.seImprime !== false;

                            return (
                                <div key={idCat} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e5e7eb', backgroundColor: '#fff' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <span style={{ fontWeight: '600', color: '#1f2937', fontSize: '0.9rem' }}>{tituloCat}</span>
                                        <span style={{ fontSize: '0.7rem', color: imprime ? '#10b981' : '#ef4444', fontWeight: 'bold', marginTop: '2px' }}>
                                            {imprime ? '🖨️ SE IMPRIME EN COMANDA' : '🚫 NO SE IMPRIME'}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', gap: '6px' }}>
                                        <button 
                                            type="button"
                                            onClick={() => {
                                                activarEdicion(cat);
                                                setSubPestana('formulario'); // Cambia a pestaña formulario para editar
                                            }} 
                                            style={{ border: 'none', background: '#f3f4f6', color: '#4b5563', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold' }}
                                        >
                                            ✏️ EDITAR
                                        </button>
                                        <button 
                                            type="button"
                                            onClick={() => handleEliminarCategoria(idCat, tituloCat)} 
                                            style={{ border: 'none', background: '#fef2f2', color: '#ef4444', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold' }}
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                        
                        {categoriasFiltradas.length === 0 && (
                            <p style={{ fontSize: '0.85rem', color: '#9ca3af', textAlign: 'center', margin: '20px 0' }}>
                                No se encontraron categorías.
                            </p>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}