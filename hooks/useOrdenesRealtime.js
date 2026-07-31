import { useEffect, useState, useCallback, useRef } from 'react';

/**
 * Custom Hook para gestionar Órdenes Activas en Tiempo Real mediante SSE
 * @param {string} tenantId - Identificador único del restaurante
 * @param {Array} initialOrdenes - Estado inicial de las órdenes activas
 * @param {Function} fetchOrdenesFallback - Callback opcional para sincronización manual
 */
export function useOrdenesRealtime(tenantId, initialOrdenes = [], fetchOrdenesFallback = null) {
  const [ordenes, setOrdenes] = useState(initialOrdenes);
  const [isConnected, setIsConnected] = useState(false);
  const eventSourceRef = useRef(null);

  // Sincronizar estado inicial desde props
  useEffect(() => {
    if (Array.isArray(initialOrdenes) && initialOrdenes.length > 0) {
      setOrdenes(initialOrdenes);
    }
  }, [initialOrdenes]);

  // Manejador centralizado de mutaciones en la lista de MESAS
  const handleRealtimeEvent = useCallback((eventData) => {
    // 🛡️ BISTURÍ ANTI-DUPLICACIÓN: Si el evento es un pulso de impresión de caja o un ticket,
    // LO IGNORAMOS por completo para que NUNCA cree una mesa fantasma abajo.
    if (
      eventData.tipo_accion === 'IMPRIMIR_TICKET' || 
      (typeof eventData.id === 'string' && eventData.id.startsWith('ticket-')) ||
      (typeof eventData._id === 'string' && eventData._id.startsWith('ticket-'))
    ) {
      return; 
    }

    // 1. Manejo de borrado de mesa
    if (eventData.deleted) {
      const deletedId = eventData._id || eventData.id;
      setOrdenes((prev) => prev.filter((o) => (o._id || o.id) !== deletedId));
      return;
    }

    const targetId = eventData._id || eventData.id;
    if (!targetId) return;

    // 2. Manejo de actualización o inserción de mesa
    setOrdenes((prevOrdenes) => {
      const existe = prevOrdenes.some((o) => (o._id || o.id) === targetId);
      if (existe) {
        return prevOrdenes.map((o) => ((o._id || o.id) === targetId ? eventData : o));
      }
      return [eventData, ...prevOrdenes];
    });
  }, []);

  useEffect(() => {
    if (!tenantId) return;

    const url = `/api/ordenes/listen?tenantId=${encodeURIComponent(tenantId.toLowerCase().trim())}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onopen = () => {
      setIsConnected(true);
      if (fetchOrdenesFallback) {
        fetchOrdenesFallback().then((data) => {
          if (Array.isArray(data)) setOrdenes(data);
        });
      }
    };

    es.onmessage = (event) => {
      if (event.data === 'ping' || event.data === ':ping') return;

      try {
        const payload = JSON.parse(event.data);
        if (payload.action === 'CONNECTED') return;

        handleRealtimeEvent(payload);
      } catch (err) {
        console.error('[useOrdenesRealtime] Error parseando evento SSE:', err);
      }
    };

    es.onerror = () => {
      setIsConnected(false);
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
      setIsConnected(false);
    };
  }, [tenantId, handleRealtimeEvent, fetchOrdenesFallback]);

  return {
    ordenes,
    setOrdenes,
    isConnected,
  };
}