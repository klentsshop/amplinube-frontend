// 🛠️ useOrdenesRealtime.js (NATIVO DIRECTO A SUPABASE - CERO CONSUMO NETLIFY EN WEB)
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseBrowser = createClient(supabaseUrl, supabaseAnonKey);

export function useOrdenesRealtime(tenantId, initialOrdenes = [], fetchOrdenesFallback = null) {
  const [ordenes, setOrdenes] = useState(initialOrdenes);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (Array.isArray(initialOrdenes) && initialOrdenes.length > 0) {
      setOrdenes(initialOrdenes);
    }
  }, [initialOrdenes]);

  useEffect(() => {
    if (!tenantId) return;

    const cleanTenant = tenantId.toLowerCase().trim();

    // 📡 Conexión directa desde el navegador del mesero a Supabase por WebSockets
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
        async (payload) => {
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