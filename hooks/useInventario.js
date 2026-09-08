import React, { useEffect, useRef } from 'react';
import useSWR from 'swr';
import { useCart } from '@/app/context/CartContext';
import { io } from 'socket.io-client'; // 👈 Reemplazamos Supabase por Socket.io

const fetcher = async (url) => {
    const separator = url.includes('?') ? '&' : '?';
    const res = await fetch(`${url}${separator}t=${Date.now()}`); 
    
    if (!res.ok) {
        console.warn("⚠️ API de Inventario no disponible. Continuando sin stock.");
        return [];
    }
    return res.json();
};

export function useInventario(tenantId, search = '', activo = false) {
    const { refreshStockLocal } = useCart();
    const socketRef = useRef(null); // Usamos useRef para mantener la misma conexión viva

    // 1️⃣ Carga limpia e instantánea al abrir el modal (Cero caché rancia)
    const { data, error, mutate, isLoading } = useSWR(
        (tenantId && activo) ? `/api/inventario/list?tenantId=${tenantId}&search=${encodeURIComponent(search.trim())}` : null,
        fetcher, 
        {
            refreshInterval: 0,          // Cero polling redundante
            revalidateOnFocus: true,     // Revalida si cambias de pestaña
            revalidateOnMount: 'always', // 🚀 OBLIGATORIO: Fuerza traer el stock fresco
            dedupingInterval: 0,         // Cero bloqueo de caché en aperturas
            revalidateIfStale: true      // Revalida si hay data almacenada previamente
        }
    );

    // 2️⃣ 🚀 SUSCRIPCIÓN MULTIPLEXADA VÍA RAILWAY (No quema conexiones de Supabase)
    useEffect(() => {
        if (!tenantId || !activo) return;

        const tenantLimpio = tenantId.toLowerCase().trim();
        const SOCKET_URL = process.env.NEXT_PUBLIC_RAILWAY_SOCKET_URL || process.env.NEXT_PUBLIC_API_URL || 'https://amplinube-sockets-production.up.railway.app';

        // Evita crear múltiples sockets si ya hay uno vivo
        if (!socketRef.current) {
            socketRef.current = io(SOCKET_URL, {
                transports: ['websocket'],
                reconnection: true
            });
        }

        const socket = socketRef.current;

        // Avisa a Railway a qué "habitación" pertenezco
        socket.emit('join_tenant', tenantLimpio);

        // Escucha el evento unificado de inventario
        socket.on('sync_inventario', (payload) => {
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
        });

        // 🛡️ DESCONEXIÓN: Al cerrar la pestaña de inventario, desconecta el socket limpiamente
        return () => {
            if (socketRef.current) {
                socketRef.current.off('sync_inventario');
                socketRef.current.disconnect();
                socketRef.current = null;
            }
        };
    }, [tenantId, activo, mutate]);

    // 3️⃣ Carga manual / Actualización directa de stock desde el frontend
    const cargarStock = async (insumoId, cantidad, tenantId) => {
        try {
            // 🧠 ACTUALIZACIÓN OPTIMISTA
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
                mutate(stockOptimista, false); 
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
            
            await mutate(); // Si falla, revertimos al stock real
            return false;
        } catch (err) {
            console.error("Error actualizando stock:", err);
            await mutate(); 
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