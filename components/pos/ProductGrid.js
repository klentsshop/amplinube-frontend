import React, { memo, useMemo, useState } from 'react';
import { formatPrecioDisplay, categoriasMap } from '@/lib/utils';

// ✅ Importamos la configuración maestra para la moneda y lógica
import { SITE_CONFIG } from '@/lib/config';
import { Settings } from 'lucide-react';
import PinModal from '../modals/PinModal';

const ProductGrid = memo(({
    platos, platosFiltrados, categoriasGlobales = [], busqueda, setBusqueda, categoriaActiva, setCategoriaActiva,
    mostrarCategoriasMobile, setMostrarCategoriasMobile, agregarAlCarrito, setPlatoAPesar, 
    setModalPesajeOpen,
    styles, mostrarCarritoMobile, setMostrarCarritoMobile, cart, total, mensajeExito, ordenesActivas, cargarOrden, ordenActivaId, setMostrarConfigImpresion,
    tenantId, columnasGrid = 6
}) => {
    // 🔒 ESTADO Y PROCESADOR DE PIN PARA CONFIGURACIÓN
    const [modalPinConfigOpen, setModalPinConfigOpen] = useState(false);

    const procesarPinConfig = async (pin) => {
        setModalPinConfigOpen(false);
        try {
            const res = await fetch('/api/auth/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pin, tipo: 'admin', tenantId: tenantId, tenant: tenantId })
            });
            const data = await res.json();
            if (data.autorizado) {
                setMostrarConfigImpresion(true);
            } else {
                alert("❌ PIN administrativo incorrecto.");
            }
        } catch (e) {
            alert("❌ Error de seguridad.");
        }
    };
    // 🚀 AJUSTE VISUAL SÉNIOR: Normalización de Objetos Categoría (ID UUID + Título)
    const listaCategorias = useMemo(() => {
        const comodinTodos = { id: 'TODOS', titulo: 'TODOS' };

        // 1. Prioridad: Categorías estructuradas desde Supabase/API
        if (Array.isArray(categoriasGlobales) && categoriasGlobales.length > 0) {
            const unicasMap = new Map();
            categoriasGlobales.forEach(c => {
                const id = typeof c === 'object' ? (c.id || c._id) : String(c);
                const titulo = typeof c === 'object' ? (c.titulo || c.nombre || id) : String(c);
                if (id && id !== 'TODOS' && !unicasMap.has(id)) {
                    unicasMap.set(id, { id, titulo: String(titulo).toUpperCase().trim() });
                }
            });

            const listaOrdenada = Array.from(unicasMap.values()).sort((a, b) => a.titulo.localeCompare(b.titulo));
            return [comodinTodos, ...listaOrdenada];
        }

        // 2. Fallback local si el catálogo es local/Sanity o mientras carga el global
        const unicasLocalesMap = new Map();
        platos.forEach(p => {
            let id = '';
            let titulo = '';
            if (typeof p.categoria === 'object' && p.categoria) {
                id = p.categoria._ref || p.categoria.id || p.categoria._id || '';
                titulo = p.categoria.titulo || p.categoria.nombre || id;
            } else if (p.categoria) {
                id = String(p.categoria);
                // 🛡️ BISTURÍ: Priorizamos el 'categoriaNombre' que ya viene resuelto desde Supabase
                titulo = String(p.categoriaNombre || p.categoriaLabel || p.categoria); 
            }

            if (id && id !== 'TODOS' && !unicasLocalesMap.has(id)) {
                unicasLocalesMap.set(id, { id, titulo: String(titulo).toUpperCase().trim() });
            }
        });
       const listaLocalesOrdenada = Array.from(unicasLocalesMap.values()).sort((a, b) => a.titulo.localeCompare(b.titulo));
    return [comodinTodos, ...listaLocalesOrdenada];
}, [platos, categoriasGlobales]);

// 🔥 2. LÓGICA DE ORDENAMIENTO INTELIGENTE (PROFESIONAL)
    // Usamos useMemo para ordenar los platos por popularidad (totalVentas) 
    // solo cuando estemos en la vista "todos" y no haya una búsqueda activa.
    // 🔥 REEMPLAZA ESTE BLOQUE EN TU PRODUCTGRID
const platosFinales = useMemo(() => {
    // Si no hay platos, no procesamos nada
    if (!platosFiltrados || platosFiltrados.length === 0) return [];

    // Si hay búsqueda, mostramos tal cual vienen para no saturar el procesador
    if (busqueda.trim() !== "") return platosFiltrados;

    if (categoriaActiva === 'TODOS') {
        // Hacemos una copia rápida para ordenar
        const copia = [...platosFiltrados];
        return copia.sort((a, b) => {
            const vA = Number(a.totalVentas) || 0;
            const vB = Number(b.totalVentas) || 0;
            return vB - vA || (a.nombre || "").localeCompare(b.nombre || "");
        });
    }

    return platosFiltrados;
}, [platosFiltrados, busqueda, categoriaActiva]);
return (
    <div className={styles.menuPanel}>
   {/* 🛡️ El buscador solo se oculta en móvil si el carrito está expandido en pantalla completa */}
   {((typeof window !== 'undefined' && window.innerWidth > 768) || !mostrarCarritoMobile) && (
     <div className={styles.mobileSearchHeader}>
        {/* Botón Carrito (Solo visible en móvil) */}
        <button 
            className={styles.mobileOrderBtn} 
            onClick={(e) => {
                e.stopPropagation();
                setMostrarCarritoMobile(true);
            }}
        >
            🛒
            </button>
        
        {/* 🔍 EL BUSCADOR */}
        <div className={styles.searchContainer}>
            <input 
                type="text" 
                placeholder="Buscar plato o pistolear código..." 
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className={styles.searchInput}
                autoFocus 
            />
            {busqueda && (
                <button onClick={() => setBusqueda('')} className={styles.clearBtn}>✕</button>
            )}
        </div>

        {/* Botón Categorías */}
        <button 
            className={styles.mobileCatBtn} 
            onClick={(e) => {
                e.stopPropagation();
                setMostrarCategoriasMobile(!mostrarCategoriasMobile);
            }}
        >
            {mostrarCategoriasMobile ? '✕' : '☰'}
        </button>
    </div>
)}
            {/* Menú lateral de categorías */}
            <div className={`${styles.categoriesBar} ${mostrarCategoriasMobile ? styles.categoriesBarShowMobile : ''}`}>
                <h3 className={styles.mobileOnlyTitle}>Categorías</h3>
            {listaCategorias.map(cat => {
                    const catId = typeof cat === 'object' ? cat.id : cat;
                    const catTitulo = typeof cat === 'object' ? cat.titulo : cat;
                    const esActivo = categoriaActiva === catId;

                    return (
                        <button 
                            key={catId} 
                            className={`${styles.catBtn} ${esActivo ? styles.catBtnActive : ''}`} 
                            onClick={() => {
                                setCategoriaActiva(catId);
                                setMostrarCategoriasMobile(false);
                            }}>
                            {(categoriasMap && categoriasMap[catTitulo]) ? categoriasMap[catTitulo] : catTitulo}
                        </button>
                    );
                })}
                {/* ⚙️ BOTÓN DE CONFIGURACIÓN DINÁMICO (SIEMPRE AL FINAL) */}
            
                    {/* ⚙️ BOTÓN DE CONFIGURACIÓN DINÁMICO (SIEMPRE AL FINAL) */}
<button 
    onClick={() => setModalPinConfigOpen(true)}
    className={styles.configBtnSidebar}
    title="Configurar Estación"
>
    <Settings size={20} />
</button>
                </div>

           {/* Cuadrícula de Platos con Diseño Split Autónomo y Adaptable */}
    <div 
    className={styles.productsGrid}
    style={{
        display: 'grid',
        // 🔥 Pasamos el número de columnas como una variable CSS limpia
        '--columnas-backend': columnasGrid || 6,
        
        // 🛡️ CONTROL DE DENSIDAD: Mantenemos el gap compacto si es Fruver (>8)
        gap: columnasGrid > 8 ? '6px' : '15px' 
    }}
>
                {/* 🚀 TARJETA COMODÍN: INTEGRACIÓN DE VALOR MANUAL */}
                <div 
                    className={styles.productCard} 
                    style={{ border: '2px dashed #10b981', backgroundColor: '#f0fdf4' }}
                    onClick={() => {
                        const inputNombre = prompt("📝 Ingrese el nombre del artículo manual (Dejar en blanco para 'VARIOS'):");
                        
                        // Si el usuario presiona Cancelar (esc/cancel), no hace nada
                        if (inputNombre === null) return;

                        // Si deja el cuadro en blanco, usa "VARIOS" por defecto
                        const nombreFinal = inputNombre.trim() !== "" ? inputNombre.trim().toUpperCase() : "VARIOS";

                        const precioManual = prompt(`💰 Ingrese el precio para "${nombreFinal}":`);
                        if (!precioManual || isNaN(precioManual) || Number(precioManual) <= 0) {
                            alert("❌ Precio inválido.");
                            return;
                        }

                        // Creamos un objeto simulado idéntico a la estructura de Supabase/Sanity
                        const idManual = `manual_${Date.now()}`;
                        const itemSimulado = {
                            _id: idManual,
                            id: idManual,
                            nombre: nombreFinal,
                            precio: Number(precioManual),
                            categoria: (categoriaActiva && categoriaActiva !== 'TODOS') ? categoriaActiva : 'MANUAL',
                            disponible: true,
                            controlaInventario: false,
                            seImprime: true
                        };

                        // Se inyecta directo al carrito global de forma atómica
                        agregarAlCarrito(itemSimulado);
                    }}
                >
                    {/* Icono representativo o fondo */}
                    <div 
                        className={styles.cardImage} 
                        style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center', 
                            backgroundColor: '#e6f4ea', 
                            fontSize: '2rem' 
                        }}
                    >
                        ➕💵
                    </div>
                    
                    <div className={styles.cardInfo}>
                        <div className={styles.cardTitle} style={{ color: '#047857', fontWeight: 'bold' }}>🛒 ÍTEM MANUAL</div>
                        <div className={styles.cardPrice} style={{ color: '#10b981' }}>DIGITAR VALOR</div>
                    </div>
                </div>

                {/* CONTINÚA EL RENDERIZADO DEL CATÁLOGO REAL */}
                {platosFinales.map(plato => (
                    <div 
    key={plato.id || plato._id} 
    className={styles.productCard} 
onClick={() => {
    // 🛡️ Preparamos el objeto con su precio formateado para el multiplicador del Modal
    const valorPorKilo = Number(plato.precio) || 0;
    const platoListo = { 
        ...plato, 
        precioNum: valorPorKilo
    };

    // ⚖️ RADAR DINÁMICO: Evaluamos el interruptor de Sanity o el fallback por unidad de medida
    const requierePeso = plato.esVentaPorPeso === true || plato.unidadMedida === 'kg';

    if (requierePeso) {
        setPlatoAPesar(platoListo);
        setModalPesajeOpen(true);
    } else {
        agregarAlCarrito(plato);
    }
}}>
                       {/* 1. Área de Imagen */}
                     <div 
                     className={styles.cardImage} 
                    style={{ 
                    backgroundImage: plato.imagenUrl 
                    ? `url(${plato.imagenUrl})` 
                    : 'none',
                     backgroundColor: '#f3f4f6'
                    }}
                   />
                        
                        {/* 2. Área de Información */}
                        <div className={styles.cardInfo}>
                            <div className={styles.cardTitle}>{plato.nombre}</div>
                            <div className={styles.cardPrice}>
                                {SITE_CONFIG.brand.symbol}{formatPrecioDisplay(plato.precio).toLocaleString(SITE_CONFIG.brand.currency)}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

 {/* BARRA INFERIOR DINÁMICA: SOLO SE RENDERIZA EN MÓVIL (PANTALLAS PEQUEÑAS) */}
           {typeof window !== 'undefined' && window.innerWidth <= 768 && (mensajeExito || (cart?.length > 0) || (ordenesActivas?.length > 0)) && !mostrarCarritoMobile && (
                <div 
                    className={mensajeExito || cart.length > 0 ? styles.rappiCartBtn : styles.barraMesasActivas} 
                    style={{ 
                        backgroundColor: mensajeExito ? '#059669' : (cart.length > 0 ? '#10B981' : '#f8f9fa'),
                        borderTop: cart.length === 0 ? '1px solid #dee2e6' : 'none'
                    }}
                    onClick={() => {
                        if (!mensajeExito && cart.length > 0) setMostrarCarritoMobile(true);
                    }}
                >
                    {mensajeExito ? (
                        /* MODO 1: CONFIRMACIÓN DE ÉXITO */
                        <>
                            <div className={styles.rappiCount}>✓</div>
                            <div className={styles.rappiText}>¡ORDEN GUARDADA EXITOSAMENTE!</div>
                        </>
                    ) : cart.length > 0 ? (
                        /* MODO 2: CARRITO ACTIVO */
                        <>
                            <div className={styles.rappiCount}>
                                {cart.reduce((acc, item) => acc + (Number(item.cantidad) || 0), 0)}
                                {' '}
                                {cart.length === 1 && cart[0].cantidad === 1 ? 'Producto' : 'Productos'}
                            </div>
                            <div className={styles.rappiText}>Ver pedido</div>
                            {!mensajeExito && (
                                <div className={styles.rappiTotal}>
                                    {SITE_CONFIG.brand.symbol}{Number(total || 0).toLocaleString()}
                                </div>
                            )}
                        </>
                    ) : (
                        /* MODO 3: NAVEGACIÓN RÁPIDA DE MESAS */
                        <div className={styles.contenedorMesasRapidas}>
                            <span className={styles.etiquetaMesas}>ORDENES ACTIVAS:</span>
                            <div className={styles.scrollMesas}>
                               {ordenesActivas && ordenesActivas.map((o) => {
                                    const oId = o.id || o._id;
                                    return (
                                        <button 
                                            key={oId} 
                                            className={`${styles.botonMesaRapida} ${ordenActivaId === oId ? styles.tableBtnActive : ''}`} 
                                            onClick={() => cargarOrden(oId)}
                                        >
                                            {o.mesa}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
        )}
            
            {/* 🔒 MODAL DE PIN SEGURA PARA CONFIGURACIÓN */}
            <PinModal 
                isOpen={modalPinConfigOpen}
                onClose={() => setModalPinConfigOpen(false)}
                onConfirm={procesarPinConfig}
                titulo="🔑 PIN de Administrador para Configuración"
            />
        </div>
    );
});

ProductGrid.displayName = 'ProductGrid';

export default ProductGrid;