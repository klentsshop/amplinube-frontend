import { useEffect, useState, useCallback, useRef } from 'react';

export function useOrdenesRealtime(tenantId, initialOrdenes = [], fetchOrdenesFallback = null) {
  const [ordenes, setOrdenes] = useState(initialOrdenes);
  const [isConnected, setIsConnected] = useState(false);
  const eventSourceRef = useRef(null);

  // Sincronizar snapshot inicial
  useEffect(() => {
    if (Array.isArray(initialOrdenes) && initialOrdenes.length > 0) {
      setOrdenes(initialOrdenes);
    }
  }, [initialOrdenes]);

  const handleRealtimeEvent = useCallback((eventData) => {
    // Si viene la bandera deleted: true desde el broadcaster
    if (eventData.deleted) {
      const deletedId = eventData._id || eventData.id;
      setOrdenes((prev) => prev.filter((o) => (o._id || o.id) !== deletedId));
      return;
    }

    const targetId = eventData._id || eventData.id;
    if (!targetId) return;

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

    // Apunta exactamente a tu API Route SSE multiplexada
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
      if (event.data === 'ping') return;

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