'use client';

import React, { useState, useEffect } from 'react';
import { formatPrecioDisplay, METODOS_PAGO } from '@/lib/utils';
// ✅ Importamos la configuración maestra para volverlo vendible
import { SITE_CONFIG } from '@/lib/config';
import { useCart } from '@/app/context/CartContext';
import ModalPagoMixto from '../modals/ModalPagoMixto';

/**
 * 🛡️ COMPONENTE INTERNO: InputComentario
 */
function InputComentario({ item, actualizarComentario }) {
    const [texto, setTexto] = useState(item.comentario || '');
    
    useEffect(() => {
        setTexto(item.comentario || '');
    }, [item.comentario]);

    const manejarSalida = (e) => {
        const el = e.target;
        el.rows = 1; 
        el.style.overflow = 'hidden';
        actualizarComentario(item.lineId, texto);
    };

    return (
        <textarea 
            placeholder="📝 Notas para cocina (Ej: Sin sopa)..."
            value={texto}
            rows={1} 
            onChange={(e) => setTexto(e.target.value)}
            onBlur={manejarSalida}
            onFocus={(e) => {
                const el = e.target;
                const lineas = el.value.split('\n').length;
                el.rows = Math.max(lineas, 2); 
                el.style.overflow = 'auto';
            }}
            onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { 
                    e.preventDefault(); 
                    e.target.blur();
                }
            }}
            style={{ 
                marginTop: '6px', 
                padding: '6px 10px', 
                fontSize: '0.85rem', // 🎯 Exactamente tu medida
                border: '1px dashed #D1D5DB', 
                borderRadius: '6px', 
                backgroundColor: 'white', 
                color: SITE_CONFIG.theme.textDark, 
                outline: 'none', 
                width: '100%',
                resize: 'none', 
                lineHeight: '1.2',
                display: 'block',
                overflow: 'hidden',
                // 🛡️ ESTO ES LO QUE FALTA PARA QUE LA LETRA SEA IDÉNTICA:
                fontFamily: 'inherit',
                fontWeight: 'inherit',
                boxSizing: 'border-box'
            }}
        />
    );
}

export default function TicketPanel({
    cart, total, metodoPago, setMetodoPago, quitarDelCarrito, agregarAlCarrito,
    guardarOrden, cobrarOrden, generarCierreDia, solicitarAccesoCajero,
    solicitarAccesoAdmin, registrarGasto, refreshOrdenes, setMostrarListaOrdenes,
    mostrarCarritoMobile, setMostrarCarritoMobile, ordenMesa, nombreMesero,
    setNombreMesero, listaMeseros, 
    esModoCajero, ordenActivaId, numOrdenesActivas, cleanPrice, styles,
    cancelarOrden,
    clearCart,
    imprimirComandaCocina,
    imprimirTicket, 
    mensajeExito,
    clearWithStockReturn, eliminarLineaConStock,
    solicitarEliminacionAdmin,
    propina = 0, setPropina, 
    montoManual = 0, setMontoManual,
    setMostrarModalHistorial,
    setMostrarInventario,
    config,
    tenantId,
    setMostrarModalClientes,
}) {
    // 🛡️ EXTRACTOR SENIOR: Busca el mesero activo en la lista para leer sus permisos individuales en tiempo real
    const meseroActualObj = listaMeseros?.find(m => m.nombre === nombreMesero);
    const permisos = {
        verReporte: meseroActualObj?.verReporte || false,
        verAdmin: meseroActualObj?.verAdmin || false,
        puedeCargarGasto: meseroActualObj?.puedeCargarGasto || false,
        verVentas: meseroActualObj?.verVentas || false,
        verInventario: meseroActualObj?.verInventario || false,
        puedeCobrar: meseroActualObj?.puedeCobrar || false,
    };
    // 🔍 Mejora: Función para limpiar el emoji del título y evitar el doble icono
    const limpiarIconoDeTexto = (texto) => {
        const partes = texto.split(' ');
        if (partes.length > 1) return partes.slice(1).join(' '); // Retorna el texto sin el primer elemento (emoji)
        return texto;
    };

    // Buscamos el icono dinámico para el selector de pago
    const iconoPagoActual = (METODOS_PAGO || []).find(m => m.value === metodoPago)?.title.split(' ')[0] || '💰';
    // ... justo antes del return del TicketPanel
     const [pagaCon, setPagaCon] = useState('');
     const [verModalMixto, setVerModalMixto] = useState(false);
     const [montosMixtos, setMontosMixtos] = useState({ efectivo: 0, tarjeta: 0, digital: 0 });
     const { actualizarComentario, tipoOrden, setTipoOrden, clienteActivo } = useCart();
    
     // ✨ LOGICA PRO: Salto automático del radio button según el nombre
     useEffect(() => {
        if (!ordenMesa) return; 

        const nombre = ordenMesa.toLowerCase().trim();
        
        
        // Detección de Domicilio
        if (nombre.startsWith('domi')) {
            if (tipoOrden !== 'domicilio') setTipoOrden('domicilio');
        } 
        // Detección de Llevar
        else if (nombre.startsWith('llevar')) {
            if (tipoOrden !== 'llevar') setTipoOrden('llevar');
        } 
        // Detección de Mesa (Solo si es un número puro o empieza por "mesa")
        else if (/^\d+$/.test(nombre) || nombre.startsWith('mesa')) {
            if (tipoOrden !== 'mesa') setTipoOrden('mesa');
        }
     }, [ordenMesa, setTipoOrden, tipoOrden]); // Agregamos tipoOrden al array de dependencias por buena práctica
     
     const cambio = pagaCon && Number(pagaCon) > 0 ? (Number(pagaCon) - total) : 0;
    return (
        <div 
            className={`${styles.ticketPanel} ${mostrarCarritoMobile ? styles.ticketPanelShowMobile : ''}`}
            style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        >
            
            {/* 1. BOTÓN VOLVER (MÓVIL) */}
            <div 
    onClick={() => setMostrarCarritoMobile(false)} 
    className={styles.closeCartMobile}
    style={{ padding: '25px 10px', textAlign: 'center', backgroundColor: '#000000' }}
>
    ▼ TOCAR PARA VOLVER A LOS PLATOS
</div>

{/* 2. CABECERA - ROLES Y MESEROS */}
<div style={{ padding: 'clamp(10px, 2vw, 8px) clamp(14px, 3vw, 12px)', background: SITE_CONFIG.theme.dark, color: 'white', flexShrink: 0 }}>
    
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h2
                onClick={solicitarAccesoCajero} 
                style={{ 
                    fontSize: 'clamp(1.05rem, 2.5vw, 0.95rem)', 
                    margin: 0, 
                    cursor: 'pointer', 
                    fontWeight: 'bold',
                    color: esModoCajero ? SITE_CONFIG.theme.primary : 'white',
                    lineHeight: 1.2
                }}
            >
               {(config?.nombreCorto || config?.nombre || "SOCIO POS")?.toUpperCase()} {ordenMesa ? `(${ordenMesa})` : 'ACTUAL'}
            </h2>

            {cart.length > 0 && (
                <button 
    onClick={() => {
        if (typeof clearCart === 'function') {
            clearCart(); 
        }
    }}
    title="Nueva Orden (Limpiar pantalla)"
    style={{
        width: '65px',            // Más ancho para que respire
        height: '45px',           // Un poco más bajo para estilo "cápsula"
        borderRadius: '25px',     // Bordes totalmente redondeados
        backgroundColor: '#E5E7EB', // Gris claro profesional (Apple Style)
        color: '#374151',         // Icono en gris oscuro
        border: '1px solid #D1D5DB', // Borde sutil
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '22px',         // Emoji un pelín más pequeño para que no toque los bordes
        boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
        touchAction: 'manipulation',
        marginLeft: '10px'
    }}
>
    🧹
</button>

            )}
        </div>
        <select 
    value={nombreMesero || ""} 
    // 🛡️ BISTURÍ: Si ya hay un nombre, el select se bloquea.
    disabled={!!nombreMesero} 
    onChange={(e) => {
        const nuevoVendedor = e.target.value;
        if (nuevoVendedor) {
            setNombreMesero(nuevoVendedor);
            localStorage.setItem('ultimoMesero', nuevoVendedor);
        }
    }}
    style={{ 
        // Añadimos un cambio visual para que se note el bloqueo
        opacity: nombreMesero ? 0.7 : 1,
        cursor: nombreMesero ? 'not-allowed' : 'pointer',
        // ... tus estilos actuales
        padding: 'clamp(8px, 2vw, 4px) clamp(10px, 2.5vw, 6px)',
        borderRadius: '6px',
        border: `1px solid ${SITE_CONFIG.theme.textDark}`, 
        backgroundColor: '#374151',
        color: 'white',
        fontSize: 'clamp(0.95rem, 2.8vw, 0.8rem)',
        fontWeight: 'bold',
        width: 'auto',
        maxWidth: '180px'
    }}
>
    <option value="">👤 Vendedor...</option>
    {esModoCajero && <option value="Caja">💰 Caja (Auto)</option>}
    {listaMeseros?.map(m => (
        <option key={m.id || m._id} value={m.nombre}>{m.nombre}</option>
    ))}
</select>
    </div>
    
   <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', padding: '6px 0', justifyContent: 'center' }}>
    
    {/* 1. ÓRDENES */}
    <button 
        onClick={() => { refreshOrdenes(); setMostrarListaOrdenes(true); }} 
        style={{
            flex: '1 1 30%', // 👈 Cambiado a elástico
            minWidth: '80px',
            padding: 'clamp(8px, 2.4vw, 7px) 2px',
            backgroundColor: '#9CA3AF',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: 'clamp(0.85rem, 2.5vw, 0.75rem)',
            fontWeight: '900',
            cursor: 'pointer'
        }}
    >
        ÓRDENES ({numOrdenesActivas})
    </button>
    {/* 5. + GASTO */}
    {(esModoCajero || permisos.puedeCargarGasto) && (
        <button 
            onClick={registrarGasto} 
            style={{
                flex: '0 0 31%',
                padding: 'clamp(14px, 3.5vw, 10px) 2px',
                fontSize: 'clamp(0.85rem, 2.5vw, 0.75rem)',
                backgroundColor: SITE_CONFIG.theme.accent,
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontWeight: '900',
                cursor: 'pointer'
            }}
        >
            + GASTO
        </button>
    )}
    {/* 6. VENTAS */}
    {(esModoCajero || permisos.verVentas) && (
        <button 
            onClick={() => setMostrarModalHistorial(true)} 
            style={{
                flex: '0 0 31%',
                padding: 'clamp(14px, 3.5vw, 10px) 2px',
                fontSize: 'clamp(0.85rem, 2.5vw, 0.75rem)',
                backgroundColor: '#228B22', 
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontWeight: '900',
                cursor: 'pointer'
            }}
        >
            VENTAS
        </button>
    )}
   {/* 🛡️ CONTROL DE ACCESO: Se muestra el bloque de administración si está en Modo Cajero o el usuario tiene algún permiso activo */}
{(esModoCajero || permisos?.verReporte || permisos?.verAdmin || permisos?.verInventario) && (
    <>
        {/* 1. REPORTE */}
        {(esModoCajero || permisos?.verReporte) ? (
            <button
                onClick={generarCierreDia} 
                style={{
            flex: '1 1 30%', // 👈 Cambiado a elástico
            minWidth: '80px',
            padding: 'clamp(8px, 2.4vw, 7px) 2px',
                    fontSize: 'clamp(0.85rem, 2.5vw, 0.75rem)', 
                    backgroundColor: SITE_CONFIG.theme.danger, 
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontWeight: '900', 
                    cursor: 'pointer'
                }}
            >
                REPORTE
            </button>
        ) : <div style={{ flex: '0 0 31%' }} />} {/* Espaciador opcional para mantener la rejilla de 3 columnas perfecta */}

        {/* 2. ADMIN */}
        {(esModoCajero || permisos?.verAdmin) ? (
            <button 
                onClick={solicitarAccesoAdmin} 
                style={{
                    flex: '0 0 31%',
                    padding: 'clamp(10px, 2.8vw, 8px) 2px',
                    fontSize: 'clamp(0.85rem, 2.5vw, 0.75rem)',
                    backgroundColor: '#374151',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontWeight: '900',
                    cursor: 'pointer'
                }}
            >
                ADMIN
            </button>
        ) : <div style={{ flex: '0 0 31%' }} />}

        {/* 3. INVENTARIO */}
        {(esModoCajero || permisos?.verInventario) ? (
            <button 
                onClick={() => setMostrarInventario(true)} 
                style={{
                    flex: '0 0 31%',
                    padding: 'clamp(14px, 3.5vw, 10px) 2px',
                    fontSize: 'clamp(0.85rem, 2.5vw, 0.75rem)',
                    backgroundColor: '#2563eb', 
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontWeight: '900',
                    cursor: 'pointer'
                }}
            >
                INVENTARIO
            </button>
        ) : <div style={{ flex: '0 0 31%' }} />}
    </>
)}
</div>
</div>

            {/* 3. LISTADO DE PRODUCTOS (RESTAURADA ALINEACIÓN Y LÓGICA DE ORDENAMIENTO) */}
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '10px 15px', background: '#f9fafb' }}>
                {cart.length === 0 ? (
                    <p style={{ textAlign: 'center', color: '#9CA3AF', marginTop: '20px' }}>No hay productos seleccionados</p>
                ) : (
                    [...cart]
                       .sort((a, b) => {
    // 1. Normalizamos categorías y nombres a minúsculas
    const catA = (a.categoria || "").toLowerCase();
    const catB = (b.categoria || "").toLowerCase();
    const nomA = (a.nombre || "").toLowerCase();
    const nomB = (b.nombre || "").toLowerCase();

    // 2. Palabras clave que identifican bebidas/jugos/líquidos
    const palabrasBebida = ['bebida', 'toma', 'gaseosa', 'jugo', 'jugos', 'refresco', 'cerveza', 'licor', 'agua', 'limonada', 'soda'];

    const esBebidaA = palabrasBebida.some(p => catA.includes(p) || nomA.includes(p));
    const esBebidaB = palabrasBebida.some(p => catB.includes(p) || nomB.includes(p));

    // 🍹 Mandamos todas las bebidas, jugos y gaseosas al FINAL del ticket
    if (esBebidaA && !esBebidaB) return 1;
    if (!esBebidaA && esBebidaB) return -1;

    // 🍽️ Para los platos de comida: preservamos el orden exacto de llegada (el último plato queda ARRIBA)
    return 0;
})
                    
         .map(item => (
     <div key={item.lineId} style={{ display: 'flex', flexDirection: 'column', padding: '10px 0', borderBottom: '1px solid #eee' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            
            {/* IZQUIERDA: Nombre y Multiplicador (Indispensable para impresión) */}
            <div style={{ flex: 1 }}>
                <strong style={{ fontSize: '1.05rem', color: '#111827', lineHeight: '1.2' }}>{item.nombre}</strong><br/>
                <small style={{ fontSize: '0.85rem', color: '#6B7280' }}>
                    ${(item.precioNum || 0).toLocaleString(SITE_CONFIG.brand.currency)} x {item.cantidad}
                </small>
            </div>

            {/* DERECHA: ORDEN SOLICITADO [ + ] [ PRECIO ] [ - ] */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                
                {/* 1. BOTÓN MÁS (Circular Verde) */}
                {/* 1. BOTÓN MÁS (Circular Verde) */}
                <button 
                 onClick={() => {
                 const esItemGuardado = item.esDeOrdenGuardada || item._key;
                 if (esItemGuardado) {
                 alert(`🚫 Para agregar otro "${item.nombre}", selecciónalo desde el menú de platos para crear una adición.`);
                 } else {
                 agregarAlCarrito(item);
                 }
                 }} 
                 style={{
                        color: (item.esDeOrdenGuardada || item._key) ? '#a7f3d0' : '#059669',
                        border: (item.esDeOrdenGuardada || item._key) ? '1px dashed #a7f3d0' : '1px solid #059669',
                        borderRadius: '50%', 
                        width: '24px', 
                        height: '24px', 
                        cursor: 'pointer',
                        background: 'none', 
                        fontWeight: 'bold',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1rem',
                        lineHeight: 1
                     }}
                >
                    +
                </button>

                {/* 2. PRECIO TOTAL DEL ITEM (En el medio) */}
                <strong style={{ fontSize: '1rem', fontWeight: '700', color: '#111827', minWidth: '55px', textAlign: 'center' }}>
                    {((item.precioNum || 0) * item.cantidad).toLocaleString(SITE_CONFIG.brand.currency)}
                </strong>

                {/* 3. BOTÓN MENOS (Circular Rojo) */}
                <button 
                  onClick={() => {
                  const esItemGuardado = item.esDeOrdenGuardada || item._key;
                  if (esItemGuardado) {
                  solicitarEliminacionAdmin(item);
                  } else {
                  quitarDelCarrito(item.lineId);
                  }
                  }} 
                     style={{ 
                       cursor: ((item.esDeOrdenGuardada || item._key) && !esModoCajero) ? 'help' : 'pointer', 
                       opacity: ((item.esDeOrdenGuardada || item._key) && !esModoCajero) ? 0.5 : 1,
                        color: SITE_CONFIG.theme.danger, 
                        border: `1px solid ${SITE_CONFIG.theme.danger}`,
                        borderRadius: '50%', 
                        width: '24px', 
                        height: '24px', 
                        background: 'none', 
                        fontWeight: 'bold',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1rem',
                        lineHeight: 1
                    }}
                >
                    -
                </button>
            </div>
        </div>

        {/* Campo de Comentarios */}
        <div style={{ marginTop: '4px' }}>
            <InputComentario item={item} actualizarComentario={actualizarComentario} />
        </div>
    </div>
))
                )}
            </div>

            {/* 4. PIE DE PÁGINA - SELECTORES MEJORADOS Y CAMPO OTRO */}
            <div style={{ padding: '6px 12px', background: 'white', borderTop: '2px solid #eee', flexShrink: 0 }}>
                
                {/* 💳 SELECTORES: PAGO, PROPINA Y CAMPO OTRO */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '6px' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <div style={{ flex: 1, position: 'relative' }}>
                            <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', zIndex: 1 }}>{iconoPagoActual}</span>
                            <select 
                                value={metodoPago} 
                                onChange={(e) => setMetodoPago(e.target.value)}
                                style={{ 
                                    width: '100%', padding: '10px 10px 10px 32px', borderRadius: '8px', border: '1px solid #D1D5DB',
                                    backgroundColor: '#FFFFFF', fontSize: '0.75rem', fontWeight: 'bold', color: '#374151', cursor: 'pointer'
                                }}
                            >
                                {(METODOS_PAGO || []).map(m => (
                                <option key={m.value} value={m.value}>
                                {(limpiarIconoDeTexto(m?.title) || "")?.toUpperCase() || ""}
                                </option>
                                ))}
                            </select>
                        </div>

                        <div style={{ flex: 1, position: 'relative' }}>
                            <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', zIndex: 1 }}>🎁</span>
                            <select 
                                value={propina} 
                                onChange={(e) => {
                                    setPropina(Number(e.target.value));
                                    if (Number(e.target.value) !== -1) setMontoManual(0);
                                }}
                                style={{ 
                                    width: '100%', padding: '10px 10px 10px 32px', borderRadius: '8px', border: '1px solid #D1D5DB',
                                    backgroundColor: '#FFFFFF', fontSize: '0.75rem', fontWeight: 'bold', color: '#374151', cursor: 'pointer'
                                }}
                            >
                                <option value="0">SIN PROPINA (0%)</option>
                                <option value="10">SUGERIDA (10%)</option>
                                <option value="5">CORTESÍA (5%)</option>
                                <option value="-1">VALOR MANUAL ($)</option>
                            </select>
                        </div>
                    </div>
                    {/* 🛒 INDICADOR MODERNO DE PRODUCTOS EN EL CARRITO */}
                    {cart.length > 0 && (
                        <div style={{ 
                            display: 'flex', 
                            justify: 'space-between', 
                            alignItems: 'center',
                            padding: '6px 12px', 
                            backgroundColor: '#ECFDF5', 
                            borderRadius: '8px', 
                            border: '1px solid #A7F3D0'
                        }}>
                            <span style={{ fontSize: '0.8rem', fontWeight: '800', color: '#047857' }}>
                                🛒 ÍTEMS EN ORDEN: &nbsp;
                            </span>
                            <span style={{ 
                                fontSize: '0.85rem', 
                                fontWeight: '900', 
                                color: '#047857'
                            }}>
                                {cart.reduce((sum, i) => sum + (Number(i.cantidad) || 0), 0)} {cart.reduce((sum, i) => sum + (Number(i.cantidad) || 0), 0) === 1 ? 'Unidad' : 'Unidades'}
                            </span>
                        </div>
                    )}
                    {/* 💰 CAMPO PARA MONTO MANUAL (Solo aparece si se elige valor manual) */}
                    {propina === -1 && (
                        <div style={{ position: 'relative' }}>
                            <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', fontWeight: 'bold', color: '#10B981' }}>$</span>
                            <input 
                                type="number"
                                placeholder="Escriba valor de propina..."
                                value={montoManual || ''}
                                onChange={(e) => setMontoManual(Number(e.target.value))}
                                style={{ width: '100%', padding: '10px 10px 10px 25px', borderRadius: '8px', border: '2px solid #10B981', outline: 'none', fontWeight: 'bold' }}
                            />
                        </div>
                    )}
                </div>
                {/* 💰 SECCIÓN TOTAL Y CALCULADORA COMPACTA (OPTIMIZADA) */}
                <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    padding: '2px 0', 
                    borderTop: '1px solid #eee',
                    marginBottom: '4px'
                }}>
                    {/* IZQUIERDA: Calculadora compacta con input más ancho */}
                    {(esModoCajero || permisos.puedeCobrar) ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontSize: '0.65rem', fontWeight: '900', color: '#9CA3AF', marginBottom: '2px' }}>PAGA CON:</span>
                                <div style={{ position: 'relative' }}>
                                    <span style={{ position: 'absolute', left: '6px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.75rem', fontWeight: 'bold', color: '#6B7280' }}>$</span>
                                    <input 
                                        type="number"
                                        placeholder="0"
                                        value={pagaCon}
                                        onChange={(e) => setPagaCon(e.target.value)}
                                        style={{ 
                                            width: '130px', 
                                            padding: '2px 4px 2px 12px',
                                            borderRadius: '6px', 
                                            border: '1px solid #D1D5DB', 
                                            fontSize: '0.9rem', 
                                            fontWeight: '900',
                                            outline: 'none',
                                            backgroundColor: '#F9FAFB'
                                        }}
                                    />
                                </div>
                            </div>

                            {pagaCon && (
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ fontSize: '0.65rem', fontWeight: '900', color: '#9CA3AF', marginBottom: '2px' }}>CAMBIO:</span>
                                    <span style={{ 
                                        fontSize: '0.95rem', 
                                        fontWeight: '950', 
                                        color: cambio < 0 ? '#EF4444' : '#059669' 
                                    }}>
                                        {SITE_CONFIG.brand.symbol}{cambio.toLocaleString(SITE_CONFIG.brand.currency)}
                                    </span>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div style={{ flex: 1 }}></div> 
                    )}

                   {/* POR ESTE BLOQUE BLINDADO (El mesero ya puede tocar el muñequito): */}
<div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
    <span style={{ fontSize: '0.75rem', fontWeight: '800', color: SITE_CONFIG.theme.textDark, lineHeight: '1' }}>TOTAL</span>
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
        
        {/* 🛡️ CIRUGÍA: Quitamos el 'esModoCajero &&' para que el mesero pueda amarrar clientes y domicilios */}
        <button
            type="button"
            onClick={() => typeof setMostrarModalClientes === 'function' && setMostrarModalClientes(true)}
            title={clienteActivo ? `Cliente: ${clienteActivo.nombre}` : "Asignar Cliente"}
            style={{
                background: 'none',
                border: 'none',
                padding: '4px',
                cursor: 'pointer',
                fontSize: '1.4rem', 
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'transform 0.1s ease',
                position: 'relative'
            }}
            onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.9)'}
            onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
            {clienteActivo ? '👤' : '👤'}
            {/* 🟢 Indicador minimalista flotante: si hay cliente activo, pone un punto verde esmeralda */}
            {clienteActivo && (
                <span style={{
                    position: 'absolute',
                    right: '-2px',
                    top: '-2px',
                    width: '8px',
                    height: '8px',
                    backgroundColor: '#10B981',
                    borderRadius: '50%',
                    border: '1px solid white',
                    boxShadow: '0 0 4px #10B981'
                }} />
            )}
        </button>
{/* 🛡️ El Pago Mixto se abre si es cajero o si tiene permiso explícito */}
        {(esModoCajero || permisos.puedeCobrar) && (
            <button 
                type="button"
                onClick={() => setVerModalMixto(true)}
                style={{ background: '#7c3aed', color: 'white', border: 'none', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '14px' }}
            >➕</button>
        )}
        
        <span style={{ fontSize: '1.45rem', fontWeight: '950', color: '#000', lineHeight: '1.1' }}>
            {SITE_CONFIG.brand.symbol}{total.toLocaleString(SITE_CONFIG.brand.currency)}
        </span>
    </div>
</div>
</div>
{verModalMixto && (
    <ModalPagoMixto 
        total={total} 
        montos={montosMixtos} 
        setMontos={setMontosMixtos} 
        onClose={() => setVerModalMixto(false)}
        onCobrar={() => setVerModalMixto(false)} // 👈 Le inyectamos el gatillo
    />
)}
                <div style={{ display: 'flex', gap: '4px', width: '100%', alignItems: 'center' }}>
    {/* 1. SECCIÓN IMPRESIÓN: Solo si hay algo en el carrito */}
    {cart.length > 0 && (
    <>
        {/* 1. BOTÓN CLIENTE (Ahora envía datos para el Salto Pro) */}
        <button 
            onClick={() => imprimirTicket({ 
        mesa: ordenMesa, 
        mesero: nombreMesero, 
        tipoOrden: tipoOrden,
        propina: propina,
        montoManual: montoManual,
        tenantId: tenantId
            })} 
            style={{ 
                flex: '0 0 16%', 
                padding: '12px 1px', 
                backgroundColor: SITE_CONFIG.theme.secondary, 
                color: 'white', 
                border: 'none', 
                borderRadius: '6px', 
                fontWeight: '800', 
                fontSize: '0.60rem', 
                cursor: 'pointer' 
            }}
        >
            CLIENTE
        </button>

        {/* 2. BOTÓN COCINA (Mantiene su lógica de comanda interna) */}
        <button 
            onClick={imprimirComandaCocina} 
            style={{ 
                flex: '0 0 16%', 
                padding: '12px 1px', 
                backgroundColor: SITE_CONFIG.theme.dark, 
                color: 'white', 
                border: 'none', 
                borderRadius: '6px', 
                fontWeight: '800', 
                fontSize: '0.60rem', 
                cursor: 'pointer' 
            }}
        >
            PEDIDO
        </button>
    </>
)}
    {/* 2. BOTÓN BORRAR: Aparece solo si la mesa ya existe en Sanity (ordenActivaId) */}
    {ordenActivaId && (
        <button 
            className={styles.btnNegro} 
            onClick={cancelarOrden}
            disabled={mensajeExito}
            style={{ 
                flex: '0 0 16%', 
                padding: '12px 1px', 
                backgroundColor: mensajeExito ? '#1a1a1a' : '#000', 
                color: '#ff4444', 
                border: '1px solid #ff4444', 
                borderRadius: '6px', 
                fontWeight: '800', 
                fontSize: '0.60rem', 
                cursor: mensajeExito ? 'not-allowed' : 'pointer', 
            }}
        >
            {mensajeExito ? '...' : 'BORRAR'}
        </button>
    )}

    {/* 3. BOTÓN GUARDAR / ACTUALIZAR: Siempre visible */}
    <button 
        onClick={() => guardarOrden()} 
        style={{ 
            flex: '1', 
            padding: '12px 2px', 
            backgroundColor: '#fbbf24', 
            color: 'white', 
            border: 'none', 
            borderRadius: '6px', 
            fontWeight: '900', 
            fontSize: '0.75rem', 
            cursor: 'pointer',
            minWidth: '0' // Evita que el texto largo rompa el layout
        }}
    >
        {ordenActivaId ? 'ACTUALIZAR' : 'GUARDAR'}
    </button>
    {/* 4. BOTÓN COBRAR: Solo si es cajero y la orden ya está guardada */}
    {(esModoCajero || permisos.puedeCobrar) && cart.length > 0 && (
   <button 
    onClick={async () => {
        // 1. CAPTURA DE DATOS (Congelamos los montos para que no se pierdan)
        const montosFinales = {
            efectivo: Number(montosMixtos.efectivo || 0),
            tarjeta: Number(montosMixtos.tarjeta || 0),
            digital: Number(montosMixtos.digital || 0)
        };

        const sumaModal = montosFinales.efectivo + montosFinales.tarjeta + montosFinales.digital;
        
        // 2. EJECUCIÓN DIRECTA
        // No ponemos setMensajeExito aquí para evitar el error de la imagen.
        // El bloqueo gris ocurrirá en cuanto entre a 'cobrarOrden' en el handler.
        try {
        
          if (sumaModal > 0 && Math.abs(sumaModal - total) < 10) {
            await cobrarOrden('mixto_v2', montosFinales, tenantId, permisos.puedeCobrar); 
          } else {
            await cobrarOrden(metodoPago, null, tenantId, permisos.puedeCobrar);
          }
          
          // 🧹 LIMPIEZA DE ESTADOS POST-COBRO:
          setPagaCon('');
          setMetodoPago('efectivo'); // 👈 RESTABLECE AUTOMÁTICAMENTE A EFECTIVO
          setMontosMixtos({ efectivo: 0, tarjeta: 0, digital: 0 });

        } catch (error) {
            console.error("🔥 Error crítico en el botón cobrar:", error);
            // El catch está aquí por si el await falla antes de llegar a Sanity
        }
    }}    
    disabled={mensajeExito} // 👈 Este sigue siendo el candado
    style={{ 
        flex: '1', 
        padding: '12px 2px', 
        backgroundColor: mensajeExito ? '#9ca3af' : SITE_CONFIG.theme.primary, 
        color: 'white', border: 'none', borderRadius: '6px', 
        fontWeight: '900', fontSize: '0.75rem', 
        cursor: mensajeExito ? 'not-allowed' : 'pointer', minWidth: '0'
    }}
>
    {mensajeExito ? 'ENVIANDO...' : 'COBRAR'}
</button>)}
</div>
            </div>
        </div>
    );
}