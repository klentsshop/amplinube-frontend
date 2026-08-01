'use client';

import { useEffect, useState, useRef } from 'react';

export function useOrdenesRealtime(tenantId, initialOrdenes = [], fetchOrdenesFallback = null) {
  const [ordenes, setOrdenes] = useState(initialOrdenes);
  const [isConnected, setIsConnected] = useState(true);
  
  const fetchRef = useRef(fetchOrdenesFallback);

  // Mantenemos la referencia de la función fetch siempre actualizada sin provocar re-renders
  useEffect(() => {
    fetchRef.current = fetchOrdenesFallback;
  }, [fetchOrdenesFallback]);

  // Actualización de estado cuando las órdenes iniciales cambian
  useEffect(() => {
    if (Array.isArray(initialOrdenes)) {
      setOrdenes(initialOrdenes);
    }
  }, [initialOrdenes]);

  // 🛡️ PARACAÍDAS DE EMERGENCIA: REFRRESCO AUTOMÁTICO CADA 4 SEGUNDOS
  useEffect(() => {
    if (!tenantId) return;

    const interval = setInterval(async () => {
      if (fetchRef.current) {
        try {
          const data = await fetchRef.current();
          if (Array.isArray(data)) {
            setOrdenes(data);
          }
        } catch (e) {
          console.warn("⚠️ Error en refresco automático de emergencia:", e);
        }
      }
    }, 4000); // 4 segundos: Balance perfecto para 50 dispositivos y consumo casi cero

    return () => clearInterval(interval);
  }, [tenantId]);

  // Función dummy para mantener compatibilidad total con tus hooks existentes (useOrdenes, useOrdenHandlers)
  const emitirCambio = async () => {
    if (fetchRef.current) {
      try {
        const data = await fetchRef.current();
        if (Array.isArray(data)) setOrdenes(data);
      } catch (e) {
        console.warn("⚠️ Error al sincronizar cambio local:", e);
      }
    }
  };

  return { ordenes, setOrdenes, isConnected: true, emitirCambio };
}