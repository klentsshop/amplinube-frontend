import React, { memo, useMemo } from 'react';
import { formatPrecioDisplay, categoriasMap } from '@/lib/utils';

// 🛡️ RESOLVEDOR DE IMÁGENES SENIOR: Extrae la URL estática sin instanciar el cliente de Sanity
const getSanityImageUrl = (imageAsset) => {
    if (!imageAsset || !imageAsset.asset || !imageAsset.asset._ref) return null;
    const ref = imageAsset.asset._ref; // Formato: image-assetId-dimension-ext
    const [,, id, dimensions, ext] = ref.split('-');
    return `https://cdn.sanity.io/images/${process.env.NEXT_PUBLIC_SANITY_PROJECT_ID}/${process.env.NEXT_PUBLIC_SANITY_DATASET}/${id}-${dimensions}.${ext}?w=300`;
};
// ✅ Importamos la configuración maestra para la moneda y lógica
import { SITE_CONFIG } from '@/lib/config';
import { Settings } from 'lucide-react';

const ProductGrid = memo(({
    platos, platosFiltrados, busqueda, setBusqueda, categoriaActiva, setCategoriaActiva,
    mostrarCategoriasMobile, setMostrarCategoriasMobile, agregarAlCarrito, setPlatoAPesar, 
    setModalPesajeOpen,
    styles, mostrarCarritoMobile, setMostrarCarritoMobile, cart, total, mensajeExito, ordenesActivas, cargarOrden, ordenActivaId, setMostrarConfigImpresion,
    tenantId, columnasGrid = 6
}) => {
    const listaCategorias = useMemo(() => ['todos', ...new Set(platos.map(p => p.categoria))], [platos]);
    console.log("📊 Columnas vivas que recibe el ProductGrid desde el backend:", columnasGrid);
// 🔥 2. LÓGICA DE ORDENAMIENTO INTELIGENTE (PROFESIONAL)
    // Usamos useMemo para ordenar los platos por popularidad (totalVentas) 
    // solo cuando estemos en la vista "todos" y no haya una búsqueda activa.
    // 🔥 REEMPLAZA ESTE BLOQUE EN TU PRODUCTGRID
const platosFinales = useMemo(() => {
    // Si no hay platos, no procesamos nada
    if (!platosFiltrados || platosFiltrados.length === 0) return [];

    // Si hay búsqueda, mostramos tal cual vienen para no saturar el procesador
    if (busqueda.trim() !== "") return platosFiltrados;

    if (categoriaActiva === 'todos') {
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
   {!mostrarCarritoMobile && (
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
                {listaCategorias.map(cat => (
                    <button 
                        key={cat} 
                        className={`${styles.catBtn} ${categoriaActiva === cat ? styles.catBtnActive : ''}`} 
                        onClick={() => {
                            setCategoriaActiva(cat);
                            setMostrarCategoriasMobile(false);
                        }}>
                        {(categoriasMap && categoriasMap[cat]) ? categoriasMap[cat] : cat}
                    </button>
                ))}
                {/* ⚙️ BOTÓN DE CONFIGURACIÓN DINÁMICO (SIEMPRE AL FINAL) */}
            
                    {/* ⚙️ BOTÓN DE CONFIGURACIÓN DINÁMICO (SIEMPRE AL FINAL) */}
<button 
    onClick={async () => {
        const pin = prompt("🔑 PIN de Administrador para Configuración:");
        if (!pin) return;
        
        try {
            const res = await fetch('/api/auth/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pin, tipo: 'admin', tenantId: tenantId, tenant: tenantId }) // 👈 Cambiado a tenantId puro de las props
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
    }}
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
                        const nombreManual = prompt("📝 Ingrese el nombre del artículo manual:");
                        if (!nombreManual || !nombreManual.trim()) return;

                        const precioManual = prompt(`💰 Ingrese el precio para "${nombreManual.toUpperCase()}":`);
                        if (!precioManual || isNaN(precioManual) || Number(precioManual) <= 0) {
                            alert("❌ Precio inválido.");
                            return;
                        }

                        // Creamos un objeto simulado idéntico a la estructura de Sanity
                        const itemSimulado = {
                            _id: `manual_${Date.now()}`, // ID único temporal
                            nombre: nombreManual.trim().toUpperCase(),
                            precio: Number(precioManual),
                            categoria: (categoriaActiva && categoriaActiva !== 'todos') ? categoriaActiva : 'MANUAL',
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
    key={plato._id} 
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
                                {ordenesActivas && ordenesActivas.map((o) => (
                                    <button 
                                        key={o._id} 
                                        className={`${styles.botonMesaRapida} ${ordenActivaId === o._id ? styles.tableBtnActive : ''}`} 
                                        onClick={() => cargarOrden(o._id)}
                                    >
                                        {o.mesa}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
            
        </div>
    );
});

ProductGrid.displayName = 'ProductGrid';

export default ProductGrid;