'use client';
import React, { useState, useEffect } from 'react';
import { Monitor, PlusCircle } from 'lucide-react';
import { client, sanityClientServer } from '@/lib/sanity';
import { getStationFingerprint } from '@/lib/utils';

// 🛡️ ENLACES MÓDULOS DESCUARTIZADOS EN JS NATIVO
import VistaEstacion from './pestanas/VistaEstacion';
import VistaCategorias from './pestanas/VistaCategorias';
import VistaInventario from './pestanas/VistaInventario';
import VistaProductos from './pestanas/VistaProductos';
import VistaGastos from './pestanas/VistaGastos';
import VistaMeseros from './pestanas/VistaMeseros';
import VistaSeguridad from './pestanas/VistaSeguridad';

export default function ConfigImpresionModal({ isOpen, onClose, categorias, tenantId }) {
    // --- 1. CONTROL DE NAVEGACIÓN (Pestañas) ---
    const [pestanaActiva, setPestanaActiva] = useState('estacion'); 
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
        categoria: '',
        controlaInventario: false,
        disponible: true,
        barcode: '',
        codigoBalanza: '',
        imagen: null
    });

    // --- 5. ESTADOS PESTAÑA 4: INVENTARIO / STOCK ---
    const [listaInventario, setListaInventario] = useState([]);
    const [busquedaInv, setBusquedaInv] = useState('');
    const [cargandoInv, setCargandoInv] = useState(false);
    const [idItemEditando, setIdItemEditando] = useState(null);

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
            const res = await fetch(`/api/inventario/list?tenantId=${tenantId}`);
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
            // Usamos "categoria->titulo" para traer el nombre real de la referencia de forma síncrona
            const query = `*[_type == "plato" && tenant == $tenantId] | order(nombre asc) { 
                _id, 
                nombre, 
                precio, 
                categoria, 
                "categoriaLabel": categoria->titulo, 
                disponible, 
                barcode, 
                codigoBalanza,
                controlaInventario
            }`;
            const data = await client.fetch(query, { tenantId }, { useCdn: false });
            setListaProductosCompletas(data || []);
        } catch (e) {
            console.error("🔥 Error descargando catálogo de productos:", e);
        }
    };

    useEffect(() => {
        if (pestanaActiva === 'inventario'|| pestanaActiva === 'productos') {
            cargarInventarioAdmin();
            cargarProductosNegocio();
        }
        if (pestanaActiva === 'productos') {
            cargarProductosNegocio();
        }
        if (pestanaActiva === 'gastos') { // 👈 AGREGA ESTE CONDICIONAL
            cargarGastosNegocio();
        }
        if (pestanaActiva === 'meseros') { // 👈 AGREGAR ESTA CONDICIÓN
            cargarMeserosNegocio();
        }
        if (pestanaActiva === 'seguridad') { 
            cargarSeguridadNegocio();
        }
    }, [pestanaActiva, tenantId]);
    useEffect(() => {
        if (isOpen && typeof window !== 'undefined') {
            const idUnico = getStationFingerprint(); 
            setFingerprint(idUnico);
            console.log("🆔 ID Generado y Guardado en LocalStorage:", idUnico);
            cargarConfiguracion(idUnico);
            cargarCategoriasNegocio();
            cargarInventarioAdmin();
        }
    }, [isOpen]);

    const cargarConfiguracion = async (id) => {
        if (!tenantId) return; 
        const query = `*[_type == "estacionPC" && pcFingerprint == $id && tenant == $tenantId][0]`;
        const data = await client.fetch(query, { id, tenantId }, { useCdn: false });
        if (data) {
            setNombreEstacion(data.nombre);
            setCategoriasSeleccionadas(data.categoriasVinculadas || []);
        } else {
            setNombreEstacion('');
            setCategoriasSeleccionadas([]);
        }
    };

    const cargarCategoriasNegocio = async () => {
        if (!tenantId) return;
        try {
            const query = `*[_type == "categoria" && tenant == $tenantId] | order(titulo asc) { _id, titulo, seImprime }`;
            const data = await client.fetch(query, { tenantId }, { useCdn: false });
            setListaCategoriasCompletas(data || []);
        } catch (e) {
            console.error("🔥 Error descargando categorías de Sanity:", e);
        }
    };

    const toggleCategoria = (cat) => {
        setCategoriasSeleccionadas(prev => 
            prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
        );
    };

    const guardarEstacion = async () => {
        if (!nombreEstacion.trim()) {
            alert("⚠️ Por favor, asigna un nombre a esta estación antes de guardar.");
            return;
        }
        setGuardando(true);
        try {
            const res = await fetch('/api/estaciones/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fingerprint: fingerprint,
                    nombre: nombreEstacion || 'Caja Nueva',
                    categorias: categoriasSeleccionadas,
                    tenantId: tenantId
                })
            });
            const data = await res.json();
            if (data.success) {
                alert('✅ Estación Guardada en la Nube');
                onClose();
            } else { 
                throw new Error(data.error || 'Error desconocido'); 
            }
        } catch (error) {
            console.error("🔥 Error al guardar estación:", error);
            alert('❌ Error al guardar: Revisa la consola del servidor');
        } finally { setGuardando(false); }
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
            } else { alert(`❌ Error: ${data.error}`); }
        } catch (e) {
            alert('❌ Error al intentar eliminar.');
        } finally { setGuardando(false); }
    };

    const activarEdicion = (cat) => {
        setNuevaCatTitulo(cat.titulo);
        setNuevaCatSeImprime(cat.seImprime ?? true);
        setEditandoCatId(cat._id);
    };

    const handleGuardarInventario = async (e) => {
        e.preventDefault();
        if (!invNombre.trim()) return alert("⚠️ El nombre del insumo es obligatorio.");
        setGuardando(true);
        try {
            const metodo = idItemEditando ? 'PUT' : 'POST';
            const body = {
                nombre: invNombre.trim(),
                stockActual: Number(invStockActual) || 0,
                stockMinimo: Number(invStockMinimo) || 0,
                barcode: invBarcode.trim() || null,
                codigoBalanza: invCodigoBalanza.trim() || null,
                tenantId,
                ...(idItemEditando && { itemId: idItemEditando })
            };

            const res = await fetch('/api/admin/inventario', {
                method: metodo,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const data = await res.json();
            if (data.ok) {
                alert(idItemEditando ? '🔄 ¡Insumo actualizado en Sanity!' : '🚀 ¡Materia prima creada con éxito!');
                cancelarEdicion();
                await cargarInventarioAdmin();
            } else { alert(`❌ Error: ${data.error}`); }
        } catch (error) {
            alert('❌ Error al procesar inventario.');
        } finally { setGuardando(false); }
    };

    const seleccionarParaEditar = (item) => {
        setIdItemEditando(item._id);
        setInvNombre(item.nombre);
        setInvStockActual(item.stockActual);
        setInvStockMinimo(item.stockMinimo || 5);
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
            if (res.ok) {
                if (idItemEditando === itemId) cancelarEdicion();
                await cargarInventarioAdmin();
            } else { alert("❌ No se pudo eliminar."); }
        } catch (error) { console.error(error); }
        finally { setGuardando(false); }
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
                disponible: nuevoPlato.disponible,
                controlaInventario: nuevoPlato.controlaInventario,
                barcode: nuevoPlato.barcode ? nuevoPlato.barcode.trim() : null,
                codigoBalanza: nuevoPlato.codigoBalanza ? nuevoPlato.codigoBalanza.trim() : null,
                categoria: nuevoPlato.categoria, // ID plano, la API hace el reference
                tenantId,
                imagen: nuevoPlato.imagen,
                // Si controla inventario, enviamos el ID del insumo vinculado
                insumoId: nuevoPlato.controlaInventario ? nuevoPlato.insumoVinculado : null,
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
    const activarEdicionProducto = (prod) => {
        setEditandoProductoId(prod._id);
        setNuevoPlato({
            nombre: prod.nombre,
            precio: prod.precio,
            // Si viene el objeto de Sanity sacamos el _ref, de lo contrario el valor directo
            categoria: prod.categoria?._ref || prod.categoria || '',
            controlaInventario: prod.controlaInventario || false,
            disponible: prod.disponible !== false,
            barcode: prod.barcode || '',
            codigoBalanza: prod.codigoBalanza || '',
            imagen: prod.imagen || null
        });
    };

    const cancelarEdicionProducto = () => {
        setEditandoProductoId(null);
        setNuevoPlato({
            nombre: '',
            precio: '',
            categoria: '',
            controlaInventario: false,
            disponible: true,
            barcode: '',
            codigoBalanza: '',
            imagen: null
        });
    };
    const cargarGastosNegocio = async () => {
        if (!tenantId) return;
        try {
            const query = `*[_type == "gasto" && tenant == $tenantId] | order(fecha desc) { 
                _id, 
                descripcion, 
                monto, 
                fecha
            }`;
            const data = await client.fetch(query, { tenantId }, { useCdn: false });
            setListaGastosCompletas(data || []);
        } catch (e) {
            console.error("🔥 Error descargando gastos de Sanity:", e);
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
        setEditandoGastoId(item._id);
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
   const subirImagenASanity = async (file) => {
        if (!file) return null;
        try {
            // Empaquetamos el archivo binario
            const formData = new FormData();
            formData.append('file', file);

            // Llamamos a tu nuevo endpoint local en el servidor
            const res = await fetch('/api/admin/productos/upload', {
                method: 'POST',
                body: formData,
            });
            
            const data = await res.json();
            
            if (data.ok) {
                // Retorna la referencia estructurada que espera Sanity
                return data.asset; 
            } else {
                throw new Error(data.error || 'Error en el servidor de carga');
            }
        } catch (err) {
            console.error("🔥 Error subiendo imagen mediante API puente:", err);
            return null;
        }
    };
    const cargarMeserosNegocio = async () => {
        if (!tenantId) return;
        try {
            const query = `*[_type == "mesero" && tenant == $tenantId] | order(nombre asc) { _id, nombre }`;
            const data = await client.fetch(query, { tenantId }, { useCdn: false });
            setListaMeserosCompletas(data || []);
        } catch (e) { console.error("🔥 Error cargando vendedores:", e); }
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

    // 🚀 OPERACIONES CRUD VENDEDORES
    const handleGuardarMesero = async (e) => {
        e.preventDefault();
        if (!meseroNombre.trim()) return alert("⚠️ El nombre es obligatorio.");
        setGuardando(true);
        try {
            const metodo = editandoMeseroId ? 'PUT' : 'POST';
            const res = await fetch('/api/admin/meseros', {
                method: metodo,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    nombre: meseroNombre.trim(), 
                    tenantId, 
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
 
    const seleccionarMeseroParaEditar = (item) => {
        setEditandoMeseroId(item._id);
        setMeseroNombre(item.nombre);
    };

    const cancelarEdicionMesero = () => {
        setEditandoMeseroId(null);
        setMeseroNombre('');
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
            <div style={{ backgroundColor: 'white', borderRadius: '16px', width: '100%', maxWidth: '650px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)', overflow: 'hidden', border: '1px solid #e5e7eb', fontFamily: 'sans-serif' }}>
                
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
                        <button onClick={() => setPestanaActiva('meseros')} style={{ flex: 1, padding: '8px 4px', border: 'none', fontSize: '0.7rem', fontWeight: 'bold', borderRadius: '6px', cursor: 'pointer', backgroundColor: pestanaActiva === 'meseros' ? 'white' : 'transparent', color: pestanaActiva === 'meseros' ? '#111827' : '#6b7280', boxShadow: pestanaActiva === 'meseros' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none' }}>👥 MESEROS</button>
                        <button onClick={() => setPestanaActiva('seguridad')} style={{ flex: 1, padding: '8px 4px', border: 'none', fontSize: '0.7rem', fontWeight: 'bold', borderRadius: '6px', cursor: 'pointer', backgroundColor: pestanaActiva === 'seguridad' ? 'white' : 'transparent', color: pestanaActiva === 'seguridad' ? '#111827' : '#6b7280', boxShadow: pestanaActiva === 'seguridad' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none' }}>🔒 PINES</button>
                    </div>
                </div>

                <div style={{ padding: '24px' }}> 
                    {/* 💻 PESTAÑA 1: LLAMADO A HARDWARE EXTERNO */}
                    {pestanaActiva === 'estacion' && (
                        <VistaEstacion 
                            nombreEstacion={nombreEstacion} setNombreEstacion={setNombreEstacion}
                            categorias={categorias} toggleCategoria={toggleCategoria}
                            categoriasSeleccionadas={categoriasSeleccionadas} guardarEstacion={guardarEstacion}
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
                        busquedaProd={busquedaProd} setBusquedaProd={setBusquedaProd}// 👈 Agrega estas
                        listaInventario={listaInventario} // 👈 Agrega esta
                        activarEdicionProducto={activarEdicionProducto}
                        editandoProductoId={editandoProductoId} cancelarEdicionProducto={cancelarEdicionProducto}
                       subirImagenASanity={subirImagenASanity}
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
                            setMeseroNombre={setMeseroNombre} guardando={guardando}
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
                </div>
            </div>
        </div>
    );
}