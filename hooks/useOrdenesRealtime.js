// 🛠️ hooks/useOrdenesRealtime.js (BLINDADO SSR / CERO CONSUMO NETLIFY)
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

export function useOrdenesRealtime(tenantId, initialOrdenes = [], fetchOrdenesFallback = null) {
  const [ordenes, setOrdenes] = useState(initialOrdenes);
  const [isConnected, setIsConnected] = useState(false);

  // 1. Sincronización inicial
  useEffect(() => {
    if (Array.isArray(initialOrdenes) && initialOrdenes.length > 0) {
      setOrdenes(initialOrdenes);
    }
  }, [initialOrdenes]);

  // 2. Conexión diferida anti-crash de SSR
  useEffect(() => {
    if (!tenantId) return;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    // 🛡️ Guardacostas: Evita el crash 500 en build/SSR si las variables no han cargado
    if (!supabaseUrl || !supabaseAnonKey) {
      console.warn("⚠️ [Realtime] Credenciales de Supabase no disponibles en cliente.");
      return;
    }

    const cleanTenant = tenantId.toLowerCase().trim();
    const supabaseBrowser = createClient(supabaseUrl, supabaseAnonKey);

    // 📡 Conexión directa por WebSockets
    const channel = supabaseBrowser
      .channel(`ordenes-activas-${cleanTenant}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ordenes_activas',
          filter: `tenant=eq.${cleanTenant}`
        },
        async () => {
          if (fetchOrdenesFallback) {
            const data = await fetchOrdenesFallback();
            if (Array.isArray(data)) setOrdenes(data);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setIsConnected(false);
        }
      });

    return () => {
      supabaseBrowser.removeChannel(channel);
      setIsConnected(false);
    };
  }, [tenantId, fetchOrdenesFallback]);

  return { ordenes, setOrdenes, isConnected };
}