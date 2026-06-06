'use client';

import React, { useState, useEffect, useMemo } from 'react';
// 🛡️ ADAPTADOR: Gestiona si cargamos datos de Sanity o de DEMO_DATA
import { getProductos, getMeseros } from '@/lib/dataAdapter';
import { ENV, DEMO_DATA } from '@/lib/env';

import { useCart } from '@/app/context/CartContext'; 
import { useOrdenes } from '@/hooks/useOrdenes';
import { useReportes } from '@/hooks/useReportes';
import { useImpresion } from '@/hooks/useImpresion';
import { useAccesos } from '@/hooks/useAccesos';
import { useOrdenHandlers } from '@/hooks/useOrdenHandlers';
import { useGastos } from '@/hooks/useGastos';
import { useWindowsPrint } from '@/hooks/useWindowsPrint';
import { cleanPrice, getFechaBogota } from '@/lib/utils';
import { client } from '@/lib/sanity';

import { SITE_CONFIG as RESTAURANTE_CONFIG, CURRENT_TENANT } from '@/lib/config';
import { PrintTemplates } from '@/components/pos/PrintTemplates';
import ReporteModal from '@/components/modals/ReporteModal';
import AdminModal from '@/components/modals/AdminModal';
import ListaOrdenesModal from '@/components/modals/ListaOrdenesModal';
import TicketPanel from '@/components/pos/TicketPanel';
import ProductGrid from '@/components/pos/ProductGrid';
import styles from './MenuPanel.module.css';
import HistorialVentasModal from '@/components/modals/HistorialVentasModal';
import InventarioModal from '@/components/modals/InventarioModal';
import ModalClientesDomicilios from '@/components/modals/ModalClientesDomicilios';
import ConfigImpresionModal from '@/components/modals/ConfigImpresionModal/ConfigImpresionModal';
import ModalPesaje from '@/components/modals/ModalPesaje'; // Asegúrate de que la ruta sea correcta
import { useInventario } from '@/hooks/useInventario';


export default function MenuPanel({ configNegocio: configInyectada }) {
    // --- 1. ESTADOS DE IDENTIDAD Y CONFIGURACIÓN (Cimientos) ---
    const [tenantId, setTenantId] = useState(CURRENT_TENANT);
    const [configNegocio, setConfigNegocio] = useState(configInyectada);
    const [platos, setPlatos] = useState([]);
    const [categoriaActiva, setCategoriaActiva] = useState('todos');
    const [cargando, setCargando] = useState(true);
    const [mostrarListaOrdenes, setMostrarListaOrdenes] = useState(false);
    const [nombreMesero, setNombreMesero] = useState(null);
    const [mostrarCategoriasMobile, setMostrarCategoriasMobile] = useState(false);
    const [mostrarCarritoMobile, setMostrarCarritoMobile] = useState(false);
    const [listaMeseros, setListaMeseros] = useState([]);
    const [estaActivo, setEstaActivo] = useState(null);
    const [pinBloqueo, setPinBloqueo] = useState('');
    const [errorPin, setErrorPin] = useState(false);
    const [busqueda, setBusqueda] = useState(''); // 🔍 Nuevo estado para el buscador
    const [mostrarModalHistorial, setMostrarModalHistorial] = useState(false);
    const [mostrarInventario, setMostrarInventario] = useState(false);
    const [idClienteEditando, setIdClienteEditando] = useState(null);
    const [cliNombre, setCliNombre] = useState('');
    const [cliTelefono, setCliTelefono] = useState('');
    const [cliDireccion, setCliDireccion] = useState('');
    const [guardandoCliente, setGuardandoCliente] = useState(false);
    const [busquedaCli, setBusquedaCli] = useState('');
    const [clientesLista, setClientesLista] = useState([]);
    const [mostrarModalClientes, setMostrarModalClientes] = useState(false);
    const [mostrarConfigImpresion, setMostrarConfigImpresion] = useState(false);
    const [platosParaImprimir, setPlatosParaImprimir] = useState(null);
    const [modalPesajeOpen, setModalPesajeOpen] = useState(false);
    const [platoAPesar, setPlatoAPesar] = useState(null);

    // --- 2. CONTEXTOS ---
    const { 
        items: cart, total, addProduct: agregarAlCarrito, decrease: quitarDelCarrito, 
        metodoPago, setMetodoPago, setCartFromOrden, clear: clearCart, clearWithStockReturn, 
        eliminarLineaConStock, actualizarComentario, propina, setPropina, montoManual, setMontoManual,
        ordenActivaId, setOrdenActivaId, ordenMesa, setOrdenMesa, tipoOrden
    } = useCart();

    // --- 3. HOOKS DE LÓGICA (Que dependen de los estados de arriba) ---
    const { 
        ordenes: ordenesActivas, guardarOrden: apiGuardar, 
        eliminarOrden: apiEliminar, refresh: refreshOrdenes 
    } = useOrdenes(tenantId);

    const imp = useImpresion(cart, configNegocio, ordenMesa, nombreMesero, tenantId);

    const rep = useReportes(getFechaBogota, tenantId);
    const gst = useGastos(tenantId);

    const acc = useAccesos(RESTAURANTE_CONFIG, setNombreMesero, {
        // ✅ Mantenemos tu lógica original de éxito administrativo
        onAdminSuccess: (pin) => { 
            rep.setMostrarAdmin(true); 
            setTimeout(() => {
                rep.cargarReporteAdmin(pin);
            }, 100);
        }
    }, tenantId); // 👈 El tenantId entra como cuarto parámetro limpio

    const ord = useOrdenHandlers({
        cart, total, clearCart, clearWithStockReturn, setCartFromOrden, eliminarLineaConStock, apiGuardar, apiEliminar, 
        refreshOrdenes, ordenActivaId, setOrdenMesa, ordenMesa,
        setOrdenActivaId, ordenesActivas, esModoCajero: acc.esModoCajero, 
        setMostrarCarritoMobile, nombreMesero, setNombreMesero, tipoOrden, validarPinAdmin: acc.validarPinAdmin, tenantId, config: configNegocio
    });
    // Carga inicial del directorio al abrir el modal
    useEffect(() => {
        if (mostrarModalClientes && tenantId) {
            fetch(`/api/clientes?tenant=${tenantId}`)
                .then(res => res.json())
                .then(data => setClientesLista(data || []))
                .catch(err => console.error("Error en directorio:", err));
        }
    }, [mostrarModalClientes, tenantId]);

    const seleccionarParaEditar = (c) => {
        setIdClienteEditando(c._id); setCliNombre(c.nombre); setCliTelefono(c.telefono); setCliDireccion(c.direccion);
    };

    const cancelarEdicion = () => {
        setIdClienteEditando(null); setCliNombre(''); setCliTelefono(''); setCliDireccion('');
    };

    const clientesFiltrados = useMemo(() => {
        const query = busquedaCli.toLowerCase().trim();
        if (!query) return clientesLista;
        return clientesLista.filter(c => (c.nombre || "").toLowerCase().includes(query) || (c.telefono || "").includes(query));
    }, [busquedaCli, clientesLista]);

// --- 4. EFECTOS Y WATCHERS ---
    // 🚀 SINCRO MULTITENANT: Escucha los cambios vivos que vienen de Sanity a través del Wrapper
    useEffect(() => {
        if (configInyectada) {
            setConfigNegocio(configInyectada);
        }
    }, [configInyectada]);

    // 🚀 AJUSTE SENIOR EN MENU PANEL
    useWindowsPrint(
        ordenesActivas, 
        (platosNuevos) => {
            setPlatosParaImprimir(platosNuevos); // 1. Buzón de impresión
            imp.imprimirCocina(platosNuevos);    // 2. Disparo físico
        }, 
        tenantId // 👈 BISTURÍ: Inyectamos la identidad del cliente
    );

    useEffect(() => {
        const verificarSeguridadMesero = async () => {
            const vendedorPersistido = localStorage.getItem('ultimoMesero');
            
            // CASO 1: Si no hay mesero seleccionado aún, el POS entra libre (Modo mostrador/caja inicial)
            if (!vendedorPersistido) {
                setEstaActivo(true);
                return;
            }

            setNombreMesero(vendedorPersistido);

            // CASO 2: Hay un mesero en disco. Le preguntamos a Sanity si el jefe lo tiene activo
            try {
                // Buscamos por el string del nombre exacto que tienes mapeado
                const query = `*[_type == "mesero" && nombre == $nombre && tenant == $tenantId][0]{ activo }`;
                const resultado = await client.fetch(query, { nombre: vendedorPersistido, tenantId }, { useCdn: false });
                
                // Si el campo 'activo' viene explícitamente en false, se bloquea. Si no viene o está en true, pasa.
                if (resultado && resultado.activo === false) {
                    setEstaActivo(false);
                } else {
                    setEstaActivo(true);
                }
            } catch (e) {
                console.error("Lag de red: Acceso permitido por caché síncrona.");
                setEstaActivo(true); // Escudo de redundancia: si no hay internet, no paramos la venta
            }
        };

        verificarSeguridadMesero();
    }, []);

    const datosAgrupados = React.useMemo(() => {
        if (!cart?.length)return { cliente: [], cocina: [] };
        return {
            cliente: imp.agruparParaCliente(),
            cocina: imp.agruparParaCocina()
        };
    }, [cart]);

    // --- 5. FUNCIONES DE CARGA Y REIMPRESIÓN ---
    const handleReimprimirVenta = async (venta) => {
        try {
            const res = await fetch('/api/ventas/reimprimir', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ venta, tenantId: tenantId })
            });
            if (res.ok) alert("✅ Ticket enviado a la impresora");
            else alert("❌ Error al generar reimpresión");
        } catch (error) {
            console.error(error);
            alert("❌ Error de conexión");
        }
    };

    const cargarMenuYMeseros = async () => {
        if (!tenantId) return; 
        setCargando(true);
        try {
            if (ENV.mode === "template") {
                setPlatos(Object.freeze(DEMO_DATA.platos));
                setListaMeseros(Object.freeze(DEMO_DATA.meseros));
                return;
            }
            const [platosData, meserosData] = await Promise.all([
                getProductos(tenantId),
                getMeseros(tenantId)
            ]);
            setPlatos(platosData || []);
            setListaMeseros(meserosData || []);
        } catch (error) { 
            console.error("🔥 Error Crítico Load MenuPanel:", error); 
        } finally {
            setCargando(false);
        }
    };

    // --- 6. EFECTOS DE SINCRONIZACIÓN ---
   // --- 6. EFECTOS DE SINCRONIZACIÓN (BLOQUE UNIFICADO SENIOR) ---

useEffect(() => {
    // 🛡️ Solo ejecutamos si tenemos identidad del comercio (Cierre perimetral seguro)
    if (!tenantId) return;

    // A. Carga inicial del Menú y Meseros al detectar el Tenant
    console.log("🚀 Identidad confirmada:", tenantId, "Cargando menú optimizado...");
    cargarMenuYMeseros();

}, [tenantId]); // 🎯 BISTURÍ: Quitamos ordenActivaId para romper el bucle de re-renderizado 

    // --- 7. LÓGICA DE ESCÁNER Y BÚSQUEDA ---
    useEffect(() => {
        let buffer = "";
        let lastTime = Date.now();

        const procesarCodigo = (codigoRecibido) => {
            const codigoLimpio = codigoRecibido.trim();
            if(!codigoLimpio || codigoLimpio.length < 4) return false;
            const match = platos.find(p => 
                String(p.barcode) === codigoLimpio || 
                String(p.codigoBalanza) === codigoLimpio
            );
            if (match) {
                if (match.codigoBalanza && !match.barcode) {
                    setPlatoAPesar(match);
                    setModalPesajeOpen(true);
                } else {
                    agregarAlCarrito(match);
                }
                setBusqueda(""); 
                return true;
            }
            return false;
        };

        const handleKeyDown = (e) => {
            if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;
            const now = Date.now();
            if (now - lastTime > 100) buffer = "";
            lastTime = now;
            if (e.key === 'Enter') {
                if (buffer.length > 3) {
                    e.preventDefault();
                    procesarCodigo(buffer);
                }
                buffer = "";
                return;
            }
            if (e.key.length === 1) buffer += e.key;
        };

        const handlePaste = (e) => {
            const data = (e.clipboardData || window.clipboardData).getData('text');
            if (data && data.length > 3) procesarCodigo(data);
        };

        window.addEventListener('keydown', handleKeyDown, { capture: true });
        window.addEventListener('paste', handlePaste, { capture: true });
        return () => {
            window.removeEventListener('keydown', handleKeyDown, { capture: true });
            window.removeEventListener('paste', handlePaste, { capture: true });
        };
    }, [platos, agregarAlCarrito]);

    const platosFiltradosFinal = useMemo(() => {
        return platos.filter(p => {
            const nombre = p.nombrePlato || p.nombre || "";
            const barcode = p.barcode || "";
            const plu = p.codigoBalanza || "";
            const cumpleBusqueda = nombre.toLowerCase().includes(busqueda.toLowerCase()) || 
                                   barcode.toLowerCase().includes(busqueda.toLowerCase()) ||
                                   plu.toLowerCase().includes(busqueda.toLowerCase());
            const cumpleCategoria = categoriaActiva === 'todos' || p.categoria === categoriaActiva;
            return cumpleBusqueda && cumpleCategoria;
        });
    }, [platos, busqueda, categoriaActiva]);

    const manejarLimpiezaTotal = () => {
        if (ord.mensajeExito) return;
        if (!ord.ordenActivaId) clearWithStockReturn(); 
        else clearCart(); 
        ord.setOrdenActivaId(null);
        ord.setOrdenMesa(null);
    };

const categoriasParaConfig = useMemo(() => [...new Set(platos.map(p => p.categoria))], [platos]);
if (!tenantId) return <div style={{background: '#111827', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '900'}}>IDENTIFICANDO COMERCIO...</div>;   

// 🛡️ CONTROL EXPLÍCITO: Si está en null, congelamos pantalla para evitar parpadeos visuales
if (estaActivo === null) {
    return <div style={{background: '#090d16', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontFamily: 'sans-serif'}}>COMPROBANDO PERMISOS...</div>;
}
const handleBorrarCliente = async (id) => {
    if (!confirm("¿Eliminar del directorio?")) return;
    try {
        const res = await fetch('/api/clientes/delete', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                id,
                tenant: tenantId
            })
        });
        const data = await res.json();
        if (res.ok) {
            setClientesLista(prev =>
    prev.filter(c => c._id !== id && c.id !== id) // 🛡️ Soporta el ID de Supabase y Sanity sin romper la lista visual
);
            return;
        }
        alert(data.error || 'No fue posible eliminar el cliente.');
    } catch (error) {
        console.error('🔥 Error eliminando cliente:', error);
        alert('❌ Error de conexión con el servidor.');
    }
};

    const ejecutarGuardarCliente = async (e) => {
        e.preventDefault(); 
        const tenantSeguro = tenantId || CURRENT_TENANT;
        if (!cliNombre.trim() || !cliTelefono.trim() || !cliDireccion.trim() || !tenantSeguro) {
            alert("⚠️ Todos los campos son obligatorios.");
            return;
        }
        setGuardandoCliente(true);
        try {
            const payload = { nombre: cliNombre.toUpperCase().trim(), telefono: cliTelefono.trim(), direccion: cliDireccion.toUpperCase().trim(), tenant: tenantSeguro };
            if (idClienteEditando) payload.id = idClienteEditando;
            const res = await fetch('/api/clientes/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (!res.ok) throw new Error("Error en servidor");
            const data = await res.json();
           const clienteID = data._id || data.id; // Captura el identificador devuelto de forma segura
            setClientesLista(prev => idClienteEditando ? prev.map(c => (c._id === idClienteEditando || c.id === idClienteEditando) ? data : c) : [data, ...prev]);
            cancelarEdicion();
        } catch (error) { console.error(error); alert("🚫 Error al guardar."); } finally { setGuardandoCliente(false); }
    };
if (!estaActivo) {
        const manejarDigito = (num) => {
            if (pinBloqueo.length < 4) {
                setErrorPin(false);
                setPinBloqueo(prev => prev + num);
            }
        };

        const borrarDigito = () => {
            setPinBloqueo(prev => prev.slice(0, -1));
        };

        const verificarPinMaestro = async () => {
            try {
                // 📡 GATILLO QUIRÚRGICO: Comparamos contra el rol 'cajero' que sí muta y valida la sesión real
                const res = await fetch('/api/auth/verify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ pin: pinBloqueo, tipo: 'cajero', tenantId: tenantId })
                });
                
                const data = await res.json();

                if (res.ok && data.success) {
                    // 💵 ÉXITO OPERATIVO: El cajero/jefe toma el control de la terminal
                    localStorage.setItem('ultimoMesero', 'Caja');
                    setNombreMesero('Caja');
                    setPinBloqueo('');
                    setErrorPin(false);
                    setEstaActivo(true); // Desbloqueo y rendering inmediato del POS
                } else {
                    setErrorPin(true);
                    setPinBloqueo('');
                }
            } catch (error) {
                console.error("Error en pasarela de autenticación:", error);
                setErrorPin(true);
                setPinBloqueo('');
            }
        };
        
        return (
            <div style={{ position: 'fixed', inset: 0, backgroundColor: '#090d16', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 999999, color: 'white', fontFamily: 'sans-serif', padding: '20px' }}>
                
                <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                    <h1 style={{ fontSize: '2.3rem', fontWeight: '900', letterSpacing: '3px', color: '#10b981', margin: 0 }}>AMPLINUBE</h1>
                    <p style={{ fontSize: '0.75rem', color: '#475569', marginTop: '4px', textTransform: 'uppercase', fontWeight: 'bold' }}>Socio POS • Sistema Bloqueado</p>
                </div>

                <div style={{ backgroundColor: '#111827', padding: '25px', borderRadius: '24px', width: '100%', maxWidth: '340px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.8)', border: '1px solid #1f2937', textAlign: 'center' }}>
                    <span style={{ fontSize: '2.5rem' }}>🔒</span>
                    <h2 style={{ margin: '8px 0 4px 0', fontSize: '1.1rem', color: '#ef4444', fontWeight: '900' }}>ACCESO RESTRINGIDO</h2>
                    <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '0 0 15px 0', lineHeight: '1.4' }}>
                        La cuenta de <strong>"{nombreMesero?.toUpperCase()}"</strong> está inactiva. Ingrese PIN de Administrador para liberar la terminal:
                    </p>

                    {/* Esferas de seguridad estilo iPhone */}
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', marginBottom: '20px' }}>
                        {[0, 1, 2, 3].map((index) => (
                            <div 
                                key={index}
                                style={{
                                    width: '16px', height: '16px', borderRadius: '50%',
                                    border: '2px solid #475569',
                                    backgroundColor: pinBloqueo.length > index ? (errorPin ? '#ef4444' : '#10b981') : 'transparent',
                                    transition: '0.1s'
                                }}
                            />
                        ))}
                    </div>

                    {errorPin && <p style={{ color: '#f87171', fontSize: '0.8rem', fontWeight: 'bold', margin: '-10px 0 15px 0' }}>⚠️ PIN RECHAZADO</p>}

                    {/* Teclado Físico Táctil Puro */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', justifyContent: 'center' }}>
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                            <button 
                                key={num} type="button" onClick={() => manejarDigito(String(num))}
                                style={{ height: '55px', borderRadius: '50%', border: 'none', backgroundColor: '#1f2937', color: 'white', fontSize: '1.3rem', fontWeight: 'bold', cursor: 'pointer' }}
                            >
                                {num}
                            </button>
                        ))}
                        
                        <button 
                            type="button" onClick={borrarDigito}
                            style={{ height: '55px', borderRadius: '50%', border: 'none', backgroundColor: '#374151', color: '#94a3b8', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer' }}
                        >
                            ⌫
                        </button>

                        <button 
                            type="button" onClick={() => manejarDigito('0')}
                            style={{ height: '55px', borderRadius: '50%', border: 'none', backgroundColor: '#1f2937', color: 'white', fontSize: '1.3rem', fontWeight: 'bold', cursor: 'pointer' }}
                        >
                            0
                        </button>

                        <button 
                            type="button" onClick={verificarPinMaestro}
                            disabled={pinBloqueo.length < 4}
                            style={{ height: '55px', borderRadius: '50%', border: 'none', backgroundColor: pinBloqueo.length === 4 ? '#10b981' : '#374151', color: 'white', fontSize: '1rem', fontWeight: 'bold', cursor: pinBloqueo.length === 4 ? 'pointer' : 'not-allowed', transition: '0.2s' }}
                        >
                            OK ✔
                        </button>
                    </div>
                </div>
            </div>
        );
    }
return (
        <div className={styles.mainWrapper}>
            <div className={styles.posLayout}>
                <TicketPanel 
                    cart={cart} total={total} metodoPago={metodoPago} setMetodoPago={setMetodoPago}
                    quitarDelCarrito={quitarDelCarrito} agregarAlCarrito={agregarAlCarrito} guardarOrden={ord.guardarOrden} errorMesaOcupada={ord.errorMesaOcupada}
                    setErrorMesaOcupada={ord.setErrorMesaOcupada}cobrarOrden={ord.cobrarOrden}
                    generarCierreDia={rep.generarCierreDia} solicitarAccesoCajero={acc.solicitarAccesoCajero}
                    solicitarAccesoAdmin={acc.solicitarAccesoAdmin} registrarGasto={gst.registrarGasto}
                    refreshOrdenes={refreshOrdenes} setMostrarListaOrdenes={setMostrarListaOrdenes}
                    mostrarCarritoMobile={mostrarCarritoMobile} setMostrarCarritoMobile={setMostrarCarritoMobile}
                    ordenMesa={ord.ordenMesa} nombreMesero={ord.nombreMesero || nombreMesero} setNombreMesero={ord.setNombreMesero || setNombreMesero}
                    listaMeseros={listaMeseros} esModoCajero={acc.esModoCajero}
                    ordenActivaId={ord.ordenActivaId} numOrdenesActivas={ordenesActivas.length} 
                    cleanPrice={cleanPrice} styles={styles} cancelarOrden={ord.cancelarOrden} 
                   clearCart={manejarLimpiezaTotal} clearWithStockReturn={clearWithStockReturn} imprimirTicket={imp.imprimirTicket} mensajeExito={ord.mensajeExito}
                    actualizarComentario={actualizarComentario} imprimirComandaCocina={() => {
                    setPlatosParaImprimir(null); // Limpiamos el buzón de Sanity para que NO use el filtro de adiciones
                    imp.imprimirCocina();       // Disparamos la función (usará el cart local por defecto)
                     }}
                    propina={propina} setPropina={setPropina} montoManual={montoManual} setMontoManual={setMontoManual}
                    setMostrarModalHistorial={setMostrarModalHistorial} setMostrarInventario={setMostrarInventario}
                    solicitarEliminacionAdmin={ord.solicitarEliminacionAdmin} eliminarLineaConStock={ord.eliminarLineaConStock} config={configNegocio}
                    tenantId={tenantId} setMostrarModalClientes={setMostrarModalClientes}
                />

                <ProductGrid 
                    platos={platos} 
                    platosFiltrados={platosFiltradosFinal} // ✅ Usamos la nueva lógica filtrada
                    busqueda={busqueda}                   // ✅ Pasamos el texto
                    setBusqueda={setBusqueda}
                    categoriaActiva={categoriaActiva} setCategoriaActiva={setCategoriaActiva}
                    mostrarCategoriasMobile={mostrarCategoriasMobile} setMostrarCategoriasMobile={setMostrarCategoriasMobile}
                    agregarAlCarrito={agregarAlCarrito} styles={styles}
                    setPlatoAPesar={setPlatoAPesar}     // 👈 NUEVA: Para pasar el plato seleccionado
                    setModalPesajeOpen={setModalPesajeOpen}
                    mostrarCarritoMobile={mostrarCarritoMobile} setMostrarCarritoMobile={setMostrarCarritoMobile}
                    cart={cart}   // 👈 AGREGA ESTA LÍNEA
                    total={total}
                    ordenesActivas={ordenesActivas} 
                    cargarOrden={ord.cargarOrden}
                    clearCart={manejarLimpiezaTotal}
                    mensajeExito={ord.mensajeExito}
                    setMostrarConfigImpresion={setMostrarConfigImpresion}
                    config={configNegocio}
                    tenantId={tenantId}
                />

                <PrintTemplates 
                    cart={cart} total={total} ordenMesa={ord.ordenMesa} 
                    nombreMesero={nombreMesero} config={configNegocio || RESTAURANTE_CONFIG} 
                    agrupadoCliente={datosAgrupados.cliente} agrupadoCocina={platosParaImprimir || datosAgrupados.cocina}
                    ordenActivaId={ord.ordenActivaId}
                    cleanPrice={cleanPrice}
                    propina={propina} montoManual={montoManual}
                />
            </div>

            <div className={styles.tablesFooter}>
                <div style={{ fontWeight: '900', color: 'white', marginRight: '15px', fontSize: '0.75rem' }}>ORDENES ACTIVAS:</div>
                {ordenesActivas.map((orden) => (
                    <button key={orden._id} className={`${styles.tableBtn} ${ord.ordenActivaId === orden._id ? styles.tableBtnActive : ''}`} onClick={() => ord.cargarOrden(orden._id)}>
                        {orden.mesa}
                    </button>
                ))}
            </div>

            <ListaOrdenesModal isOpen={mostrarListaOrdenes} onClose={() => setMostrarListaOrdenes(false)} ordenes={ordenesActivas} onCargar={(id) => { ord.cargarOrden(id).then(s => s && setMostrarListaOrdenes(false)) }} />
            <ReporteModal isOpen={rep.mostrarReporte} onClose={() => rep.setMostrarReporte(false)} cargando={rep.cargandoReporte} datos={rep.datosReporte} fechaInicio={rep.fechaInicioReporte} setFechaInicio={rep.setFechaInicioReporte} fechaFin={rep.fechaFinReporte} setFechaFin={rep.setFechaFinReporte}
             onGenerar={rep.generarCierreDia} listaGastos={rep.listaGastosDetallada} config={configNegocio}/>
            
            <AdminModal 
                isOpen={rep.mostrarAdmin} 
                onClose={() => rep.setMostrarAdmin(false)} 
                fechaInicio={rep.fechaInicioFiltro} 
                setFechaInicio={rep.setFechaInicioFiltro} 
                fechaFin={rep.fechaFinFiltro} 
                setFechaFin={rep.setFechaFinFiltro} 
                onGenerar={() => rep.cargarReporteAdmin()} 
                cargando={rep.cargandoAdmin} 
                reporte={rep.reporteAdmin}
                tenantId={tenantId}
            />
            <HistorialVentasModal 
             isOpen={mostrarModalHistorial} 
             onClose={() => setMostrarModalHistorial(false)} 
             onReimprimir={handleReimprimirVenta}
             tenantId={tenantId}
            />
            <InventarioModal 
            isOpen={mostrarInventario} 
            onClose={() => setMostrarInventario(false)} 
            tenantId={tenantId}
            />
            <ConfigImpresionModal 
             isOpen={mostrarConfigImpresion} 
             onClose={() => setMostrarConfigImpresion(false)}
             categorias={categoriasParaConfig}
             tenantId={tenantId}
            />
            {/* 🚨 BLOQUEO TOTAL DISUASIVO */}
            {ord.errorMesaOcupada && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
                    backgroundColor: '#dc2626', zIndex: 99999, display: 'flex',
                    flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
                    color: 'white', textAlign: 'center', padding: '20px'
                }}>
                    <span style={{ fontSize: '5rem' }}>⚠️</span>
                    <h1 style={{ fontSize: '3rem', fontWeight: '900' }}>MESA OCUPADA</h1>
                    <p style={{ fontSize: '1.5rem' }}>
                        La mesa <strong>{ord.errorMesaOcupada}</strong> ya tiene un pedido activo.
                    </p>
                    <button 
                        onClick={() => ord.setErrorMesaOcupada(null)}
                        style={{
                            marginTop: '25px', padding: '15px 40px', backgroundColor: 'white',
                            color: '#dc2626', border: 'none', borderRadius: '50px',
                            fontWeight: '900', fontSize: '1.2rem', cursor: 'pointer'
                        }}
                    >
                        Dale Guardar Nuevamente, Con otro Nombre
                    </button>
                </div>
            )}
            <ModalPesaje 
    isOpen={modalPesajeOpen}
    plato={platoAPesar}
    onClose={() => {
        setModalPesajeOpen(false);
        setPlatoAPesar(null);
    }}
    onConfirm={(plato, peso) => {
        agregarAlCarrito(plato, peso); // Aquí llamamos a tu CartContext blindado
        setModalPesajeOpen(false);
        setPlatoAPesar(null);
    }}
/>

{/* 🛵 DIRECTO AL DIRECTORIO MULTITENANT */}
            <ModalClientesDomicilios 
                isOpen={mostrarModalClientes}
                onClose={() => setMostrarModalClientes(false)}
                tenantId={tenantId}
                handleCargarALaOrden={(item) => {
                    if (typeof ord?.setClienteActivo === 'function') {
                        ord.setClienteActivo(item);
                    }
                }}
                idClienteEditando={idClienteEditando}
                cancelarEdicion={cancelarEdicion}
                cliNombre={cliNombre}
                setCliNombre={setCliNombre}
                cliTelefono={cliTelefono}
                setCliTelefono={setCliTelefono}
                cliDireccion={cliDireccion}
                setCliDireccion={setCliDireccion}
                guardando={guardandoCliente}
                busquedaCli={busquedaCli}
                setBusquedaCli={setBusquedaCli}
                clientesFiltrados={clientesFiltrados}
                seleccionarParaEditar={seleccionarParaEditar}
                handleBorrarCliente={handleBorrarCliente}
                handleGuardarCliente={ejecutarGuardarCliente}
            />
        </div>
    );
}