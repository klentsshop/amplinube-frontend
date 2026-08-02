import { useEffect, useState, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';

// URL de tu servicio desplegado en Railway
const RAILWAY_SOCKET_URL = process.env.NEXT_PUBLIC_RAILWAY_SOCKET_URL || 'https://tu-app-production.up.railway.app';

export function useOrdenesRealtime(tenantId, initialOrdenes = [], fetchOrdenesFallback = null) {
  const [ordenes, setOrdenes] = useState(initialOrdenes);
  const [isConnected, setIsConnected] = useState(false);
  
  const fetchRef = useRef(fetchOrdenesFallback);
  const socketRef = useRef(null);

  useEffect(() => {
    fetchRef.current = fetchOrdenesFallback;
  }, [fetchOrdenesFallback]);

  useEffect(() => {
    if (Array.isArray(initialOrdenes)) {
      setOrdenes(initialOrdenes);
    }
  }, [initialOrdenes]);

  const refrescarOrdenes = useCallback(async () => {
    if (fetchRef.current) {
      try {
        const data = await fetchRef.current();
        if (Array.isArray(data)) {
          setOrdenes(data);
        }
      } catch (e) {
        console.warn("⚠️ Error al sincronizar órdenes:", e);
      }
    }
  }, []);

  useEffect(() => {
    if (!tenantId) return;

    // Conexión directa a Railway (Socket.io)
    const socket = io(RAILWAY_SOCKET_URL, {
      transports: ['websocket'],
      autoConnect: true
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      // Unirse a la sala privada del restaurante
      socket.emit('join_tenant', tenantId);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    // Escuchar cambios emitiendo por otros meseros
    socket.on('sync_ordenes', () => {
      refrescarOrdenes();
    });

    return () => {
      socket.disconnect();
    };
  }, [tenantId, refrescarOrdenes]);

  // Cuando un mesero edita o cobra una orden localmente
  const emitirCambio = async () => {
    await refrescarOrdenes();
    if (socketRef.current && isConnected) {
      // Notifica a Railway para que avise a las demás pantallas del restaurante
      socketRef.current.emit('orden_actualizada', { tenantId });
    }
  };

  return { ordenes, setOrdenes, isConnected, emitirCambio };
}