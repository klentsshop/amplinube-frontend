'use client';
import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

export function useOrdenesRealtime(tenantId, ordenesIniciales, fetchOrdenesFrecuentes) {
    const [ordenes, setOrdenes] = useState(ordenesIniciales || []);
    const [isConnected, setIsConnected] = useState(false);
    const socketRef = useRef(null);

    // 1. Sincroniza el estado local cuando llegan los datos del fetch inicial
    useEffect(() => {
        setOrdenes(ordenesIniciales || []);
    }, [ordenesIniciales]);

    // 2. 🚀 SUSCRIPCIÓN MULTIPLEXADA VÍA RAILWAY (Cero conexiones a Supabase)
    useEffect(() => {
        if (!tenantId) return;

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

        socket.on('connect', () => setIsConnected(true));
        socket.on('disconnect', () => setIsConnected(false));

        // 🟢 ESCUCHA EL EVENTO CENTRALIZADO DE RAILWAY
        socket.on('sync_ordenes', (payload) => {
            if (!payload || !payload.eventType) {
                // Si Railway nos envía un evento genérico (ej. "RELOAD" manual), recargamos
                if (typeof fetchOrdenesFrecuentes === 'function') {
                    fetchOrdenesFrecuentes();
                }
                return;
            }

            const item = payload.new || payload.old;
            if (!item) return;

            setOrdenes(prevOrdenes => {
                const ordenIdModificada = item.id || item._id;
                
                if (payload.eventType === 'DELETE') {
                    return prevOrdenes.filter(o => (o.id || o._id) !== ordenIdModificada);
                }

                if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                    // En lugar de inyectar el item crudo de Supabase (que viene incompleto porque le faltan los platos relacionales),
                    // le pedimos a la API que traiga la mesa fresca y completa.
                    if (typeof fetchOrdenesFrecuentes === 'function') {
                        // Usamos setTimeout ligero para evitar race conditions con Supabase
                        setTimeout(() => fetchOrdenesFrecuentes(), 300);
                    }
                }

                return prevOrdenes;
            });
        });

        // 🛡️ DESCONEXIÓN: Al salir, desconecta el socket limpiamente
        return () => {
            if (socketRef.current) {
                socketRef.current.off('sync_ordenes');
                socketRef.current.off('connect');
                socketRef.current.off('disconnect');
                socketRef.current.disconnect();
                socketRef.current = null;
            }
        };
    }, [tenantId, fetchOrdenesFrecuentes]);

   // 3. Función auxiliar para emitir cambios manuales (Soluciona el fantasma de mesas cobradas)
    const emitirCambio = (tipoAccion, data) => {
        if (socketRef.current && tenantId) {
            // Si el cajero cobra/elimina (DELETE), 'data' es el ID de la orden.
            // Emitimos a Railway para que él dispare el 'sync_ordenes' a los demás celulares.
            socketRef.current.emit('orden_actualizada', {
                eventType: tipoAccion,
                tenantId: tenantId,
                old: { id: data } 
            });
        }
    };

    return { 
        ordenes, 
        setOrdenes, 
        isConnected, 
        emitirCambio 
    };
}