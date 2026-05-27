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
import ConfigImpresionModal from '@/components/modals/ConfigImpresionModal/ConfigImpresionModal';
import ModalPesaje from '@/components/modals/ModalPesaje'; // Asegúrate de que la ruta sea correcta
import { useInventario } from '@/hooks/useInventario';


export default function MenuPanel() {
    // --- 1. ESTADOS DE IDENTIDAD Y CONFIGURACIÓN (Cimientos) ---
    const [tenantId, setTenantId] = useState(CURRENT_TENANT);
    const [configNegocio, setConfigNegocio] = useState(null);
    const [platos, setPlatos] = useState([]);
    const [categoriaActiva, setCategoriaActiva] = useState('todos');
    const [cargando, setCargando] = useState(true);
    const [mostrarListaOrdenes, setMostrarListaOrdenes] = useState(false);
    const [nombreMesero, setNombreMesero] = useState(null);
    const [mostrarCategoriasMobile, setMostrarCategoriasMobile] = useState(false);
    const [mostrarCarritoMobile, setMostrarCarritoMobile] = useState(false);
    const [listaMeseros, setListaMeseros] = useState([]);
    const [busqueda, setBusqueda] = useState(''); // 🔍 Nuevo estado para el buscador
    const [mostrarModalHistorial, setMostrarModalHistorial] = useState(false);
    const [mostrarInventario, setMostrarInventario] = useState(false);
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

    // --- 4. EFECTOS Y WATCHERS ---
    // ✅ DESPUÉS (Bloque quirúrgico):
useEffect(() => {
    if (typeof window !== 'undefined') {
        console.log("🔒 MenuPanel conectado al Tenant Dinámico:", CURRENT_TENANT);
        setTenantId(CURRENT_TENANT);
        
        fetch(`/api/config/get?tenantId=${CURRENT_TENANT}`)
            .then(res => res.json())
            .then(data => setConfigNegocio(data))
            .catch(err => console.error("Error cargando config:", err));
    }
}, []);

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
        // Esto solo se ejecuta en el navegador (Client Side)
        const vendedorPersistido = localStorage.getItem('ultimoMesero');
        if (vendedorPersistido) {
            setNombreMesero(vendedorPersistido);
        }
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
    // 🛡️ Solo ejecutamos si tenemos identidad del comercio
    if (!tenantId) return;

    // A. Carga inicial del Menú y Meseros al detectar el Tenant
    console.log("🚀 Identidad confirmada:", tenantId, "Cargando menú...");
    cargarMenuYMeseros();

    // B. Definición del listener para cambios en tiempo real
    const manejarCambioInventario = async () => {
        console.log("🔄 Verificando stock e integridad de mesa...");
        
        // Usamos ordenActivaId directamente del Contexto (que es más estable)
        if (ordenActivaId) {
            try {
                const res = await fetch('/api/ordenes/get', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ordenId: ordenActivaId, tenantId: tenantId })
                });
                const data = await res.json();
                
                if (!data.exists) {
                    console.warn("🚫 Mesa cobrada por otro usuario. Limpiando pantalla...");
                    localStorage.removeItem('talanquera_cart');
                    clearCart(); 
                    ord.setOrdenActivaId(null);
                    ord.setOrdenMesa(null);
                }
            } catch (e) { 
                console.error("Error validando mesa:", e); 
            }
        }
        // Recargamos el menú para actualizar los stocks visuales
        cargarMenuYMeseros();
    };

    // C. Registro y Limpieza del Evento
    window.addEventListener('inventarioActualizado', manejarCambioInventario);
    return () => window.removeEventListener('inventarioActualizado', manejarCambioInventario);

}, [tenantId, ordenActivaId]); // 👈 Dependencias clave

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
        window.dispatchEvent(new Event('inventarioActualizado'));
    };

const categoriasParaConfig = useMemo(() => [...new Set(platos.map(p => p.categoria))], [platos]);
if (!tenantId) return <div style={{background: '#111827', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '900'}}>IDENTIFICANDO COMERCIO...</div>;   
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
                    tenantId={tenantId}
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
            <ReporteModal isOpen={rep.mostrarReporte} onClose={() => rep.setMostrarReporte(false)} cargando={rep.cargandoReporte} datos={rep.datosReporte} fechaInicio={rep.fechaInicioReporte} setFechaInicio={rep.setFechaInicioReporte} fechaFin={rep.fechaFinReporte} setFechaFin={rep.setFechaFinReporte} onGenerar={rep.generarCierreDia} listaGastos={rep.listaGastosDetallada} />
            
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
        </div>
    );
}