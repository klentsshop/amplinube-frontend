import React, { useEffect } from 'react';
import useSWR from 'swr';
import { useCart } from '@/app/context/CartContext';
import { createClient } from '@supabase/supabase-js'; // 👈 Importamos directo la librería

// 🌐 Instancia ligera para el cliente (Suscripción Realtime)
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON);

const fetcher = async (url) => {
    const separator = url.includes('?') ? '&' : '?';
    const res = await fetch(`${url}${separator}t=${Date.now()}`); 
    
    if (!res.ok) {
        console.warn("⚠️ API de Inventario no disponible. Continuando sin stock.");
        return [];
    }
    return res.json();
};

export function useInventario(tenantId, search = '') {
    const { refreshStockLocal, actualizarCacheStockMasivo } = useCart();

    const { data, error, mutate, isLoading } = useSWR(
        tenantId ? `/api/inventario/list?tenantId=${tenantId}&search=${encodeURIComponent(search.trim())}` : null,
        fetcher, 
        {
            refreshInterval: 0,          // 🛑 CRÍTICO: Desactivado. Cero llamadas repetitivas a Netlify
            revalidateOnFocus: false,
            revalidateOnMount: true,     
            dedupingInterval: 4000,      // Permite cambios instantáneos al mutar
            revalidateIfStale: false     // Elimina destellos de datos viejos en la UI
        }
    );

    // 2️⃣ 🚀 SUSCRIPCIÓN EN TIEMPO REAL DIRECTA A SUPABASE (Con depuración F12)
    useEffect(() => {
        if (!tenantId) return;

        const tenantLimpio = tenantId.toLowerCase().trim();

        const channel = supabaseClient
            .channel(`realtime-inventario-${tenantLimpio}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'inventarios',
                    filter: `tenant_id=eq.${tenantLimpio}`
                },
                (payload) => {
                    console.log('⚡ Cambio en Inventario detectado vía Realtime:', payload);
                    const insumoCambia = payload.new;
                    if (!insumoCambia) return;

                    mutate((prevData) => {
                        if (!Array.isArray(prevData)) return prevData;

                        const idModificado = insumoCambia.insumo_id || insumoCambia.id;
                        const existe = prevData.some(i => (i.id || i._id || i.insumo_id) === idModificado);

                        if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
                            if (existe) {
                                return prevData.map(item => {
                                    const itemId = item.id || item._id || item.insumo_id;
                                    if (itemId === idModificado) {
                                        return {
                                            ...item,
                                            stockActual: Number(insumoCambia.stock_actual ?? insumoCambia.stockActual ?? 0),
                                            stock_actual: Number(insumoCambia.stock_actual ?? insumoCambia.stockActual ?? 0),
                                            stockMinimo: Number(insumoCambia.stock_minimo ?? item.stockMinimo ?? 0),
                                            nombre: insumoCambia.nombre || item.nombre,
                                            updated_at: insumoCambia.updated_at
                                        };
                                    }
                                    return item;
                                });
                            } else {
                                const nuevoItem = {
                                    ...insumoCambia,
                                    _id: idModificado,
                                    id: idModificado,
                                    stockActual: Number(insumoCambia.stock_actual ?? 0),
                                    stock_actual: Number(insumoCambia.stock_actual ?? 0)
                                };
                                return [...prevData, nuevoItem];
                            }
                        }

                        return prevData;
                    }, false);
                }
            )
            .subscribe((status, err) => {
                console.log(`📡 Estado suscripción Inventario (${tenantLimpio}):`, status);
                if (err) console.error("❌ Error en suscripción Realtime:", err);
            });

        return () => {
            supabaseClient.removeChannel(channel);
        };
    }, [tenantId, mutate]);

    // 3️⃣ Carga manual / Actualización directa de stock desde el frontend
    const cargarStock = async (insumoId, cantidad, tenantId) => {
        try {
            // 🧠 ACTUALIZACIÓN OPTIMISTA:
            // Modificamos el estado local en React al instante para que el cajero vea reflejado 
            // el stock en 0 milisegundos.
            const nuevoMonto = Number(cantidad);
            if (data && Array.isArray(data)) {
                const stockOptimista = data.map(insumo => {
                    const idCoincide = (insumo.id || insumo._id || insumo.insumo_id) === insumoId;
                    if (idCoincide) {
                        const stockPrevio = Number(insumo.stockActual ?? insumo.stock_actual ?? 0);
                        const stockCalculado = stockPrevio + nuevoMonto;
                        return { 
                            ...insumo, 
                            stockActual: stockCalculado,
                            stock_actual: stockCalculado
                        };
                    }
                    return insumo;
                });
                mutate(stockOptimista, false); // Actualiza la UI de inmediato sin revalidar aún
            }

            // 📡 Petición real al servidor Next.js para persistir en BD
            const res = await fetch('/api/inventario/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ insumoId, cantidadASumar: nuevoMonto, tenantId })
            });
            
            if (res.ok) {
                if (refreshStockLocal) refreshStockLocal();
                return true;
            }
            
            await mutate(); // Si falla el servidor, revertimos al stock real
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