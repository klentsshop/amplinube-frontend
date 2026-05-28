'use client';
import React, { useState, useRef } from 'react';
import { PlusCircle } from 'lucide-react';

export default function VistaProductos({
    nuevoPlato, setNuevoPlato, categorias, handleCrearProducto, guardando, 
    setPestanaActiva, listaProductosCompletas, busquedaProd, setBusquedaProd,
    listaInventario, activarEdicionProducto, editandoProductoId, cancelarEdicionProducto, subirImagenASanity
}) {
    const [imagen, setImagen] = useState(null);
    const fileInputRef = useRef(null);
    const [estadoImagen, setEstadoImagen] = useState('');
    
    // Filtrado de productos en tiempo real con blindaje contra valores nulos
    const productosFiltrados = listaProductosCompletas.filter(p => 
        (p.nombre || "").toLowerCase().includes((busquedaProd || "").toLowerCase())
    );

    return (
        /* 📱 CONTENEDOR PADRE RESPONSIVO: Si la pantalla es muy chica, permite hacer scroll a todo el módulo */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: 'calc(100vh - 180px)', overflowY: 'auto', paddingRight: '4px' }}>
            
            {/* FORMULARIO */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', backgroundColor: editandoProductoId ? '#eff6ff' : '#f9fafb', padding: '15px', borderRadius: '12px', border: editandoProductoId ? '2px dashed #3b82f6' : '1px solid #e5e7eb', flexShrink: 0 }}>
                
                {/* CABECERA DINÁMICA CON BOTÓN DE ESCAPE INTEGRADO */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 'bold', color: editandoProductoId ? '#1e40af' : '#374151' }}>
                        {editandoProductoId ? '🔄 MODIFICAR PRODUCTO SELECCIONADO' : '✨ REGISTRAR NUEVO PRODUCTO / ARTÍCULO'}
                    </h3>
                    {editandoProductoId && (
                        <button 
                            type="button" 
                            onClick={cancelarEdicionProducto} 
                            style={{ border: 'none', background: '#ef4444', color: 'white', padding: '3px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold', cursor: 'pointer' }}
                        >
                            CREAR NUEVO X
                        </button>
                    )}
                </div>
                
                <input type="text" placeholder="Nombre" value={nuevoPlato.nombre} onChange={(e) => setNuevoPlato({...nuevoPlato, nombre: e.target.value})} style={{ padding: '8px', borderRadius: '8px', border: '1px solid #ccc', fontSize: '0.9rem' }} />
                
                <div style={{ display: 'flex', gap: '10px' }}>
                    <input type="number" placeholder="Precio" value={nuevoPlato.precio} onChange={(e) => setNuevoPlato({...nuevoPlato, precio: e.target.value})} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid #ccc', minWidth: '0', fontSize: '0.9rem' }} />
                    <select value={nuevoPlato.categoria} onChange={(e) => setNuevoPlato({...nuevoPlato, categoria: e.target.value})} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid #ccc', minWidth: '0', fontSize: '0.9rem' }}>
                        <option value="">Categoría...</option>
                        {categorias.map(c => <option key={c._id} value={c._id}>{c.titulo}</option>)}
                    </select>
                </div>
                
                <div>
                    <label style={{ display: 'block', fontWeight: 'bold', fontSize: '0.85rem', color: '#374151', marginBottom: '6px' }}>FOTO DEL PRODUCTO</label>
                    <input 
                        ref={fileInputRef}
                        type="file" 
                        accept="image/*"
                        onChange={async (e) => {
                            const file = e.target.files[0];
                            if (file) {
                                setEstadoImagen("⏳ Subiendo imagen al servidor..."); // Indicador de carga activo
                                const imagenRef = await subirImagenASanity(file);
                                if (imagenRef) {
                                    setNuevoPlato({...nuevoPlato, imagen: imagenRef});
                                    setEstadoImagen("✅ Imagen vinculada y lista."); // Éxito silencioso sin alertas masivas
                                } else {
                                    setEstadoImagen("❌ Error al procesar el archivo.");
                                    if (fileInputRef.current) fileInputRef.current.value = "";
                                }
                            }
                        }}
                        style={{ width: '100%', padding: '6px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '0.85rem' }} 
                    />
                    {/* INDICADOR VISUAL TEXTUAL DINÁMICO */}
                    {estadoImagen && (
                        <span style={{ 
                            fontSize: '0.75rem', 
                            fontWeight: 'bold', 
                            color: estadoImagen.startsWith('⏳') ? '#d97706' : estadoImagen.startsWith('✅') ? '#059669' : '#dc2626',
                            display: 'block',
                            marginTop: '2px'
                        }}>
                            {estadoImagen}
                        </span>
                    )}
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.8rem' }}>
                    <input type="checkbox" checked={nuevoPlato.controlaInventario} onChange={(e) => setNuevoPlato({...nuevoPlato, controlaInventario: e.target.checked})} />
                    ¿Controla Inventario?
                </label>

                {nuevoPlato.controlaInventario && (
                    <div style={{ backgroundColor: '#fff', padding: '12px', borderRadius: '8px', border: '1px solid #d1d5db' }}>
                        <select
                            value={nuevoPlato.insumoVinculado || ''}
                            onChange={(e) => setNuevoPlato({...nuevoPlato, insumoVinculado: e.target.value})}
                            style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '2px solid #3b82f6', fontSize: '0.9rem' }}
                        >
                            <option value="">Seleccione insumo a descontar...</option>
                            {listaInventario.map(item => (
                                <option key={item._id} value={item._id}>{item.nombre} (Stock: {item.stockActual})</option>
                            ))}
                        </select>
                    </div>
                )}

                <button 
                    onClick={async () => {
                        await handleCrearProducto();
                        // 🚀 BISTURÍ: Limpieza física del campo del archivo en el DOM tras guardar
                        if (fileInputRef.current) fileInputRef.current.value = "";
                        setEstadoImagen('');
                    }} 
                    style={{ padding: '10px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.9rem' }}
                >
                    {guardando ? 'Procesando...' : 'GUARDAR PRODUCTO'}
                </button>
            </div>

            {/* BUSCADOR Y TABLA */}
            <input 
                type="text" 
                placeholder="🔍 Buscar producto..." 
                value={busquedaProd} 
                onChange={(e) => setBusquedaProd(e.target.value)} 
                style={{ padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '0.9rem', backgroundColor: '#fff', flexShrink: 0 }} 
            />
            
            {/* 📈 TABLA INTELIGENTE: En PC mide 400px, en celular se achica dinámicamente según el espacio libre */}
            <div style={{ height: 'auto', minHeight: '150px', maxHeight: '400px', overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: '8px', backgroundColor: '#fff' }}>
                <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ backgroundColor: '#f3f4f6', position: 'sticky', top: 0, borderBottom: '2px solid #e5e7eb', zIndex: 1 }}>
                            <th style={{ padding: '10px', textAlign: 'left', color: '#4b5563', fontWeight: 'bold' }}>PRODUCTO</th>
                            <th style={{ padding: '10px', textAlign: 'right', color: '#4b5563', fontWeight: 'bold' }}>PRECIO</th>
                        </tr>
                    </thead>
                    <tbody>
                        {productosFiltrados.map(p => (
                            <tr key={p._id} onClick={() => activarEdicionProducto(p)} style={{ borderBottom: '1px solid #e5e7eb', cursor: 'pointer' }}>
                                <td style={{ padding: '10px', fontWeight: '500', color: '#111827' }}>{p.nombre}</td>
                                <td style={{ padding: '10px', textAlign: 'right', fontWeight: 'bold', color: '#059669' }}>${p.precio}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}