'use client';
import React, { useState, useRef } from 'react';
import { PlusCircle } from 'lucide-react';

export default function VistaProductos({
    nuevoPlato, setNuevoPlato, categorias, handleCrearProducto, guardando, 
    setPestanaActiva, listaProductosCompletas, busquedaProd, setBusquedaProd,
    listaInventario, activarEdicionProducto, editandoProductoId, cancelarEdicionProducto, subirImagenASupabase: subirImagen,
    handleBorrarProducto, tenantId
}) {
    
    const [imagen, setImagen] = useState(null);
    React.useEffect(() => {
        if (nuevoPlato?.imagen) {
            setEstadoImagen("🖼️ Imagen guardada");
        } else {
            setEstadoImagen("");
        }
    }, [nuevoPlato?.imagen, editandoProductoId]);
    const fileInputRef = useRef(null);
    const [estadoImagen, setEstadoImagen] = useState('');
    const timerBusquedaRef = useRef(null);
    const [subPestana, setSubPestana] = useState(editandoProductoId ? 'formulario' : 'listado');
    
    // 🧠 ESTADOS PARA BÚSQUEDA AUTÓNOMA EN TODA LA BASE DE DATOS
    const [productosVisuales, setProductosVisuales] = useState(listaProductosCompletas);
    const timerBusquedaTablaRef = useRef(null);

   React.useEffect(() => {
        if (busquedaProd && busquedaProd.trim() !== '') {
            const termino = busquedaProd.toLowerCase().trim();
            const filtrados = listaProductosCompletas.filter(p => 
                (p.nombre || '').toLowerCase().includes(termino) ||
                (p.barcode || '').toLowerCase().includes(termino)
            );
            setProductosVisuales(filtrados);
        } else {
            // Protección Híbrida: Mantiene la referencia original del padre
            setProductosVisuales(listaProductosCompletas || []);
        }
    }, [listaProductosCompletas, busquedaProd]);
    return (
    /* 📱 CONTENEDOR PADRE BLINDADO: Bloquea el scroll general para mantener las pestañas fijas arriba */
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: 'calc(100vh - 140px)', overflowY: 'hidden' }}>
        
        {/* 📑 BOTONERA DE PESTAÑAS RESPONSIVAS */}
        <div style={{ display: 'flex', width: '100%', borderBottom: '2px solid #e5e7eb', backgroundColor: '#fff', borderRadius: '8px 8px 0 0', overflow: 'hidden', flexShrink: 0 }}>
            <button 
                type="button"
                onClick={() => setSubPestana('listado')}
                style={{ flex: 1, padding: '12px', fontSize: '0.85rem', fontWeight: 'bold', border: 'none', backgroundColor: subPestana === 'listado' ? '#fff' : '#f3f4f6', color: subPestana === 'listado' ? '#10b981' : '#6b7280', borderBottom: subPestana === 'listado' ? '3px solid #10b981' : 'none', cursor: 'pointer', transition: 'all 0.2s' }}
            >
                📋 LISTADO DE PRODUCTOS ({productosVisuales.length})
            </button>
           <button 
                type="button"
                onClick={() => {
                    // 🎯 COPIA FIEL DE INVENTARIO: Si está editando y da clic aquí, limpia el modo edición
                    if (editandoProductoId) {
                        cancelarEdicionProducto();
                        if (fileInputRef.current) fileInputRef.current.value = "";
                        const inputReceta = document.getElementById('buscador-insumo-receta');
                        if (inputReceta) inputReceta.value = "";
                        setEstadoImagen('');
                    }
                    setSubPestana('formulario');
                }}
                style={{ flex: 1, padding: '12px', fontSize: '0.85rem', fontWeight: 'bold', border: 'none', backgroundColor: subPestana === 'formulario' ? '#fff' : '#f3f4f6', color: subPestana === 'formulario' ? (editandoProductoId ? '#3b82f6' : '#10b981') : '#6b7280', borderBottom: subPestana === 'formulario' ? `3px solid ${editandoProductoId ? '#3b82f6' : '#10b981'}` : 'none', cursor: 'pointer', transition: 'all 0.2s' }}
            >
                {editandoProductoId ? '🔄 MODIFICAR SELECCIONADO' : '✨ REGISTRAR NUEVO'}
            </button>
        </div> 
            {subPestana === 'formulario' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', backgroundColor: editandoProductoId ? '#eff6ff' : '#f9fafb', padding: '15px', borderRadius: '12px', border: editandoProductoId ? '2px dashed #3b82f6' : '1px solid #e5e7eb', overflowY: 'auto', paddingBottom: '140px' }}>
                {/* CABECERA DINÁMICA CON BOTÓN DE ESCAPE INTEGRADO */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 'bold', color: editandoProductoId ? '#1e40af' : '#374151' }}>
                        {editandoProductoId ? '🔄 MODIFICAR PRODUCTO SELECCIONADO' : '✨ REGISTRAR NUEVO PRODUCTO / ARTÍCULO'}
                    </h3>
                     {editandoProductoId && (
                        <button 
                            type="button" 
                            onClick={() => {
                                // 🎯 BISTURÍ REPARADOR: Cancela la edición y limpia la interfaz sin disparar guardados falsos
                                cancelarEdicionProducto();
                                if (fileInputRef.current) fileInputRef.current.value = "";
                                const inputReceta = document.getElementById('buscador-insumo-receta');
                                if (inputReceta) inputReceta.value = "";
                                setEstadoImagen('');
                                setSubPestana('listado'); 
                            }}
                            style={{ border: 'none', background: '#ef4444', color: 'white', padding: '3px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold', cursor: 'pointer' }}
                        >
                            CREAR NUEVO X
                        </button>
                    )}
                </div>
                
                {/* 📐 FILA 1A: IDENTIDAD Y VENTA (Diseño responsive 50/50) */}
<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
    <div>
        <label style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#6b7280', display: 'block', marginBottom: '4px' }}>Nombre del Producto</label>
        <input type="text" placeholder="Nombre" value={nuevoPlato.nombre} onChange={(e) => setNuevoPlato({...nuevoPlato, nombre: e.target.value})} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ccc', fontSize: '0.9rem', outline: 'none', textTransform: 'uppercase' }} />
    </div>
    <div>
        <label style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#6b7280', display: 'block', marginBottom: '4px' }}>Precio Venta ($)</label>
        <input type="number" placeholder="Precio" value={nuevoPlato.precio} onChange={(e) => setNuevoPlato({...nuevoPlato, precio: e.target.value})} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ccc', fontSize: '0.9rem', outline: 'none', textAlign: 'center' }} />
    </div>
</div>

               {/* 📐 FILA 1B: COSTO Y CATEGORÍA (Diseño responsive 50/50 justo abajo) */}
<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '2px' }}>
    <div>
        <label style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#6b7280', display: 'block', marginBottom: '4px' }}>Precio Costo ($)</label>
        <input type="number" placeholder="Costo" value={nuevoPlato.precioCosto || ''} onChange={(e) => setNuevoPlato({...nuevoPlato, precioCosto: e.target.value})} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ccc', fontSize: '0.9rem', outline: 'none', textAlign: 'center' }} />
    </div>
    <div>
        <label style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#6b7280', display: 'block', marginBottom: '4px' }}>Categoría</label>
       <select 
    value={(() => {
        if (!nuevoPlato.categoria) return '';
        const catVal = String(nuevoPlato.categoria).toLowerCase().trim();
        // 🎯 Resuelve dinámicamente el UUID si el producto trae slug/texto
        const encontrada = categorias.find(c => 
            String(c.id || c._id).toLowerCase() === catVal ||
            String(c.slug || c.slug?.current).toLowerCase() === catVal ||
            String(c.titulo || c.nombre).toLowerCase() === catVal
        );
        return encontrada ? String(encontrada.id || encontrada._id) : nuevoPlato.categoria;
    })()} 
    onChange={(e) => setNuevoPlato({...nuevoPlato, categoria: e.target.value})} 
    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ccc', fontSize: '0.9rem', outline: 'none' }}
>
    <option value="">Categoría...</option>
    {categorias.map(c => {
        const catId = String(c.id || c._id || c.categoria_id || '');
        return <option key={catId} value={catId}>{(c.titulo || c.nombre || '').toUpperCase()}</option>;
    })}
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
                try {
                    // 🛡️ Soporte híbrido: Busca la función ejecutable en subirImagen o subirImagenASupabase
                    const fnSubida = typeof subirImagen === 'function' ? subirImagen : (typeof subirImagenASupabase === 'function' ? subirImagenASupabase : null);
                    
                    const urlPublica = fnSubida ? await fnSubida(file) : null;

                    if (urlPublica) {
                        const urlLimpia = typeof urlPublica === 'string' ? urlPublica : (urlPublica.asset || urlPublica.url);
                        setNuevoPlato(prev => ({ ...prev, imagen: urlLimpia }));
                        setEstadoImagen("✅ Lista."); 
                    } else {
                        setEstadoImagen("❌ Error al subir.");
                        if (fileInputRef.current) fileInputRef.current.value = "";
                    }
                } catch (err) {
                    console.error("🔥 Error al procesar imagen:", err);
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

                {/* 📐 FILA 3: CONFIGURACIONES ADICIONALES (Checkboxes estilizados compactos) */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px', alignItems: 'center', padding: '2px 0', backgroundColor: '#fff', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
                    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', fontSize: '0.68rem', fontWeight: 'bold', color: '#374151', cursor: 'pointer', textAlign: 'center', padding: '4px 2px' }}>
                        <input type="checkbox" checked={nuevoPlato.controlaInventario} onChange={(e) => setNuevoPlato({...nuevoPlato, controlaInventario: e.target.checked})} style={{ cursor: 'pointer', width: '13px', height: '13px' }} />
                        ¿INVENTARIO?
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', fontSize: '0.68rem', fontWeight: 'bold', color: '#374151', cursor: 'pointer', textAlign: 'center', padding: '4px 2px', borderLeft: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb' }}>
                        <input type="checkbox" checked={nuevoPlato.disponible !== false} onChange={(e) => setNuevoPlato({...nuevoPlato, disponible: e.target.checked})} style={{ cursor: 'pointer', width: '13px', height: '13px' }} />
                        ¿DISPONIBLE?
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', fontSize: '0.68rem', fontWeight: 'bold', color: '#dc2626', cursor: 'pointer', textAlign: 'center', padding: '4px 2px' }}>
                        <input type="checkbox" checked={nuevoPlato.esVentaPorPeso === true} onChange={(e) => setNuevoPlato({...nuevoPlato, esVentaPorPeso: e.target.checked})} style={{ cursor: 'pointer', width: '13px', height: '13px', accentColor: '#dc2626' }} />
                        ¿POR PESO/KG?
                    </label>
                </div>
{/* ========================================== */}
{/* MÓDULO ÚNICO DE INVENTARIO (RECETA MÚLTIPLE) */}
{/* ========================================== */}
{nuevoPlato.controlaInventario && (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ backgroundColor: '#fff', padding: '12px', borderRadius: '8px', border: '1px solid #d1d5db', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#3b82f6' }}>📋 PRODUCTOS / INSUMOS A DESCONTAR AL VENDERSE:</span>
            
            {Array.isArray(nuevoPlato.insumosReceta) && nuevoPlato.insumosReceta.map((insumo, index) => {
    // 🧠 Buscamos primero en el array global, pero si no existe, usamos de fallback la metadata que inyectamos localmente
    const insumoInfo = listaInventario.find(i => i._id === insumo.insumoId || i.id === insumo.insumoId || i.insumo_id === insumo.insumoId);
    const nombreAMostrar = insumoInfo ? insumoInfo.nombre : (insumo.nombre || 'Insumo seleccionado');
    const stockAMostrar = insumoInfo ? (insumoInfo.stockActual ?? insumoInfo.stock_actual ?? 0) : (insumo.stockActual || 0);

    return (
        <div key={index} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', flex: 1, color: '#111827', fontWeight: '500' }}>
                • {nombreAMostrar.toUpperCase()} (Stock: {stockAMostrar})
            </span>
                        <input 
                            type="number" 
                            placeholder="Cant." 
                            value={insumo.cantidad || ''} 
                            onChange={(e) => {
                                const valorNum = Number(e.target.value);
                                const copiaInsumos = [...nuevoPlato.insumosReceta];
                                copiaInsumos[index].cantidad = isNaN(valorNum) || valorNum <= 0 ? '' : valorNum;
                                setNuevoPlato({ ...nuevoPlato, insumosReceta: copiaInsumos });
                            }} 
                            style={{ width: '70px', padding: '6px', borderRadius: '4px', border: '1px solid #ccc', textAlign: 'center', fontSize: '0.85rem' }} 
                        />
                        <button 
                            type="button" 
                            onClick={() => {
                                const copiaInsumos = nuevoPlato.insumosReceta.filter((_, i) => i !== index);
                                setNuevoPlato({ ...nuevoPlato, insumosReceta: copiaInsumos });
                            }} 
                            style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '1rem' }}
                        >
                            ❌
                        </button>
                    </div>
                );
            })}

            {/* ======================================================================= */}
            {/* 🚀 BUSCADOR ULTRA-OPTIMIZADO PARA MÁS DE 1,700 INSUMOS (ALTO RENDIMIENTO) */}
            {/* ======================================================================= */}
            <div style={{ display: 'flex', gap: '6px', marginTop: '4px', position: 'relative' }}>
                <div style={{ flex: 1, position: 'relative' }}>
                    <input
                        id="buscador-insumo-receta"
                        type="text"
                        placeholder="🔍 Escribe para buscar insumo (Ej: Coronita)..."
                        onChange={(e) => {
    const texto = e.target.value.toLowerCase().trim();
    const contenedorResultados = document.getElementById('dropdown-resultados-insumos');
    if (!contenedorResultados) return;

    // ⚡ DEFENSIVO 1: Si borra o deja menos de 2 letras, limpiamos el timer y ocultamos
    if (texto.length < 2) {
        if (timerBusquedaRef.current) clearTimeout(timerBusquedaRef.current);
        contenedorResultados.style.display = 'none';
        return;
    }

    // ⏱️ DEBOUNCE: Cancelamos el request inmediatamente anterior si el usuario sigue digitando rápido
    if (timerBusquedaRef.current) clearTimeout(timerBusquedaRef.current);

    // Configura la espera de 300ms antes de disparar el golpe a Supabase
    timerBusquedaRef.current = setTimeout(() => {
        // 📡 DESACOPLE TOTAL Y CONTROLADO: Viaja un solo request limpio
        fetch(`/api/inventario/list?tenantId=${tenantId}&search=${encodeURIComponent(texto)}`)
            .then(res => res.json())
            .then(data => {
                if (!Array.isArray(data) || data.length === 0) {
                    contenedorResultados.innerHTML = `<div style="padding: 8px; color: #9ca3af; font-size: 0.85rem; text-align: center;">❌ No se encontraron insumos</div>`;
                    contenedorResultados.style.display = 'block';
                    return;
                }

                const sugerencias = data.filter(item => {
                    const idItem = item.insumo_id || item._id || item.id;
                    const yaAgregado = Array.isArray(nuevoPlato.insumosReceta) && 
                        nuevoPlato.insumosReceta.some(r => r.insumoId === idItem);
                    return !yaAgregado;
                }).slice(0, 15);

                if (sugerencias.length === 0) {
                    contenedorResultados.style.display = 'none';
                    return;
                }

                contenedorResultados.innerHTML = sugerencias.map(item => `
                    <div 
                        class="opcion-insumo-item"
                        data-id="${item.insumo_id || item._id || item.id}"
                        style="padding: 8px 12px; cursor: pointer; border-bottom: 1px solid #f3f4f6; font-size: 0.85rem; display: flex; justify-content: space-between; transition: background 0.15s;"
                        onmouseover="this.style.backgroundColor='#f3f4f6'"
                        onmouseout="this.style.backgroundColor='transparent'"
                    >
                        <span style="font-weight: 500; color: #1f2937;">${(item.nombre || '').toUpperCase()}</span>
                        <span style="color: #059669; font-weight: bold;">Stock: ${item.stock_actual !== undefined ? item.stock_actual : (item.stockActual || 0)}</span>
                    </div>
                `).join('');

                contenedorResultados.style.display = 'block';

                document.querySelectorAll('.opcion-insumo-item').forEach(el => {
                    el.onclick = () => {
                        const id = el.getAttribute('data-id');
                        const nombreInsumo = el.querySelector('span:first-child').innerText;
                        const stockInsumo = el.querySelector('span:last-child').innerText.replace('Stock: ', '');
                        
                        const actuales = Array.isArray(nuevoPlato.insumosReceta) ? nuevoPlato.insumosReceta : [];
                        setNuevoPlato({
                            ...nuevoPlato,
                            insumosReceta: [...actuales, { 
                                insumoId: id, 
                                cantidad: 1,
                                nombre: nombreInsumo,
                                stockActual: stockInsumo
                            }]
                        });

                        const inputEl = document.getElementById('buscador-insumo-receta');
                        if (inputEl) inputEl.value = "";
                        contenedorResultados.style.display = 'none';
                    };
                });
            })
            .catch(err => {
                console.error("🔥 Error cargando receta:", err);
                contenedorResultados.style.display = 'none';
            });
    }, 300); // 🚀 Espera 300 milisegundos de calma en el teclado antes de consultar
}}
                        style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '2px solid #3b82f6', fontSize: '0.9rem', outline: 'none' }}
                        onBlur={() => {
                            // Delay preventivo para que el click del dropdown se registre antes de ocultarlo
                            setTimeout(() => {
                                const contenedorResultados = document.getElementById('dropdown-resultados-insumos');
                                if (contenedorResultados) contenedorResultados.style.display = 'none';
                            }, 200);
                        }}
                    />

                    {/* MENÚ DESPLEGABLE FLOTANTE DINÁMICO */}
                    <div 
                        id="dropdown-resultados-insumos" 
                        style={{ 
                            position: 'absolute', 
                            top: '100%', 
                            left: 0, 
                            right: 0, 
                            backgroundColor: 'white', 
                            border: '2px solid #3b82f6', // Borde azul para que resalte más en celular
                            borderRadius: '6px', 
                            boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3), 0 4px 6px -2px rgba(0,0,0,0.15)', // Sombra más pesada para romper el fondo
                            zIndex: 9999, // 🚀 Rompe cualquier guillotina de overflow superior
                            maxHeight: '180px', // Un poco más compacto para que quepa perfecto con el teclado en celular
                            overflowY: 'auto', 
                            display: 'none',
                            marginTop: '2px'
                        }}
                    />
                </div>
            </div>
        </div>
    </div>
)}
                {/* ACCIÓN DE GUARDADO */}
                <button 
                    type="button"
                    disabled={guardando} 
                    onClick={async () => {
                        // 🎯 RETORNO AUTOMÁTICO AL LISTADO AL GUARDAR EXITOSAMENTE
                        await handleCrearProducto();
                        if (fileInputRef.current) fileInputRef.current.value = "";
                        const inputReceta = document.getElementById('buscador-insumo-receta');
                        if (inputReceta) inputReceta.value = "";
                        setEstadoImagen('');
                        setSubPestana('listado');
                    }}
                    style={{ padding: '9px', backgroundColor: editandoProductoId ? '#2563eb' : '#10b981', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.8rem', textTransform: 'uppercase', marginTop: '4px' }}
                >
                    {guardando ? 'PROCESANDO...' : editandoProductoId ? '💾 GUARDAR PRODUCTO' : '🚀 REGISTRAR PRODUCTO'}
                </button>
            </div>
            )}
            {/* 🎯 CONVERGENCIA SENIOR: Si la pestaña es listado, renderizamos la tabla */}
            {subPestana === 'listado' && (
            <>
            {/* BUSCADOR AUTÓNOMO QUE ESCANEA LOS 1,600 PRODUCTOS EN BD */}
            <input 
                type="text" 
                placeholder="🔍 Buscar producto en toda la BD (Ej: Marlboro, Agua)..." 
                value={busquedaProd} 
                onChange={(e) => {
                    const texto = e.target.value;
                    setBusquedaProd(texto);

                    if (timerBusquedaTablaRef.current) clearTimeout(timerBusquedaTablaRef.current);

                    timerBusquedaTablaRef.current = setTimeout(() => {
                        const termino = texto.trim();
                        if (!termino) {
                            setProductosVisuales(listaProductosCompletas);
                            return;
                        }

                        fetch(`/api/admin/productos?tenantId=${tenantId}&search=${encodeURIComponent(termino)}`)
                            .then(res => res.json())
                            .then(data => {
                                const resultados = Array.isArray(data) ? data : (data.data || []);
                                setProductosVisuales(resultados);
                            })
                            .catch(err => console.error("🔥 Error buscando en BD:", err));
                    }, 300);
                }} 
                style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid #3b82f6', fontSize: '0.85rem', backgroundColor: '#fff', flexShrink: 0, outline: 'none' }} 
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
    {/* 🛡️ RENDERIZADO VIRTUALIZADO: Limita a 100 resultados visibles simultáneos para garantizar fluidez a 60 FPS */}
    {(busquedaProd ? productosVisuales : productosVisuales.slice(0, 100)).map(p => {
        const idProducto = p.id || p._id;
        return (
            <tr key={idProducto} onClick={() => {
                const fuenteReceta = Array.isArray(p.recetas) ? p.recetas : (p.recetaInsumos || []);
                
                const recetaNormalizada = fuenteReceta.map(item => {
                    const idInsumo = item.insumo_id || item.insumoId || item.insumo?._ref;
                    const coincidencia = (listaInventario || []).find(i => i.id === idInsumo || i.insumo_id === idInsumo || i._id === idInsumo);
                    
                    return {
                        insumoId: idInsumo,
                        cantidad: Number(item.cantidad) || 1,
                        nombre: coincidencia ? coincidencia.nombre : 'Insumo guardado',
                        stockActual: coincidencia ? (coincidencia.stock_actual ?? coincidencia.stockActual ?? 0) : 0
                    };
                });

                activarEdicionProducto({ ...p, insumosReceta: recetaNormalizada });
                
                const inputReceta = document.getElementById('buscador-insumo-receta');
                if (inputReceta) inputReceta.value = "";
                setSubPestana('formulario');
            }} style={{ borderBottom: '1px solid #e5e7eb', cursor: 'pointer' }}>
                <td style={{ padding: '10px', fontWeight: '500', color: '#111827', textTransform: 'uppercase' }}>{p.nombre}</td>
                <td style={{ padding: '10px', textAlign: 'right', fontWeight: 'bold', color: '#059669' }}>${Number(p.precio || 0).toLocaleString('es-CO')}</td>
                <td style={{ padding: '10px', textAlign: 'center' }}>
                    <button 
                        type="button"
                        onClick={(e) => { 
                            e.stopPropagation();
                            if (confirm(`¿Seguro que deseas eliminar el producto "${p.nombre}"?`)) {
                                handleBorrarProducto(idProducto); 
                            }
                        }} 
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '1rem' }}
                    >
                        🗑️
                    </button>
                </td>
            </tr>
        );
    })}
          </tbody>
                </table>
            </div>
            </>
            )}
        </div>
    );
}