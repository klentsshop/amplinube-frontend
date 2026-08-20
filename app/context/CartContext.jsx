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
  const [clienteActivo, setClienteActivo] = useState(null);
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

    // 2. 🛡️ BISTURÍ SUPABASE/SANITY: Identificamos si son platos de una orden persistida
    const tienePlatosGuardados = items.some(it => it.esDeOrdenGuardada || it._key || it.orden_id);
    const tienePlatosNuevos = items.some(it => !it.esDeOrdenGuardada && !it._key && !it.orden_id);

    const saveTimeout = setTimeout(() => {
      // 🚨 LA REGLA DE ORO CONTRA DUPLICADOS:
      // Si no hay una orden activa registrada pero los platos provienen de la BD, bloqueamos la creación fantasma.
      if (tienePlatosGuardados && !tienePlatosNuevos && !ordenActivaId) {
          console.warn("🚫 [BLOQUEO_FANTASMA]: Evitando creación de Mesa 0 duplicada.");
          return; 
      }

      // 3. Guardado normal en el disco local
      localStorage.setItem(`${tenantId}_cart`, JSON.stringify(items));
      localStorage.setItem(`${tenantId}_tipo_orden`, tipoOrden || 'mesa');
    }, 150);

    return () => clearTimeout(saveTimeout);
    
    // 🛡️ RECUERDA: Agregamos ordenActivaId a las dependencias para que el radar funcione
  }, [items, tipoOrden, ordenActivaId, CART_KEY, TYPE_KEY]);

  // 🚀 CONECTOR RELACIONAL: Memoriza Stock Actual + stock_minimo de Supabase
  const actualizarCacheStockMasivo = React.useCallback((listaInsumosSupabase) => {
      if (!Array.isArray(listaInsumosSupabase)) return;
      listaInsumosSupabase.forEach(insumo => {
          const idReal = insumo.id || insumo._id || insumo.insumo_id;
          if (idReal) {
              stockLocalCache.set(idReal, {
                  stockActual: Number(insumo.stockActual ?? insumo.stock_actual ?? 0),
                  stockMinimo: Number(insumo.stockMinimo ?? insumo.stock_minimo ?? 5) // 👈 Columna exacta de Supabase
              });
          }
      });
  }, [stockLocalCache]);
  const addProduct = React.useCallback(async (product, cantidadManual = null) => {
    const pId = product._id || product.id;
    const precioNum = typeof product.precio === 'number' ? product.precio : cleanPrice(product.precio);
    const cantAAgregar = cantidadManual !== null ? Number(cantidadManual) : 1;

    // 🛑 ESCUDO PREVENTIVO ANTI-SOBREVENTA (Intercepta antes de añadir)
    if (product.controlaInventario) {
        const receta = (product.recetaInsumos || product.insumosReceta || []).length > 0 
            ? (product.recetaInsumos || product.insumosReceta) 
            : (product.insumoVinculado?._ref || product.insumoId || product.insumoVinculadoRef ? [{ 
                insumoId: product.insumoVinculado?._ref || product.insumoId || product.insumoVinculadoRef, 
                cantidad: Number(product.cantidadADescontar) || 1 
              }] : []);

        if (receta.length > 0) {
            for (const rec of receta) {
                const infoInsumo = stockLocalCache.get(rec.insumoId);
                
                if (infoInsumo !== undefined) {
                    // Mapeo defensivo por si infoInsumo es objeto o número legado
                    const stockDisponible = typeof infoInsumo === 'object' ? infoInsumo.stockActual : Number(infoInsumo);
                    const stockMinimoBD = typeof infoInsumo === 'object' ? infoInsumo.stockMinimo : 5;

                    // Calculamos cuánto insumo ya está comprometido por este producto en el carrito actual
                    const yaEnCarrito = items.reduce((acc, it) => {
                        if ((it._id === pId || it.id === pId)) {
                            return acc + (it.cantidad * rec.cantidad);
                        }
                        return acc;
                    }, 0);

                    const necesidadTotal = yaEnCarrito + (rec.cantidad * cantAAgregar);

                    // 🛑 1. FRENAZO SI SE AGOTA COMPLETAMENTE
                    if (stockDisponible < necesidadTotal) {
                        alert(`🚫 AGOTADO EN COCINA: No puedes agregar más "${product.nombre || product.nombrePlato}". Quedan ${stockDisponible} unidades disponibles en el inventario.`);
                        return; 
                    }

                    // ⚠️ 2. ALERTA DE STOCK MÍNIMO BASADA EN LA COLUMNA DE SUPABASE
                    const stockRestante = stockDisponible - necesidadTotal;
                    if (stockRestante <= stockMinimoBD && !avisosDados.has(pId)) {
                        avisosDados.add(pId); // Marcamos el aviso para evitar disparos repetitivos
                        alert(`⚠️ ¡ATENCIÓN MESERO!: "${product.nombre || product.nombrePlato}" ha alcanzado el límite mínimo (${stockRestante} unidades restantes).`);
                    }
                }
            }
        }
    }

setItems(prev => {
    const esPesado = cantidadManual !== null;
    const existingIdx = !esPesado ? prev.findIndex(it => 
      (it._id || it.id) === pId && (it.comentario === (product.comentario || '')) && !it._key 
    ) : -1;

    if (existingIdx !== -1) {
        const copy = [...prev];
        const itemActual = copy[existingIdx];
        const nuevaCantidad = itemActual.cantidad + cantAAgregar;
        
        copy[existingIdx] = { 
            ...itemActual,           
            ...product,
            // 🌟 Si el producto es por peso o tiene decimales, no lo redondeamos a entero
            cantidad: product.esVentaPorPeso ? Number(nuevaCantidad) : Math.round(nuevaCantidad), 
            subtotalNum: Number((nuevaCantidad * precioNum).toFixed(2))
        };
        return copy;
    }

    // ✅ AHORA (Entra de PRIMERO arriba):
    const catUuidLimpio = typeof product.categoria === 'object' ? (product.categoria?._ref || product.categoria?._id || product.categoria?.id) : product.categoria;
    const catNombreLimpio = String(product.categoriaNombre || product.categoriaLabel || product.categoria || "").toString().toUpperCase().trim();

    return [{ 
      ...product, 
      _id: pId, 
      lineId: crypto.randomUUID(), 
      cantidad: Number(cantAAgregar), 
      precioNum, 
      precioCosto: Number(product.precioCosto || 0),
      subtotalNum: Number((precioNum * cantAAgregar).toFixed(2)), 
      comentario: product.comentario || '', 
      categoria: String(catUuidLimpio || "").trim().toLowerCase(), // 🛡️ UUID Relacional
      categoriaNombre: catNombreLimpio,                             // 🖨️ Nombre Legible Impresión
      categoriaLabel: catNombreLimpio,
      seImprime: product.seImprime ?? true 
    }, ...prev];
});
  }, [items, stockLocalCache, cleanPrice]);
  const setCartFromOrden = (platosOrdenados = [], tipoDeOrdenBD = 'mesa') => {
    // 🧹 Limpiamos el rastro del localStorage antes de cargar lo nuevo
    localStorage.removeItem(`${activeTenantId}_cart`);
    
    // Seteamos el tipo de orden inmediatamente
    setTipoOrden(tipoDeOrdenBD);

    const reconstruido = platosOrdenados.map(p => {
      const pId = p.id || p._id || p.producto_id || p.nombrePlato || p.nombre;
      const nombreFinal = p.nombrePlato || p.nombre_plato || p.nombre || "PLATO";
      const precioUnit = cleanPrice(p.precioUnitario ?? p.precio_unitario ?? p.precio ?? 0);
      const cant = Number(p.cantidad) || 1;

      return {
        ...p,
        _key: p._key || p.id,
        lineId: p.lineId || p._key || p.id || crypto.randomUUID(),
        _id: pId,
        id: pId,
        nombre: nombreFinal,
        nombrePlato: nombreFinal,
        precio: precioUnit,
        precioCosto: Number(p.precioCosto || p.precio_costo || 0),
        cantidad: cant,
        precioNum: precioUnit,
        subtotalNum: Number((precioUnit * cant).toFixed(2)),
        comentario: p.comentario || "",
        categoria: String(p.categoria || "").trim().toLowerCase(), // 🛡️ UUID Relacional
        categoriaNombre: String(p.categoriaNombre || p.categoriaLabel || p.categoria_label || p.categoria || "").toString().toUpperCase().trim(), // 🖨️ Nombre Legible Impresión
        categoriaLabel: String(p.categoriaNombre || p.categoriaLabel || p.categoria_label || p.categoria || "").toString().toUpperCase().trim(),
        controlaInventario: p.controlaInventario === true || p.controla_inventario === true,
        insumoVinculado: p.insumoVinculado || p.insumo_id || null,
        seImprime: p.seImprime !== false && p.se_imprime !== false,
        cantidadADescontar: Number(p.cantidadADescontar || p.cantidad_a_descontar || 0),
        esVentaPorPeso: p.esVentaPorPeso === true || p.es_venta_por_peso === true,
        esDeOrdenGuardada: true
      };
    });

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
    setClienteActivo(null);
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
  let nuevoCarrito = [];
 setItems(prev => {
       nuevoCarrito = prev.filter(it => it.lineId !== lineId);
      if (nuevoCarrito.length === 0) {
          localStorage.removeItem(`${tenantId}_cart`);
      }
      return nuevoCarrito;
  });
  return nuevoCarrito; // 👈 ESTO ES LO QUE FALTABA
}, [activeTenantId]);
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
      clienteActivo,      
      setClienteActivo,
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
     refreshStockLocal,
      actualizarCacheStockMasivo
      }), [
      items, activeTenantId, clienteActivo,tipoOrden, ordenActivaId, total, metodoPago, propina, montoManual, eliminarLineaConStock, refreshStockLocal, addProduct, decrease, clear, clearWithStockReturn, actualizarCacheStockMasivo]);
      
return (
    <CartContext.Provider value={contextValue}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);