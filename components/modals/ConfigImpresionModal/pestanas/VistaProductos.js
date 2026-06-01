'use client';
import React, { useState, useRef } from 'react';
import { PlusCircle } from 'lucide-react';

export default function VistaProductos({
    nuevoPlato, setNuevoPlato, categorias, handleCrearProducto, guardando, 
    setPestanaActiva, listaProductosCompletas, busquedaProd, setBusquedaProd,
    listaInventario, activarEdicionProducto, editandoProductoId, cancelarEdicionProducto, subirImagenASanity,
    handleBorrarProducto
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
                
                {/* 📐 FILA 1: DATOS BÁSICOS (Misma estructura de grilla que Inventario) */}
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '8px', marginBottom: '2px' }}>
                    <div>
                        <label style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#6b7280', display: 'block', marginBottom: '4px' }}>Nombre del Producto</label>
                        <input type="text" placeholder="Nombre" value={nuevoPlato.nombre} onChange={(e) => setNuevoPlato({...nuevoPlato, nombre: e.target.value})} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ccc', fontSize: '0.9rem', outline: 'none', textTransform: 'uppercase' }} />
                    </div>
                    <div>
                        <label style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#6b7280', display: 'block', marginBottom: '4px' }}>Precio ($)</label>
                        <input type="number" placeholder="Precio" value={nuevoPlato.precio} onChange={(e) => setNuevoPlato({...nuevoPlato, precio: e.target.value})} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ccc', fontSize: '0.9rem', outline: 'none', textAlign: 'center' }} />
                    </div>
                    <div>
                        <label style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#6b7280', display: 'block', marginBottom: '4px' }}>Categoría</label>
                        <select value={nuevoPlato.categoria} onChange={(e) => setNuevoPlato({...nuevoPlato, categoria: e.target.value})} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ccc', fontSize: '0.9rem', outline: 'none' }}>
                            <option value="">Categoría...</option>
                            {categorias.map(c => <option key={c._id} value={c._id}>{c.titulo}</option>)}
                        </select>
                    </div>
                </div>
                
                {/* 📐 FILA 2: INTEGRACIÓN CÓDIGOS DE HARDWARE Y MULTIMEDIA */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 1fr', gap: '8px', alignItems: 'end', marginBottom: '2px' }}>
                    <div>
                        <label style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#6b7280', display: 'block', marginBottom: '4px' }}>Código Barras (Pistola)</label>
                        <input type="text" placeholder="Opcional" value={nuevoPlato.barcode || ''} onChange={(e) => setNuevoPlato({...nuevoPlato, barcode: e.target.value})} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ccc', fontSize: '0.9rem', outline: 'none' }} />
                    </div>
                    <div>
                        <label style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#6b7280', display: 'block', marginBottom: '4px' }}>Balanza (PLU)</label>
                        <input type="text" maxLength={5} placeholder="Ej: 00123" value={nuevoPlato.codigoBalanza || ''} onChange={(e) => setNuevoPlato({...nuevoPlato, codigoBalanza: e.target.value})} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ccc', fontSize: '0.9rem', outline: 'none' }} />
                    </div>
                    <div>
                        <label style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#6b7280', display: 'block', marginBottom: '4px' }}>Foto Producto</label>
                        <input 
                            ref={fileInputRef}
                            type="file" 
                            accept="image/*"
                            onChange={async (e) => {
                                const file = e.target.files[0];
                                if (file) {
                                    setEstadoImagen("⏳ Subiendo..."); 
                                    const imagenRef = await subirImagenASanity(file);
                                    if (imagenRef) {
                                        setNuevoPlato({...nuevoPlato, imagen: imagenRef});
                                        setEstadoImagen("✅ Lista."); 
                                    } else {
                                        setEstadoImagen("❌ Error.");
                                        if (fileInputRef.current) fileInputRef.current.value = "";
                                    }
                                }
                            }}
                            style={{ width: '100%', padding: '6px', borderRadius: '6px', border: '1px solid #e5e7eb', fontSize: '0.8rem', backgroundColor: 'white' }} 
                        />
                    </div>
                </div>

                {/* INDICADOR VISUAL TEXTUAL DINÁMICO */}
                {estadoImagen && (
                    <span style={{ 
                        fontSize: '0.7rem', 
                        fontWeight: 'bold', 
                        color: estadoImagen.startsWith('⏳') ? '#d97706' : estadoImagen.startsWith('✅') ? '#059669' : '#dc2626',
                        display: 'block',
                        marginTop: '-4px'
                    }}>
                        {estadoImagen}
                    </span>
                )}

                {/* 📐 FILA 3: CONFIGURACIONES ADICIONALES (Checkboxes en línea) */}
                <div style={{ display: 'flex', gap: '20px', alignItems: 'center', padding: '4px 0' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', fontWeight: 'bold', color: '#374151', cursor: 'pointer' }}>
                        <input type="checkbox" checked={nuevoPlato.controlaInventario} onChange={(e) => setNuevoPlato({...nuevoPlato, controlaInventario: e.target.checked})} style={{ cursor: 'pointer' }} />
                        ¿Controla Inventario?
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', fontWeight: 'bold', color: '#374151', cursor: 'pointer' }}>
                        <input type="checkbox" checked={nuevoPlato.disponible !== false} onChange={(e) => setNuevoPlato({...nuevoPlato, disponible: e.target.checked})} style={{ cursor: 'pointer' }} />
                        ¿Producto Disponible en POS?
                    </label>
                </div>

                {/* DESPLEGABLE DE INSUMO VINCULADO */}
                {nuevoPlato.controlaInventario && (
                    <div style={{ backgroundColor: '#fff', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }}>
                        <select
                            value={nuevoPlato.insumoVinculado || ''}
                            onChange={(e) => setNuevoPlato({...nuevoPlato, insumoVinculado: e.target.value})}
                            style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '2px solid #3b82f6', fontSize: '0.9rem', outline: 'none' }}
                        >
                            <option value="">Seleccione insumo a descontar...</option>
                            {listaInventario.map(item => (
                                <option key={item._id} value={item._id}>{item.nombre} (Stock: {item.stockActual})</option>
                            ))}
                        </select>
                    </div>
                )}

                {/* ACCIÓN DE GUARDADO */}
                <button 
                    onClick={async () => {
                        await handleCrearProducto();
                        if (fileInputRef.current) fileInputRef.current.value = "";
                        setEstadoImagen('');
                    }} 
                    style={{ padding: '9px', backgroundColor: editandoProductoId ? '#2563eb' : '#10b981', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.8rem', textTransform: 'uppercase', marginTop: '4px' }}
                >
                    {guardando ? 'PROCESANDO...' : editandoProductoId ? '💾 GUARDAR PRODUCTO' : '🚀 REGISTRAR PRODUCTO'}
                </button>
            </div>

            {/* BUSCADOR Y TABLA */}
            <input 
                type="text" 
                placeholder="🔍 Buscar producto por nombre..." 
                value={busquedaProd} 
                onChange={(e) => setBusquedaProd(e.target.value)} 
                style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.85rem', backgroundColor: '#fff', flexShrink: 0, outline: 'none' }} 
            />
            
            {/* 📈 TABLA INTELIGENTE */}
            <div style={{ height: 'auto', minHeight: '150px', maxHeight: '400px', overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: '8px', backgroundColor: '#fff' }}>
                <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ backgroundColor: '#f3f4f6', position: 'sticky', top: 0, borderBottom: '2px solid #e5e7eb', zIndex: 1 }}>
                            <th style={{ padding: '10px', textAlign: 'left', color: '#4b5563', fontWeight: 'bold' }}>PRODUCTO</th>
                            <th style={{ padding: '10px', textAlign: 'right', color: '#4b5563', fontWeight: 'bold' }}>PRECIO</th>
                            <th style={{ padding: '10px', width: '50px', textAlign: 'center' }}></th>
                        </tr>
                    </thead>
                    <tbody>
    {productosFiltrados.map(p => (
        <tr key={p._id} onClick={() => activarEdicionProducto(p)} style={{ borderBottom: '1px solid #e5e7eb', cursor: 'pointer' }}>
            <td style={{ padding: '10px', fontWeight: '500', color: '#111827', textTransform: 'uppercase' }}>{p.nombre}</td>
            <td style={{ padding: '10px', textAlign: 'right', fontWeight: 'bold', color: '#059669' }}>${p.precio}</td>
            {/* 🗑️ BOTÓN DE DESTRUCCIÓN DIRECTA */}
            <td style={{ padding: '10px', textAlign: 'center' }}>
                <button 
                    onClick={(e) => { 
                        e.stopPropagation(); // 🛡️ Evita que se abra el formulario de edición al borrar
                        if (confirm(`¿Seguro que deseas eliminar el producto "${p.nombre}"?`)) {
                            handleBorrarProducto(p._id); 
                        }
                    }} 
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '1rem' }}
                >
                    🗑️
                </button>
            </td>
        </tr>
    ))}
</tbody>
                </table>
            </div>
        </div>
    );
}