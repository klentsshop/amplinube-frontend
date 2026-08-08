'use client';
import React, { useState, useEffect } from 'react';
import { Monitor, PlusCircle } from 'lucide-react';
import { client } from '@/lib/sanity';
import { getStationFingerprint } from '@/lib/utils';

// 🛡️ ENLACES MÓDULOS DESCUARTIZADOS EN JS NATIVO
import VistaEstacion from './pestanas/VistaEstacion';
import VistaCategorias from './pestanas/VistaCategorias';
import VistaInventario from './pestanas/VistaInventario';
import VistaProductos from './pestanas/VistaProductos';
import VistaGastos from './pestanas/VistaGastos';
import VistaMeseros from './pestanas/VistaMeseros';
import VistaSeguridad from './pestanas/VistaSeguridad';
import VistaVentas from './pestanas/VistaVentas';

export default function ConfigImpresionModal({ isOpen, onClose, categorias, tenantId }) {
    // --- 1. CONTROL DE NAVEGACIÓN (Pestañas) ---
    const [pestanaActiva, setPestanaActiva] = useState('estacion'); 
    const [impresoraNombre, setImpresoraNombre] = useState('');
    const [anchoPapel, setAnchoPapel] = useState(58); // 👈 Estado inicial en 58 mm
    const [listaCategoriasCompletas, setListaCategoriasCompletas] = useState([]);
    const [editandoCatId, setEditandoCatId] = useState(null);

    // --- 2. ESTADOS PESTAÑA 1: ESTACIÓN HARDWARE ---
    const [nombreEstacion, setNombreEstacion] = useState('');
    const [categoriasSeleccionadas, setCategoriasSeleccionadas] = useState([]);
    const [fingerprint, setFingerprint] = useState('');
    const [guardando, setGuardando] = useState(false);

    // --- 3. ESTADOS PESTAÑA 2: NUEVA CATEGORÍA ---
    const [nuevaCatTitulo, setNuevaCatTitulo] = useState('');
    const [nuevaCatSeImprime, setNuevaCatSeImprime] = useState(true);

    // --- 4. ESTADOS PESTAÑA 3: NUEVO PRODUCTO ---
    const [listaProductosCompletas, setListaProductosCompletas] = useState([]);
    const [busquedaProd, setBusquedaProd] = useState('');
    const [editandoProductoId, setEditandoProductoId] = useState(null);
    const [nuevoPlato, setNuevoPlato] = useState({
        nombre: '',
        precio: '',
        precioCosto: '',
        categoria: '',
        controlaInventario: false,
        disponible: true,
        barcode: '',
        codigoBalanza: '',
        imagen: null,
        insumosReceta: [],
        esVentaPorPeso: false
    });

    // --- 5. ESTADOS PESTAÑA 4: INVENTARIO / STOCK ---
    const [listaInventario, setListaInventario] = useState([]);
    const [busquedaInv, setBusquedaInv] = useState('');
    const [cargandoInv, setCargandoInv] = useState(false);
    const [idItemEditando, setIdItemEditando] = useState(null);
    const timerInventarioRef = React.useRef(null);

    const [listaGastosCompletas, setListaGastosCompletas] = useState([]);
    const [busquedaGasto, setBusquedaGasto] = useState('');
    const [editandoGastoId, setEditandoGastoId] = useState(null);
    const [nuevoGasto, setNuevoGasto] = useState({
        descripcion: '',
        monto: ''
    });
    const [gastoDescripcion, setGastoDescripcion] = useState('');
    const [gastoMonto, setGastoMonto] = useState('');

    const [listaMeserosCompletas, setListaMeserosCompletas] = useState([]);
    const [busquedaMesero, setBusquedaMesero] = useState('');
    const [editandoMeseroId, setEditandoMeseroId] = useState(null);
    const [meseroNombre, setMeseroNombre] = useState('');
    const [meseroActivo, setMeseroActivo] = useState(true);

    const [itemIdSeguridad, setItemIdSeguridad] = useState(null);
    const [pinCajero, setPinCajero] = useState('');
    const [pinAdmin, setPinAdmin] = useState('');

    const [invNombre, setInvNombre] = useState('');
    const [invStockActual, setInvStockActual] = useState('');
    const [invStockMinimo, setInvStockMinimo] = useState('5');
    const [invBarcode, setInvBarcode] = useState('');
    const [invCodigoBalanza, setInvCodigoBalanza] = useState('');

    // --- FUNCIONES ASÍNCRONAS ORIGINALES (CERO MODIFICACIONES) ---
    const cargarInventarioAdmin = async () => {
        if (!tenantId) return;
        setCargandoInv(true);
        try {
            const res = await fetch(`/api/inventario/list?tenantId=${tenantId}&search=${encodeURIComponent(busquedaInv.trim())}`);
            const data = await res.json();
            setListaInventario(data || []);
        } catch (e) {
            console.error("Error cargando inventario:", e);
        } finally {
            setCargandoInv(false);
        }
    };

   const cargarProductosNegocio = async () => {
        if (!tenantId) return;
        try {
            const res = await fetch(`/api/admin/productos?tenantId=${tenantId}&_t=${Date.now()}`);
            const data = await res.json();
            const items = Array.isArray(data) ? data : (data.data || []);
            setListaProductosCompletas(items);
        } catch (e) {
            console.error("🔥 Error descargando catálogo de productos desde Supabase:", e);
        }
    };

    const cargarCategoriasNegocio = async () => {
        if (!tenantId) return;
        try {
            const res = await fetch(`/api/admin/categorias?tenantId=${tenantId}&_t=${Date.now()}`);
            const data = await res.json();
            const items = Array.isArray(data) ? data : (data.data || []);
            setListaCategoriasCompletas(items);
        } catch (e) {
            console.error("🔥 Error descargando categorías desde Supabase:", e);
        }
    };

    // --- LÍNEA 95 aprox: REEMPLAZAR POR ESTA LÓGICA DE CONSUMO CONTROLADO ---
    useEffect(() => {
        if (!tenantId) return;

        // 1. Si el cajero cambia de pestaña, ejecutamos las cargas estáticas de inmediato
        if (pestanaActiva === 'productos') {
            cargarProductosNegocio();
        }
        if (pestanaActiva === 'gastos') { 
            cargarGastosNegocio();
        }
        if (pestanaActiva === 'meseros') { 
            cargarMeserosNegocio();
        }
        if (pestanaActiva === 'seguridad') { 
            cargarSeguridadNegocio();
        }
        if (pestanaActiva === 'historial_ventas') {
            // Se refresca de forma automática por el useEffect interno de la pestaña
        }

        // 2. 🛡️ CONTROL DE INTEGRIDAD: Solo cargamos el inventario maestro al entrar a la pestaña.
        // Las búsquedas en caliente e inserciones se manejan por demanda interna sin ráfagas.
        if (pestanaActiva === 'inventario' && !busquedaInv.trim()) {
            cargarInventarioAdmin();
        }

        return () => {
            if (timerInventarioRef.current) clearTimeout(timerInventarioRef.current);
        };
    }, [pestanaActiva, tenantId, busquedaInv]); // 🔒 Mantenemos busquedaInv para que no pierdas la edición de ningún producto
    useEffect(() => {
        if (isOpen && typeof window !== 'undefined') {
            cargarConfiguracion();
            cargarCategoriasNegocio();
            cargarInventarioAdmin();
        }
    }, [isOpen]);

    const cargarConfiguracion = async () => {
        if (!tenantId) return; 
        try {
            const res = await fetch(`/api/catalogo?tenantId=${tenantId}`);
            const dataCache = await res.json();
            
            if (dataCache) {
                const docNegocio = Array.isArray(dataCache) ? dataCache.find(i => i._type === 'negocio' || i.tenant) : null;
                if (docNegocio) {
                    if (docNegocio.categorias) {
                        const catsArray = typeof docNegocio.categorias === 'string' 
                            ? docNegocio.categorias.split(',') 
                            : docNegocio.categorias;
                        setCategoriasSeleccionadas(catsArray);
                    }
                    if (docNegocio.impresoraNombre) setImpresoraNombre(docNegocio.impresoraNombre);
                    if (docNegocio.ancho_papel || docNegocio.anchoPapel) {
                        setAnchoPapel(Number(docNegocio.ancho_papel || docNegocio.anchoPapel));
                    }
                }
            }
        } catch (e) {
            console.error("Error cargando configuración de negocio:", e);
        }
    };

    const toggleCategoria = (cat) => {
        setCategoriasSeleccionadas(prev => 
            prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
        );
    };

    const guardarEstacion = async (dataEnviar) => {
        setGuardando(true);
        try {
            const res = await fetch('/api/estaciones/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    categorias: dataEnviar?.categorias || categoriasSeleccionadas,
                    impresoraNombre: dataEnviar?.impresoraNombre || '',
                    ancho_papel: Number(dataEnviar?.ancho_papel || anchoPapel) || 58, // 👈 Se envía a la API
                    tenantAlias: tenantId
                })
            });
            const data = await res.json();
            if (data.success) {
                alert('✅ Configuración de Estación e Impresora guardada.');
                onClose();
            } else { 
                throw new Error(data.error || 'Error desconocido'); 
            }
        } catch (error) {
            console.error("🔥 Error al guardar estación:", error);
            alert('❌ Error al guardar: Revisa la consola');
        } finally { 
            setGuardando(false); 
        }
    };

    const handleCrearCategoria = async () => {
        if (!nuevaCatTitulo.trim()) return alert("⚠️ Escribe el nombre de la categoría.");
        setGuardando(true);
        try {
            const tituloLimpio = nuevaCatTitulo.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
            const slugAutomatico = tituloLimpio.toLowerCase().replace(/\s+/g, '-');
            const metodo = editandoCatId ? 'PUT' : 'POST';

            const res = await fetch('/api/admin/categorias', {
                method: metodo,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    categoriaId: editandoCatId,
                    titulo: tituloLimpio,
                    slug: slugAutomatico,
                    seImprime: nuevaCatSeImprime,
                    tenantId
                })
            });
            const data = await res.json();
            if (data.ok) {
                alert(editandoCatId ? '🔄 ¡Categoría actualizada con éxito!' : '🚀 ¡Categoría creada de forma segura!');
                setNuevaCatTitulo('');
                setNuevaCatSeImprime(true);
                setEditandoCatId(null);
                await cargarCategoriasNegocio();
                window.dispatchEvent(new Event('inventarioActualizado'));
            } else { alert(`❌ Error: ${data.error}`); }
        } catch (e) {
            alert('❌ Fallo de comunicación con el servidor.');
        } finally { setGuardando(false); }
    };

   const handleEliminarCategoria = async (id, nombre) => {
    if (!confirm(`⚠️ ¿Seguro que deseas eliminar la categoría "${nombre}"?\n\n¡Esto no se puede deshacer y desvinculará los productos asociados!`)) return;
    setGuardando(true);
    try {
        const res = await fetch('/api/admin/categorias', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ categoriaId: id, tenantId })
        });
        
        const data = await res.json();
        
        if (data.ok) {
            alert('🗑️ Categoría eliminada del sistema.');
            await cargarCategoriasNegocio();
            window.dispatchEvent(new Event('inventarioActualizado'));
        } else { 
            // 🧠 BISTURÍ: Interceptamos si el error técnico contiene la palabra "reference" o "referred"
            const errorTexto = String(data.error || '').toLowerCase();
            
            if (errorTexto.includes('reference') || errorTexto.includes('referred') || errorTexto.includes('w10n')) {
                alert(`🚫 No se puede eliminar "${nombre}" porque todavía tiene productos vinculados a esta categoría.\n\nPor favor, cambia esos productos a otra categoría o bórralos antes de intentar eliminarla.`);
            } else {
                // Si es otro tipo de error (ej. conexión), dejamos el mensaje genérico estándar
                alert(`❌ No se pudo eliminar: ${data.error}`);
            }
        }
    } catch (e) {
        alert('❌ Fallo de comunicación con el servidor al intentar eliminar.');
    } finally { setGuardando(false); }
};

   // 🎯 BISTURÍ: Normalización de ID para evitar que caiga en 'undefined'
const activarEdicion = (cat) => {
    const idReal = cat.id || cat._id;
    setNuevaCatTitulo(cat.titulo || '');
    setNuevaCatSeImprime(cat.se_imprime ?? cat.seImprime ?? true);
    setEditandoCatId(idReal);
};

   // 🔄 REEMPLAZO EXACTO DE HANDLEGUARDARINVENTARIO
    const handleGuardarInventario = async (e) => {
        e.preventDefault();
        if (!invNombre || !invNombre.trim()) return alert("⚠️ El nombre del insumo es obligatorio.");
        setGuardando(true);
        
        try {
            const esEdicion = Boolean(idItemEditando);
            const metodo = esEdicion ? 'PUT' : 'POST';
            
            // 🛡️ PAYLOAD NORMALIZADO PARA SUPABASE
            const payload = {
                nombre: invNombre.trim(),
                stockActual: Number(invStockActual) || 0,
                stockMinimo: Number(invStockMinimo) || 5,
                barcode: invBarcode && invBarcode.trim() ? invBarcode.trim() : "",
                codigoBalanza: invCodigoBalanza && invCodigoBalanza.trim() ? invCodigoBalanza.trim() : "",
                tenantId: tenantId
            };

            // Inyectamos el ID para el caso de edición
            if (esEdicion) {
                payload.itemId = idItemEditando;
            }

            // 🚀 APUNTA A LA API ADMINISTRATIVA DE INVENTARIO
            const res = await fetch('/api/admin/inventario', {
                method: metodo,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            const data = await res.json();
            
            if (res.ok && (data.ok || data.success)) {
                alert(esEdicion ? '🔄 ¡Insumo actualizado correctamente!' : '🚀 ¡Materia prima registrada!');
                cancelarEdicion();
                if (typeof cargarInventarioAdmin === 'function') {
                    await cargarInventarioAdmin();
                }
                // Disparar evento para revalidar el POS si es necesario
                window.dispatchEvent(new Event('inventarioActualizado'));
            } else { 
                alert(`❌ Error del servidor: ${data.error || 'No se pudo procesar la solicitud.'}`); 
            }
        } catch (error) {
            console.error("🔥 Error en handleGuardarInventario:", error);
            alert('❌ Error de comunicación al procesar inventario.');
        } finally { 
            setGuardando(false); 
        }
    };

   const seleccionarParaEditar = (item) => {
        // 🎯 LUPA SÉNIOR: Capturamos el insumo_id (alfanumérico de Sanity) para amarrar la edición híbrida
        const idCorrecto = item.insumo_id || item.id || item._id;
        setIdItemEditando(idCorrecto);
        
        setInvNombre(item.nombre || '');
        
        // 🥩 Rescatamos el stock vivo real priorizando Supabase, con fallback a Sanity
        const stockFisico = item.stock_actual !== undefined ? item.stock_actual : (item.stockActual || 0);
        setInvStockActual(Number(stockFisico));
        
        // Lo mismo para el stock mínimo de alertas
        const minimoFisico = item.stock_minimo !== undefined ? item.stock_minimo : (item.stockMinimo || 5);
        setInvStockMinimo(Number(minimoFisico));
        
        setInvBarcode(item.barcode || '');
        setInvCodigoBalanza(item.codigoBalanza || '');
    };

    const cancelarEdicion = () => {
        setIdItemEditando(null);
        setInvNombre('');
        setInvStockActual('');
        setInvStockMinimo('5');
        setInvBarcode('');
        setInvCodigoBalanza('');
    };

   const handleBorrarInventario = async (itemId) => {
        if (!confirm("⚠️ ¿Seguro que deseas eliminar este ítem del inventario? Esto romperá el stock de los productos que dependan de él.")) return;
        setGuardando(true);
        try {
            const res = await fetch('/api/admin/inventario', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ itemId, tenantId })
            });
            
            const data = await res.json(); // 🛡️ BISTURÍ: Desempaquetamos la respuesta real del backend
            
            if (res.ok && data.ok) {
                alert('🗑️ Insumo eliminado correctamente de todo el sistema.');
                if (idItemEditando === itemId) cancelarEdicion();
                await cargarInventarioAdmin();
                window.dispatchEvent(new Event('inventarioActualizado'));
            } else { 
                // 🎯 Si la base de datos se queja por llaves foráneas o recetas, te lo dirá aquí en la pantalla
                alert(`❌ Error al eliminar: ${data.error || 'Restricción de integridad en base de datos'}`); 
            }
        } catch (error) { 
            console.error("🔥 Error al borrar insumo:", error);
            alert("❌ Fallo de comunicación con el servidor al intentar eliminar.");
        } finally { 
            setGuardando(false); 
        }
    };

 const handleCrearProducto = async () => {
        if (!nuevoPlato.nombre.trim() || !nuevoPlato.precio || !nuevoPlato.categoria) {
            return alert("⚠️ Por favor completa Nombre, Precio y Categoría.");
        }
        setGuardando(true);
        try {
            const metodo = editandoProductoId ? 'PUT' : 'POST';
            
            // Construcción del objeto para enviar a la API
            const datosEnvio = {
                nombre: nuevoPlato.nombre.trim(),
                precio: Number(nuevoPlato.precio),
                precioCosto: Number(nuevoPlato.precioCosto || 0),
                disponible: nuevoPlato.disponible,
                controlaInventario: nuevoPlato.controlaInventario,
                barcode: nuevoPlato.barcode ? nuevoPlato.barcode.trim() : null,
                codigoBalanza: nuevoPlato.codigoBalanza ? nuevoPlato.codigoBalanza.trim() : null,
                categoria: nuevoPlato.categoria, 
                tenantId,
                imagen: nuevoPlato.imagen,
                esVentaPorPeso: nuevoPlato.esVentaPorPeso === true,
                // Enviamos directamente el array plano de la receta unificada
               insumosReceta: nuevoPlato.controlaInventario ? (nuevoPlato.insumosReceta || []) : [],
               ...(editandoProductoId && { productoId: editandoProductoId })
               };
            const res = await fetch('/api/admin/productos', {
                method: metodo,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(datosEnvio)
            });
            const data = await res.json();
            if (data.ok) {
                alert(editandoProductoId ? '🔄 ¡Producto actualizado con éxito!' : '🚀 ¡Producto registrado con éxito!');
                cancelarEdicionProducto();
                await cargarProductosNegocio();
                window.dispatchEvent(new Event('inventarioActualizado'));
            } else { alert(`❌ Error: ${data.error}`); }
        } catch (e) {
            console.error("🔥 Error de comunicación:", e);
            alert('❌ Fallo de comunicación con el servidor.');
        } finally { setGuardando(false); }
    };
    // 🔄 FUNCIÓN CORREGIDA SIN VARIABLES HUÉRFANAS
const activarEdicionProducto = (prod) => {
    const idCorrecto = prod.id || prod._id;
    setEditandoProductoId(idCorrecto);
    
    // 🛡️ Extraer URL de la imagen
    const urlImagenExistente = typeof prod.imagen === 'string' 
        ? prod.imagen 
        : (prod.imagenUrl || prod.imagen?.asset?.url || null);

    // 🎯 RESOLUCIÓN ESTÁNDAR A UUID DE SUPABASE
    const catValorRaw = String(prod.categoria || prod.categoria_id || prod.categoria?._ref || '').toLowerCase().trim();

    const catCoincidente = (listaCategoriasCompletas || []).find(c => 
        String(c.id || c._id).toLowerCase() === catValorRaw ||
        String(c.slug || c.slug?.current).toLowerCase() === catValorRaw ||
        String(c.titulo || c.nombre).toLowerCase() === catValorRaw
    );

    const idCategoria = catCoincidente ? String(catCoincidente.id || catCoincidente._id) : catValorRaw;

    const fuenteReceta = Array.isArray(prod.recetas) ? prod.recetas : (prod.insumosReceta || prod.recetaInsumos || []);
    
    const recetaNormalizada = fuenteReceta.map(item => ({
        insumoId: item.insumo_id || item.insumoId || item.insumo?._ref || '',
        cantidad: Number(item.cantidad || item.amount || 1)
    }));

    setNuevoPlato({
        nombre: prod.nombre || '',
        precio: prod.precio || '',
        precioCosto: prod.precio_costo ?? prod.precioCosto ?? '',
        categoria: idCategoria, // 👈 Usa 'idCategoria' sin ReferenceError
        controlaInventario: prod.controla_inventario ?? prod.controlaInventario ?? false,
        disponible: prod.disponible !== false,
        barcode: prod.barcode || '',
        codigoBalanza: prod.codigo_balanza || prod.codigoBalanza || '',
        imagen: urlImagenExistente,
        insumosReceta: recetaNormalizada,
        esVentaPorPeso: (prod.es_venta_por_peso ?? prod.esVentaPorPeso) === true
    });
};
    const cancelarEdicionProducto = () => {
        setEditandoProductoId(null);
        setNuevoPlato({
            nombre: '',
            precio: '',
            precioCosto: '',
            categoria: '',
            controlaInventario: false,
            disponible: true,
            barcode: '',
            codigoBalanza: '',
            imagen: null,
            insumosReceta: [],
            esVentaPorPeso: false 
        });
    };

    const handleBorrarProducto = async (productoId) => {
        setGuardando(true);
        try {
            const res = await fetch('/api/admin/productos', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ productoId, tenantId })
            });
            const data = await res.json();
            if (data.ok) {
                if (editandoProductoId === productoId) cancelarEdicionProducto();
                // ⚡ ELIMINACIÓN OPTIMISTA EN MEMORIA: Lo remueve del estado del padre de inmediato
            setListaProductosCompletas(prev => prev.filter(p => (p.id || p._id) !== productoId));
                await cargarProductosNegocio();
                window.dispatchEvent(new Event('inventarioActualizado'));
            } else {
                alert(`❌ No se pudo eliminar: ${data.error}`);
            }
        } catch (error) {
            console.error("🔥 Error eliminando producto:", error);
            alert('❌ Error de comunicación con el servidor.');
        } finally {
            setGuardando(false);
        }
    };
   const cargarGastosNegocio = async () => {
        if (!tenantId) return;
        try {
        // 🛡️ BISTURÍ ANTI-CACHÉ: Agregamos Date.now() para que la URL sea única en cada llamada
        // Esto destruye la caché del navegador y obliga a traer la hora exacta procesada por el servidor.
        const res = await fetch(`/api/admin/gastos?tenantId=${tenantId}&_t=${Date.now()}`);
        const data = await res.json();
        setListaGastosCompletas(Array.isArray(data) ? data : data.data || []);
    } catch (e) {
        console.error("🔥 Error descargando gastos de Supabase:", e);
    }
    };
    // 🚀 CONTROLES Y OPERACIONES PARA EL MÓDULO DE GASTOS
    const handleGuardarGasto = async (e) => {
        e.preventDefault();
        if (!gastoDescripcion.trim() || !gastoMonto) return alert("⚠️ Descripción y Monto son obligatorios.");
        setGuardando(true);
        try {
            const metodo = editandoGastoId ? 'PUT' : 'POST';
            const body = {
                descripcion: gastoDescripcion.trim(),
                monto: Number(gastoMonto) || 0,
                tenantId,
                ...(editandoGastoId && { itemId: editandoGastoId })
            };

            const res = await fetch('/api/admin/gastos', {
                method: metodo,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const data = await res.json();
            if (data.ok) {
                alert(editandoGastoId ? '🔄 ¡Gasto modificado con éxito!' : '🚀 ¡Egreso registrado en caja!');
                cancelarEdicionGasto();
                await cargarGastosNegocio();
            } else { alert(`❌ Error: ${data.error}`); }
        } catch (error) {
            alert('❌ Error al procesar el gasto.');
        } finally { setGuardando(false); }
    };

    const seleccionarGastoParaEditar = (item) => {
        setEditandoGastoId(item.id || item._id);
        setGastoDescripcion(item.descripcion);
        setGastoMonto(item.monto);
    };

    const cancelarEdicionGasto = () => {
        setEditandoGastoId(null);
        setGastoDescripcion('');
        setGastoMonto('');
    };

    const handleBorrarGasto = async (itemId) => {
        if (!confirm("⚠️ ¿Seguro que deseas eliminar este registro de gasto? Esto alterará el arqueo de caja actual.")) return;
        setGuardando(true);
        try {
            const res = await fetch('/api/admin/gastos', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ itemId, tenantId })
            });
            if (res.ok) {
                if (editandoGastoId === itemId) cancelarEdicionGasto();
                await cargarGastosNegocio();
            } else { alert("❌ No se pudo eliminar el registro."); }
        } catch (error) { console.error(error); }
        finally { setGuardando(false); }
    };
   const subirImagenASupabase = async (file, imagenAnterior = null) => {
        try {
            const formData = new FormData();
            formData.append('file', file);
            if (tenantId) formData.append('tenantId', tenantId);
            if (imagenAnterior) formData.append('imagenAnterior', imagenAnterior);

            const res = await fetch('/api/admin/productos/upload', {
                method: 'POST',
                body: formData
            });

            const data = await res.json();
            if (res.ok && data.ok) {
                return data.asset;
            }
            return null;
        } catch (err) {
            console.error("Error al subir imagen a Supabase Storage:", err);
            return null;
        }
    };
    const cargarMeserosNegocio = async () => {
        if (!tenantId) return;
        try {
            const res = await fetch(`/api/admin/meseros?tenantId=${tenantId}&_t=${Date.now()}`);
            const data = await res.json();
            const items = Array.isArray(data) ? data : (data.data || []);
            setListaMeserosCompletas(items);
        } catch (e) { console.error("🔥 Error cargando vendedores desde Supabase:", e); }
    };
    const cargarSeguridadNegocio = async () => {
        if (!tenantId) return;
        try {
            const res = await fetch(`/api/admin/seguridad?tenantId=${tenantId}`);
            const result = await res.json();
            if (result.ok && result.data) {
                setItemIdSeguridad(result.data._id);
                setPinCajero(result.data.pinCajero || '');
                setPinAdmin(result.data.pinAdmin || '');
            }
        } catch (e) {
            console.error("🔥 Error cargando configuración de seguridad:", e);
        }
    };
    const inventarioFiltrado = React.useMemo(() => {
        return listaInventario.filter(item => 
            (item.nombre || "").toLowerCase().includes(busquedaInv.toLowerCase())
        );
    }, [listaInventario, busquedaInv]);

    const productosFiltrados = React.useMemo(() => {
    return listaProductosCompletas.filter(prod => 
        (prod.nombre || "").toLowerCase().includes(busquedaProd.toLowerCase())
    );
}, [listaProductosCompletas, busquedaProd]);

    const gastosFiltrados = React.useMemo(() => {
        return listaGastosCompletas.filter(g => 
            (g.descripcion || "").toLowerCase().includes(busquedaGasto.toLowerCase())
        );
    }, [listaGastosCompletas, busquedaGasto]);

    const meserosFiltrados = React.useMemo(() => {
        return listaMeserosCompletas.filter(m => (m.nombre || "").toLowerCase().includes(busquedaMesero.toLowerCase()));
    }, [listaMeserosCompletas, busquedaMesero]);

    // 🚀 OPERACIONES CRUD VENDEDORES (PAYLOAD GRANULAR EXTRAÍDO)
    const handleGuardarMesero = async (e) => {
        if (e && typeof e.preventDefault === 'function') e.preventDefault();
        if (!meseroNombre.trim()) return alert("⚠️ El nombre es obligatorio.");
        setGuardando(true);
        
        // 🧠 DESESTRUCTURACIÓN AVANZADA: Extraemos los 6 interruptores empaquetados en el hijo
        const targetPermisos = e?.target || {};
        const permisosPayload = {
            verReporte: targetPermisos.verReporte === true,
            verAdmin: targetPermisos.verAdmin === true,
            puedeCargarGasto: targetPermisos.puedeCargarGasto === true,
            verVentas: targetPermisos.verVentas === true,
            verInventario: targetPermisos.verInventario === true,
            puedeCobrar: targetPermisos.puedeCobrar === true
        };

        try {
            const metodo = editandoMeseroId ? 'PUT' : 'POST';
            const res = await fetch('/api/admin/meseros', {
                method: metodo,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    nombre: meseroNombre.trim(), 
                    activo: meseroActivo,
                    tenantId, 
                    ...permisosPayload, // 🎯 INYECCIÓN ATÓMICA DE LOS 6 PERMISOS HACIA TU API
                    ...(editandoMeseroId && { itemId: editandoMeseroId }) 
                })
            });
            const data = await res.json();
            
            if (data.ok) {
                // 🧠 Con el 'return' detenemos la ejecución de inmediato para evitar alertas fantasmas
                if (editandoMeseroId) {
                    alert('🔄 ¡Vendedor modificado con éxito!');
                } else {
                    alert('🚀 ¡Vendedor registrado con éxito!');
                }
                cancelarEdicionMesero();
                await cargarMeserosNegocio();
                return; // 👈 Salida limpia de la función
            } else { 
                alert(`❌ Error en el servidor: ${data.error || 'No se pudo procesar'}`); 
            }
        } catch (error) { 
            console.error("🔥 Error en guardar mesero:", error);
            alert('❌ Fallo de comunicación con el servidor.'); 
        } finally { 
            setGuardando(false); 
        }
    };
 
    // 🛡️ BISTURÍ: Capturar el ID real independientemente de si viene como 'id' (Supabase) o '_id' (Legacy)
const seleccionarMeseroParaEditar = (item) => {
    const idReal = item.id || item._id; // 👈 CORRECCIÓN AQUÍ
    setEditandoMeseroId(idReal);
    setMeseroNombre(item.nombre || '');
    setMeseroActivo(item.activo !== false);
    
    setTimeout(() => {
        window.dispatchEvent(new CustomEvent('sincronizarPermisosFormulario', { detail: item }));
    }, 20);
};

    const cancelarEdicionMesero = () => {
        setEditandoMeseroId(null);
        setMeseroNombre('');
        setMeseroActivo(true);
    };

    const handleBorrarMesero = async (itemId) => {
        if (!confirm("⚠️ ¿Deseas eliminar este vendedor del POS?")) return;
        setGuardando(true);
        try {
            await fetch('/api/admin/meseros', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ itemId, tenantId })
            });
            await cargarMeserosNegocio();
        } catch (e) { console.error(e); }
        finally { setGuardando(false); }
    };
    const handleGuardarSeguridad = async (e) => {
        e.preventDefault();
        
        if (pinCajero.trim().length < 4 || pinAdmin.trim().length < 4) {
            return alert("⚠️ Los Pines deben tener mínimo 4 caracteres.");
        }
        
        setGuardando(true);
        try {
            const res = await fetch('/api/admin/seguridad', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    itemId: itemIdSeguridad,
                    pinCajero: pinCajero.trim(),
                    pinAdmin: pinAdmin.trim(),
                    tenantId
                })
            });
            
            const data = await res.json();
            if (data.ok) {
                alert('🔒 Ajustes de seguridad actualizados correctamente.');
                await cargarSeguridadNegocio();
            } else {
                alert(`❌ Error: ${data.error}`);
            }
        } catch (error) {
            console.error(error);
            alert('❌ Fallo al guardar ajustes de seguridad.');
        } finally {
            setGuardando(false);
        }
    };
    if (!isOpen) return null;

    return (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '20px', backdropFilter: 'blur(4px)' }}>
            <div style={{ backgroundColor: 'white', borderRadius: '16px', width: '100%', maxWidth: '750px', maxHeight: 'auto', maxHeight: 'calc(100vh - 40px)', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)', overflow: 'hidden', border: '1px solid #e5e7eb', fontFamily: 'sans-serif' }}>
                
                {/* Header Estilo Talanquera Original */}
                <div style={{ backgroundColor: '#1f2937', color: 'white', padding: '20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Monitor size={24} color="#10b981" />
                    <div>
                        <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 'bold' }}>Configuración de Estación</h2>
                        <p style={{ margin: 0, fontSize: '0.75rem', color: '#9ca3af' }}>ID Único: {fingerprint}</p>
                    </div>
                    <button onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '1.5rem' }}>×</button>
                </div>

                {/* 🧭 NAVEGADOR DE PESTAÑAS EN DOS FILAS */}
                <div style={{ display: 'flex', flexDirection: 'column', background: '#f3f4f6', padding: '6px', gap: '6px', borderBottom: '1px solid #e5e7eb' }}>
                    {/* FILA 1: OPERACIONES DE MENÚ */}
                    <div style={{ display: 'flex', gap: '4px' }}>
                        <button onClick={() => setPestanaActiva('estacion')} style={{ flex: 1, padding: '8px 4px', border: 'none', fontSize: '0.7rem', fontWeight: 'bold', borderRadius: '6px', cursor: 'pointer', backgroundColor: pestanaActiva === 'estacion' ? 'white' : 'transparent', color: pestanaActiva === 'estacion' ? '#111827' : '#6b7280', boxShadow: pestanaActiva === 'estacion' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none' }}>💻 HARDWARE</button>
                        <button onClick={() => setPestanaActiva('categorias')} style={{ flex: 1, padding: '8px 4px', border: 'none', fontSize: '0.7rem', fontWeight: 'bold', borderRadius: '6px', cursor: 'pointer', backgroundColor: pestanaActiva === 'categorias' ? 'white' : 'transparent', color: pestanaActiva === 'categorias' ? '#111827' : '#6b7280', boxShadow: pestanaActiva === 'categorias' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none' }}>📁 + CATEGORÍA</button>
                        <button onClick={() => setPestanaActiva('inventario')} style={{ flex: 1, padding: '8px 4px', border: 'none', fontSize: '0.7rem', fontWeight: 'bold', borderRadius: '6px', cursor: 'pointer', backgroundColor: pestanaActiva === 'inventario' ? 'white' : 'transparent', color: pestanaActiva === 'inventario' ? '#111827' : '#6b7280', boxShadow: pestanaActiva === 'inventario' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none' }}>📦 INVENTARIO</button>
                        <button onClick={() => setPestanaActiva('productos')} style={{ flex: 1, padding: '8px 4px', border: 'none', fontSize: '0.7rem', fontWeight: 'bold', borderRadius: '6px', cursor: 'pointer', backgroundColor: pestanaActiva === 'productos' ? 'white' : 'transparent', color: pestanaActiva === 'productos' ? '#111827' : '#6b7280', boxShadow: pestanaActiva === 'productos' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none' }}>🍔 + PRODUCTO</button>
                    </div>
                    {/* FILA 2: ADMINISTRACIÓN Y CONTROL */}
                    <div style={{ display: 'flex', gap: '4px' }}>
                        <button onClick={() => setPestanaActiva('gastos')} style={{ flex: 1, padding: '8px 4px', border: 'none', fontSize: '0.7rem', fontWeight: 'bold', borderRadius: '6px', cursor: 'pointer', backgroundColor: pestanaActiva === 'gastos' ? 'white' : 'transparent', color: pestanaActiva === 'gastos' ? '#111827' : '#6b7280', boxShadow: pestanaActiva === 'gastos' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none' }}>💸 GASTOS</button>
                        <button onClick={() => setPestanaActiva('meseros')} style={{ flex: 1, padding: '8px 4px', border: 'none', fontSize: '0.7rem', fontWeight: 'bold', borderRadius: '6px', cursor: 'pointer', backgroundColor: pestanaActiva === 'meseros' ? 'white' : 'transparent', color: pestanaActiva === 'meseros' ? '#111827' : '#6b7280', boxShadow: pestanaActiva === 'meseros' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none' }}>👥 VENDEDORES</button>
                        <button onClick={() => setPestanaActiva('seguridad')} style={{ flex: 1, padding: '8px 4px', border: 'none', fontSize: '0.7rem', fontWeight: 'bold', borderRadius: '6px', cursor: 'pointer', backgroundColor: pestanaActiva === 'seguridad' ? 'white' : 'transparent', color: pestanaActiva === 'seguridad' ? '#111827' : '#6b7280', boxShadow: pestanaActiva === 'seguridad' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none' }}>🔒 PINES</button>
                        <button onClick={() => setPestanaActiva('historial_ventas')} style={{ flex: 1, padding: '8px 4px', border: 'none', fontSize: '0.7rem', fontWeight: 'bold', borderRadius: '6px', cursor: 'pointer', backgroundColor: pestanaActiva === 'historial_ventas' ? 'white' : 'transparent', color: pestanaActiva === 'historial_ventas' ? '#111827' : '#6b7280', boxShadow: pestanaActiva === 'historial_ventas' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none' }}>📊 HISTORIAL VENTAS</button>
                    </div>
                </div>

                <div style={{ padding: '24px' }}> 
                    {/* 💻 PESTAÑA 1: LLAMADO A HARDWARE EXTERNO */}
                    {pestanaActiva === 'estacion' && (
                        <VistaEstacion 
                            nombreEstacion={nombreEstacion} setNombreEstacion={setNombreEstacion}
                            categorias={categorias} toggleCategoria={toggleCategoria}
                            categoriasSeleccionadas={categoriasSeleccionadas} guardarEstacion={guardarEstacion}
                            impresoraNombreInicial={impresoraNombre}
                            anchoPapelInicial={anchoPapel} // 👈 Pasamos el ancho de papel cargado
                            guardando={guardando} onClose={onClose}
                        />
                    )}

                    {/* 📁 PESTAÑA 2: LLAMADO A CATEGORÍAS EXTERNAS */}
                    {pestanaActiva === 'categorias' && (
                        <VistaCategorias 
                            editandoCatId={editandoCatId} nuevaCatTitulo={nuevaCatTitulo} setNuevaCatTitulo={setNuevaCatTitulo}
                            nuevaCatSeImprime={nuevaCatSeImprime} setNuevaCatSeImprime={setNuevaCatSeImprime}
                            setEditandoCatId={setEditandoCatId} handleCrearCategoria={handleCrearCategoria}
                            listaCategoriasCompletas={listaCategoriasCompletas} activarEdicion={activarEdicion}
                            handleEliminarCategoria={handleEliminarCategoria} guardando={guardando}
                        />
                    )}

                    {/* 📦 PESTAÑA 3: LLAMADO A INVENTARIO EXTERNO */}
                    {pestanaActiva === 'inventario' && (
                        <VistaInventario 
                            handleGuardarInventario={handleGuardarInventario} idItemEditando={idItemEditando}
                            cancelarEdicion={cancelarEdicion} invNombre={invNombre} setInvNombre={setInvNombre}
                            invStockActual={invStockActual} setInvStockActual={setInvStockActual}
                            invStockMinimo={invStockMinimo} setInvStockMinimo={setInvStockMinimo}
                            invBarcode={invBarcode} setInvBarcode={setInvBarcode}
                            invCodigoBalanza={invCodigoBalanza} setInvCodigoBalanza={setInvCodigoBalanza}
                            guardando={guardando} busquedaInv={busquedaInv} setBusquedaInv={setBusquedaInv}
                            inventarioFiltrado={inventarioFiltrado} seleccionarParaEditar={seleccionarParaEditar}
                            handleBorrarInventario={handleBorrarInventario}
                        />
                    )}

                    {/* 🍔 PESTAÑA 4: AGREGAR NUEVO PRODUCTO (Se queda aquí por ahora) */}
                      {pestanaActiva === 'productos' && (
    <VistaProductos 
        nuevoPlato={nuevoPlato} setNuevoPlato={setNuevoPlato}
        categorias={listaCategoriasCompletas} handleCrearProducto={handleCrearProducto}
        guardando={guardando} setPestanaActiva={setPestanaActiva}
        listaProductosCompletas={listaProductosCompletas} 
        busquedaProd={busquedaProd} setBusquedaProd={setBusquedaProd}
        listaInventario={listaInventario}
        activarEdicionProducto={activarEdicionProducto}
        editandoProductoId={editandoProductoId} cancelarEdicionProducto={cancelarEdicionProducto}
        subirImagenASupabase={subirImagenASupabase}
        handleBorrarProducto={handleBorrarProducto}
        tenantId={tenantId}
    />
)}
                    {/* 💸 PESTAÑA 5: MÓDULO DE GASTOS (AGREGA ESTE BLOQUE EXACTAMENTE AQUÍ) */}
                    {pestanaActiva === 'gastos' && (
                        <VistaGastos 
                            handleGuardarGasto={handleGuardarGasto}
                            editandoGastoId={editandoGastoId}
                            cancelarEdicionGasto={cancelarEdicionGasto}
                            gastoDescripcion={gastoDescripcion}
                            setGastoDescripcion={setGastoDescripcion}
                            gastoMonto={gastoMonto}
                            setGastoMonto={setGastoMonto}
                            guardando={guardando}
                            busquedaGasto={busquedaGasto}
                            setBusquedaGasto={setBusquedaGasto}
                            gastosFiltrados={gastosFiltrados}
                            seleccionarGastoParaEditar={seleccionarGastoParaEditar}
                            handleBorrarGasto={handleBorrarGasto}
                        />
                    )}
                    {/* 👥 PESTAÑA 6: MÓDULO DE VENDEDORES */}
                    {pestanaActiva === 'meseros' && (
                        <VistaMeseros 
                            handleGuardarMesero={handleGuardarMesero} editandoMeseroId={editandoMeseroId}
                            cancelarEdicionMesero={cancelarEdicionMesero} meseroNombre={meseroNombre}
                            setMeseroNombre={setMeseroNombre} meseroActivo={meseroActivo}     // 🚀 PASAMOS EL ESTADO
                            setMeseroActivo={setMeseroActivo} guardando={guardando}
                            busquedaMesero={busquedaMesero} setBusquedaMesero={setBusquedaMesero}
                            meserosFiltrados={meserosFiltrados} seleccionarMeseroParaEditar={seleccionarMeseroParaEditar}
                            handleBorrarMesero={handleBorrarMesero}
                        />
                    )}
                    {pestanaActiva === 'seguridad' && (
                        <VistaSeguridad 
                            pinCajero={pinCajero}
                            setPinCajero={setPinCajero}
                            pinAdmin={pinAdmin}
                            setPinAdmin={setPinAdmin}
                            handleGuardarSeguridad={handleGuardarSeguridad}
                            guardando={guardando}
                            itemIdSeguridad={itemIdSeguridad}
                        />
                    )}
                    {pestanaActiva === 'historial_ventas' && (
                        <VistaVentas tenantId={tenantId} />
                    )}
                </div>
            </div>
        </div>
    );
}