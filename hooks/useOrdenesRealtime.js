// 🛠️ hooks/useOrdenesRealtime.js (BROADCAST ULTRA-RÁPIDO)
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabaseBrowser = (supabaseUrl && supabaseAnonKey) 
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
    })
  : null;

export function useOrdenesRealtime(tenantId, initialOrdenes = [], fetchOrdenesFallback = null) {
  const [ordenes, setOrdenes] = useState(initialOrdenes);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (Array.isArray(initialOrdenes)) setOrdenes(initialOrdenes);
  }, [initialOrdenes]);

  useEffect(() => {
    if (!tenantId || !supabaseBrowser) return;

    const cleanTenant = tenantId.toLowerCase().trim();

    // Abrimos el canal Broadcast para el restaurante
    const channel = supabaseBrowser.channel(`rt-broadcast-${cleanTenant}`, {
      config: { broadcast: { self: true } } // Todos escuchan los cambios
    });

    channel
      .on('broadcast', { event: 'ORDEN_CAMBIO' }, async () => {
        console.log("⚡ [BROADCAST]: Notificación de mesa recibida en vivo");
        if (fetchOrdenesFallback) {
          const data = await fetchOrdenesFallback();
          if (Array.isArray(data)) setOrdenes(data);
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
        } else {
          setIsConnected(false);
        }
      });

    return () => {
      supabaseBrowser.removeChannel(channel);
      setIsConnected(false);
    };
  }, [tenantId, fetchOrdenesFallback]);

  // Función para avisar a todos los dispositivos al guardar o borrar
  const emitirCambio = () => {
    if (!tenantId || !supabaseBrowser) return;
    const cleanTenant = tenantId.toLowerCase().trim();
    const channel = supabaseBrowser.channel(`rt-broadcast-${cleanTenant}`);
    channel.send({
      type: 'broadcast',
      event: 'ORDEN_CAMBIO',
      payload: { timestamp: Date.now() }
    });
  };

  return { ordenes, setOrdenes, isConnected, emitirCambio };
}