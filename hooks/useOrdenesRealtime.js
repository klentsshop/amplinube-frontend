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

    // 🧠 BISTURÍ SENIOR: Escucha inteligente. Actualiza RAM directamente sin atacar Supabase
    socket.on('sync_ordenes', (data) => {
      if (!data) return;
      if (data.accion === 'DELETE' && data.ordenId) {
        setOrdenes(prev => prev.filter(o => (o.id || o._id) !== data.ordenId));
      } else if (data.accion === 'UPSERT' && data.orden) {
        setOrdenes(prev => {
          const existe = prev.find(o => (o.id || o._id) === (data.orden.id || data.orden._id));
          if (existe) {
            return prev.map(o => (o.id || o._id) === (data.orden.id || data.orden._id) ? data.orden : o);
          }
          return [...prev, data.orden];
        });
      } else {
        // Salvavidas: si envían un ping antiguo vacío
        refrescarOrdenes();
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [tenantId, refrescarOrdenes]);

  // 🚀 BISTURÍ SENIOR: El emisor ahora manda el paquete de datos exacto a Railway
  const emitirCambio = async (accion = 'RELOAD', dataPayload = null) => {
    // Solo el dispositivo que hizo el cambio refresca su propia DB (1 sola conexión) si no es DELETE
    if (accion === 'RELOAD') {
      await refrescarOrdenes();
    }
    if (socketRef.current && isConnected) {
      // Notifica a Railway CON EL PAYLOAD para que actúe de cartero
      const payload = { 
        tenantId, 
        accion, 
        orden: accion === 'UPSERT' ? dataPayload : null,
        ordenId: accion === 'DELETE' ? dataPayload : null
      };
      socketRef.current.emit('orden_actualizada', payload);
    }
  };

  return { ordenes, setOrdenes, isConnected, emitirCambio };
}