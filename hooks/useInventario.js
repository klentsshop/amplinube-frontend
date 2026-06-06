import React, { useEffect } from 'react';
import useSWR from 'swr';
import { useCart } from '@/app/context/CartContext';
const fetcher = async (url) => {
    // 🚀 CONTROL ANTI-CACHÉ: Aseguramos datos reales al microsegundo.
    const separator = url.includes('?') ? '&' : '?';
    const res = await fetch(`${url}${separator}t=${Date.now()}`); 
    
    if (!res.ok) {
        console.warn("⚠️ API de Inventario no disponible (404 o 500). Continuando sin stock.");
        return []; // Devolvemos array vacío para no bloquear el POS
    }
    return res.json();
};

export function useInventario(tenantId) {
    const { refreshStockLocal, actualizarCacheStockMasivo } = useCart();
    const { data, error, mutate, isLoading } = useSWR(
        tenantId ? `/api/inventario/list?tenantId=${tenantId}` : null, 
        fetcher, 
        {
            refreshInterval: 10000,      // 🚀 Sincronización masiva de respaldo cada 30s
            revalidateOnFocus: true,
            revalidateOnMount: true,     
            dedupingInterval: 0,         // Permite cambios instantáneos al mutar
            revalidateIfStale: false     // Elimina destellos de datos viejos en la UI
        }
    );
    useEffect(() => {
        if (data && Array.isArray(data) && actualizarCacheStockMasivo) {
            actualizarCacheStockMasivo(data);
        }
    }, [data, actualizarCacheStockMasivo]);
    const cargarStock = async (insumoId, cantidad) => {
        try {
            // 🧠 ACTUALIZACIÓN OPTIMISTA (Nivel Súper Senior):
            // Modificamos el estado local en React al instante para que el cajero vea reflejado 
            // el stock en 0 milisegundos. SWR se encargará de validar por detrás con el servidor.
            const nuevoMonto = Number(cantidad);
            if (data && Array.isArray(data)) {
                const stockOptimista = data.map(insumo => {
                    if ((insumo.id === insumoId || insumo._id === insumoId)) {
                        return { ...insumo, stockActual: Number(insumo.stockActual || 0) + nuevoMonto };
                    }
                    return insumo;
                });
                mutate(stockOptimista, false); // Actualiza la UI de inmediato sin revalidar aún
            }

            // 📡 Petición real al servidor Next.js
            const res = await fetch('/api/inventario/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                // 🛡️ CORRECCIÓN: Usamos tenantId que está disponible en el entorno del hook
                body: JSON.stringify({ insumoId, cantidadASumar: nuevoMonto, tenantId })
            });
            
            if (res.ok) {
                if (refreshStockLocal) refreshStockLocal();
                await mutate(); // Revalidación y consolidación final de datos con Supabase
                return true;
            }
            
            await mutate(); // Si falla el servidor, revertimos al stock real de la BD
            return false;
        } catch (err) {
            console.error("Error actualizando stock:", err);
            await mutate(); // Revertimos en caso de fallo crítico de red
            return false;
        }
    };

    return { 
        insumos: Array.isArray(data) ? data : [], 
        cargarStock,
        cargando: isLoading,
        mutate, 
        error
    };
}