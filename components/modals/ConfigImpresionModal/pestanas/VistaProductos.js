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
    // Filtrado de productos en tiempo real
    const productosFiltrados = listaProductosCompletas.filter(p => 
        p.nombre.toLowerCase().includes((busquedaProd || "").toLowerCase())
    );
return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* FORMULARIO */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', backgroundColor: editandoProductoId ? '#eff6ff' : '#f9fafb', padding: '15px', borderRadius: '12px', border: editandoProductoId ? '2px dashed #3b82f6' : '1px solid #e5e7eb' }}>
                
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
                
                <input type="text" placeholder="Nombre" value={nuevoPlato.nombre} onChange={(e) => setNuevoPlato({...nuevoPlato, nombre: e.target.value})} style={{ padding: '8px', borderRadius: '8px', border: '1px solid #ccc' }} />
                
                <div style={{ display: 'flex', gap: '10px' }}>
                    <input type="number" placeholder="Precio" value={nuevoPlato.precio} onChange={(e) => setNuevoPlato({...nuevoPlato, precio: e.target.value})} style={{ flex:1, padding: '8px', borderRadius: '8px', border: '1px solid #ccc' }} />
                    <select value={nuevoPlato.categoria} onChange={(e) => setNuevoPlato({...nuevoPlato, categoria: e.target.value})} style={{ flex:1, padding: '8px', borderRadius: '8px', border: '1px solid #ccc' }}>
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
                        style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e5e7eb', marginBottom: '4px' }} 
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
                    <div style={{ backgroundColor: '#fff', padding: '12px', borderRadius: '8px', border: '1px solid #d1d5db', marginTop: '4px' }}>
                        <select
                            value={nuevoPlato.insumoVinculado || ''}
                            onChange={(e) => setNuevoPlato({...nuevoPlato, insumoVinculado: e.target.value})}
                            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '2px solid #3b82f6' }}
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
                    style={{ padding: '10px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px' }}
                >
                    {guardando ? 'Procesando...' : 'GUARDAR PRODUCTO'}
                </button>
            </div>

            {/* BUSCADOR Y TABLA */}
            <input type="text" placeholder="🔍 Buscar producto..." value={busquedaProd} onChange={(e) => setBusquedaProd(e.target.value)} style={{ padding: '8px', borderRadius: '8px', border: '1px solid #ccc' }} />
            
            <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                <table style={{ width: '100%', fontSize: '0.85rem' }}>
                    <tbody>
                        {productosFiltrados.map(p => (
                            <tr key={p._id} onClick={() => activarEdicionProducto(p)} style={{ borderBottom: '1px solid #eee', cursor: 'pointer' }}>
                                <td style={{ padding: '8px' }}>{p.nombre}</td>
                                <td style={{ padding: '8px' }}>${p.precio}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}