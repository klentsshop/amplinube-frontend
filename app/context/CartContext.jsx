'use client';

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { cleanPrice } from '@/lib/utils'; // ✅ Usamos tu utilidad global

const CartContext = createContext();
const getTenantKey = () => {
  if (typeof window === 'undefined') return 'demo';
  const host = window.location.hostname;
  const firstPart = host.split('.')[0];
  return (firstPart === 'localhost' || firstPart === 'sociopos') ? 'demo' : firstPart;
};

export function CartProvider({ children, tenantId }) {

  const activeTenantId = useMemo(() => tenantId || getTenantKey(), [tenantId]);
  const stockLocalCache = useMemo(() => new Map(), [activeTenantId]);
  const avisosDados = useMemo(() => new Set(), [activeTenantId]);
  const [items, setItems] = useState([]);
  const CART_KEY = `${activeTenantId}_cart`;
  const TYPE_KEY = `${activeTenantId}_tipo_orden`;
  const [metodoPago, setMetodoPago] = useState('efectivo');
  const [propina, setPropina] = useState(0); // 👈 Estado para el % de propina
  const [montoManual, setMontoManual] = useState(0); // 👈 Campo "Otro" (Monto manual)
  const [tipoOrden, setTipoOrden] = useState('mesa');
  const [ordenActivaId, setOrdenActivaId] = useState(null);
  const [ordenMesa, setOrdenMesa] = useState(null);
   // 💾 1. Al iniciar: Recuperar Carrito y Tipo de Orden del navegador
  useEffect(() => {
    // Definimos las constantes extrayendo los datos del almacenamiento
    const currentId = activeTenantId;
    const savedItems = localStorage.getItem(CART_KEY);
    const savedTipo = localStorage.getItem(TYPE_KEY);

    if (savedItems) {
      try {
        const parsed = JSON.parse(savedItems);
        if (parsed && parsed.length > 0) setItems(parsed);
      } catch (e) { console.error("Error localStorage", e); }
    }
    

    // ✅ Si hay un tipo de orden guardado (domicilio/llevar), lo aplicamos
    if (savedTipo) {
      setTipoOrden(savedTipo);
    }

    // 🔥 SINCRONIZACIÓN ENTRE PESTAÑAS (Para que no se crucen las órdenes)
    const syncTabs = (e) => {
      if (e.key === `${activeTenantId}_cart`) {
        const newValue = e.newValue ? JSON.parse(e.newValue) : [];
        setItems(newValue);
      }
      // Sincronizar también el radio si se cambia en otra pestaña abierta
      if (e.key === `${activeTenantId}_tipo_orden`) {
    setTipoOrden(e.newValue || 'mesa');
}
    };

    window.addEventListener('storage', syncTabs);
    return () => window.removeEventListener('storage', syncTabs);
  }, [CART_KEY, TYPE_KEY, activeTenantId]);

    // 💾 2. Guardado Automático con "Amortiguador" (Debounce)
  // Esto evita que el sistema titile al cargar una mesa desde Sanity
// 💾 2. Guardado Automático con "Detector de Huérfanos" (Blindaje Mesa 0)
  useEffect(() => {
    // 1. Si el carrito está vacío, limpiamos disco y paramos
    const tenantId = activeTenantId;
    if (items.length === 0) {
        localStorage.removeItem(`${tenantId}_cart`);
        return;
    }

    // 2. 🛡️ BISTURÍ: Identificamos el origen de los platos
    const tienePlatosDeSanity = items.some(it => it.esDeOrdenGuardada || it._key);
    const tienePlatosNuevos = items.some(it => !it.esDeOrdenGuardada && !it._key);

    const saveTimeout = setTimeout(() => {
      // 🚨 LA REGLA DE ORO CONTRA DUPLICADOS:
      // Si la tablet cree que NO hay una orden activa (null) pero los platos dicen que
      // YA venían de Sanity, bloqueamos el guardado. Es un "fantasma" de una mesa ya cobrada.
      if (tienePlatosDeSanity && !tienePlatosNuevos && !ordenActivaId) {
          console.warn("🚫 [BLOQUEO_FANTASMA]: Evitando creación de Mesa 0 duplicada.");
          return; 
      }

      // 3. Si pasa el filtro, guardamos normal (Tu lógica original intacta)
      localStorage.setItem(`${tenantId}_cart`, JSON.stringify(items));
      localStorage.setItem(`${tenantId}_tipo_orden`, tipoOrden || 'mesa');
    }, 150);

    return () => clearTimeout(saveTimeout);
    
    // 🛡️ RECUERDA: Agregamos ordenActivaId a las dependencias para que el radar funcione
  }, [items, tipoOrden, ordenActivaId, CART_KEY, TYPE_KEY]);
  
 const addProduct = React.useCallback(async (product, cantidadManual = null) => {
    const pId = product._id || product.id;
    const precioNum = cleanPrice(product.precio);
    
    // 🥩 LÓGICA DE PESO: Si viene de la báscula/manual lo usamos, si no, es 1.
    const cantAAgregar = cantidadManual !== null ? Number(cantidadManual) : 1;

   setItems(prev => {
    const esPesado = cantidadManual !== null;

    // 1. Buscamos duplicados SOLO si es un producto de unidad (Restaurante)
    const existingIdx = !esPesado ? prev.findIndex(it => 
      (it._id || it.id) === pId && 
      (it.comentario === (product.comentario || '')) &&
      !it._key 
    ) : -1;

    // 2. Si es de Restaurante y ya existe, sumamos cantidad
    if (existingIdx !== -1) {
        const copy = [...prev];
        const itemActual = copy[existingIdx];
        const nuevaCantidad = itemActual.cantidad + cantAAgregar;
        
        copy[existingIdx] = { 
            ...itemActual,           
            ...product,
            cantidad: nuevaCantidad, 
            subtotalNum: Number((nuevaCantidad * precioNum).toFixed(2))
        };
        return copy;
    }

    // 3. Si es de Fama (Pesado) o producto nuevo, creamos línea independiente
    return [...prev, { 
      ...product, 
      _id: pId, 
      lineId: crypto.randomUUID(), // Vital: ID único por pesada
      cantidad: cantAAgregar, 
      precioNum, 
      subtotalNum: Number((precioNum * cantAAgregar).toFixed(2)), 
      comentario: product.comentario || '', 
      categoria: (product.categoria || "").toString().toUpperCase().trim(),
      seImprime: product.seImprime ?? true 
    }];
});

    // --- 🛡️ 2. LÓGICA DE INVENTARIO (Validación Real Proporcional) ---
    if (product.controlaInventario) {
        const receta = (product.recetaInsumos || []).length > 0 
            ? product.recetaInsumos 
            : (product.insumoVinculado?._ref ? [{ 
                insumoId: product.insumoVinculado._ref, 
                cantidad: Number(product.cantidadADescontar) || 1 
            }] : []);

        if (receta.length > 0) {
            // ⚡ PASO A: VALIDACIÓN INSTANTÁNEA (Caché Local)
            for (const item of receta) {
                const stockCache = stockLocalCache.get(item.insumoId);
                
                // 🔥 CRÍTICO: Validamos según lo que se va a pesar/vender realmente
                const necesidadReal = item.cantidad * cantAAgregar;

                if (stockCache !== undefined && stockCache < necesidadReal) {
                    alert(`🚫 AGOTADO: No hay stock suficiente para: "${product.nombre}".`);
                    return; 
                }
            }

            // 🛰️ PASO B: VALIDACIÓN DE FONDO (Sincronización con Sanity)
           fetch(`/api/inventario/list?tenantId=${activeTenantId}`, { cache: 'no-store' })
                .then(res => res.json())
                .then(insumosServer => {
                    for (const req of receta) {
                        const serverMatch = insumosServer.find(s => s._id === req.insumoId);
                        if (serverMatch) {
                            const stockReal = Number(serverMatch.stockActual) || 0;
                            stockLocalCache.set(serverMatch._id, stockReal);

                            const necesidadReal = req.cantidad * cantAAgregar;
                            if (stockReal < necesidadReal) {
                                alert(`🚨 ¡ATENCIÓN! \n\nEl producto "${product.nombre}" no tiene stock suficiente en el servidor para esta cantidad.`);
                            }
                        }
                    }
                })
                .catch(err => console.warn("Lag de red: Validación de fondo pendiente."));
        }
    }
}, []);
  const setCartFromOrden = (platosOrdenados = [], tipoDeSanity = 'mesa') => {
    // 🧹 Limpiamos el rastro del localStorage antes de cargar lo nuevo
   localStorage.removeItem(`${activeTenantId}_cart`);
    
    // Seteamos el tipo de orden inmediatamente
    setTipoOrden(tipoDeSanity);

    const reconstruido = platosOrdenados.map(p => ({
      _key: p._key,
      lineId: p._key || crypto.randomUUID(),
      _id: p._id || p.id || p.nombrePlato,
      nombre: p.nombrePlato,
      precio: cleanPrice(p.precioUnitario),
      cantidad: Number(p.cantidad) || 1,
      precioNum: cleanPrice(p.precioUnitario),
      subtotalNum: cleanPrice(p.precioUnitario) * (Number(p.cantidad) || 1),
      comentario: p.comentario || "",
      categoria: p.categoria || "",
      controlaInventario: p.controlaInventario || false,
      insumoVinculado: p.insumoVinculado || null,
      seImprime: p.seImprime === true,
      cantidadADescontar: p.cantidadADescontar || 0
    }));

    // Actualizamos el estado. El "Amortiguador" del useEffect de arriba 
    // se encargará de que esto no cause un parpadeo violento.
    setItems(reconstruido);
  };

 const decrease = React.useCallback((lineId) => {
  // Entramos directo al set para que la actualización sea atómica en React
  setItems(prev => {
    const idx = prev.findIndex(i => i.lineId === lineId);
    if (idx === -1) return prev; // Si no lo encuentra, no hace nada

    const copy = [...prev];
    
    // Si solo hay uno, eliminamos la línea completa del carrito
    if (copy[idx].cantidad <= 1) {
      return prev.filter(i => i.lineId !== lineId);
    } 
    
    // Si hay más de uno, restamos 1 y recalculamos el subtotal de esa línea
   else {
    const itemActual = copy[idx];
    // Si la cantidad tiene decimales (es un Kg de báscula), eliminamos la pesada completa
    if (itemActual.cantidad % 1 !== 0) {
        return prev.filter(i => i.lineId !== lineId);
    }
    
    // Si es un producto entero de restaurante, restamos 1 normal
    const nuevaCant = itemActual.cantidad - 1;
    copy[idx] = { 
        ...itemActual, 
        cantidad: nuevaCant,
        subtotalNum: Number((nuevaCant * (itemActual.precioNum || 0)).toFixed(2))
    };
    return copy;
}
  });
}, []);

const clear = React.useCallback(() => {
    const tenantId = activeTenantId;
    setItems([]);
    setPropina(0);
    setMontoManual(0);
    setTipoOrden('mesa');
    avisosDados.clear(); // 🛡️ Limpia alertas de la mesa anterior
    stockLocalCache.clear();
    localStorage.removeItem(`${tenantId}_cart`);
    localStorage.removeItem(`${tenantId}_mesa`);
    localStorage.removeItem(`${tenantId}_tipo_orden`);
  }, []);
  const clearWithStockReturn = React.useCallback(async () =>{
    // 🛡️ Lupa Senior: Como ahora no descontamos al agregar, 
    // "limpiar con devolución" es simplemente limpiar el carrito local.
    clear(); 
  }, [clear]);

const eliminarLineaConStock = React.useCallback((lineId) => {
  const tenantId = activeTenantId;
 setItems(prev => {
        const nuevoCarrito = prev.filter(it => it.lineId !== lineId);
        if (nuevoCarrito.length === 0) {
            localStorage.removeItem(`${tenantId}_cart`);
        }
        
        return nuevoCarrito;
    });
}, []);
// 🚀 BISTURÍ: Esta función limpia la memoria de stock para forzar recarga
  const refreshStockLocal = () => {
    stockLocalCache.clear();
    avisosDados.clear();
    console.log("🧹 Memoria de inventario limpia. El próximo '+' pedirá datos frescos.");
  };
  // 🧮 CÁLCULO DEL TOTAL BLINDADO
  const total = useMemo(() => {
    const subtotalProductos = items.reduce((s, it) => s + (it.precioNum * it.cantidad), 0);
    
    // Si la propina es manual (-1), ignoramos porcentajes y sumamos el monto puro
    if (propina === -1) {
      return subtotalProductos + Number(montoManual);
    }
    
    const valorPropinaPorcentaje = subtotalProductos * (propina / 100);
    return subtotalProductos + valorPropinaPorcentaje;
  }, [items, propina, montoManual]);

  // ✅ BISTURÍ: Añadimos la función que falta para arreglar el POS
  const actualizarComentario = (lineId, comentario) => {
    setItems(prev =>
      prev.map(it =>
        it.lineId === lineId ? { ...it, comentario } : it
      )
    );
  };
  const contextValue = useMemo(() => ({
      items,
      tenantId: activeTenantId,
      addProduct,
      setCartFromOrden,
      tipoOrden,     
      setTipoOrden,
      ordenActivaId, 
      setOrdenMesa,  
      ordenMesa,
      setOrdenActivaId,
      decrease,
      clear,
      clearWithStockReturn,
      eliminarLineaConStock,
      total,
      metodoPago,
      setMetodoPago,
      propina,
      setPropina,
      montoManual,
      setMontoManual,
      actualizarComentario,
      cleanPrice: cleanPrice,
     refreshStockLocal 
      }), [
      items, activeTenantId, tipoOrden, ordenActivaId, total, metodoPago, propina, montoManual, eliminarLineaConStock, refreshStockLocal, addProduct, decrease, clear, clearWithStockReturn]);
      
return (
    <CartContext.Provider value={contextValue}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);