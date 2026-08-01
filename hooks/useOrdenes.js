'use client';

import { useState, useCallback, useEffect } from 'react';
import { mutate as mutateGlobal } from 'swr';
import { CURRENT_TENANT } from '@/lib/config';
import { useOrdenesRealtime } from './useOrdenesRealtime';
import { createClient } from '@supabase/supabase-js';

// 🌐 Cliente Supabase de Navegador para Broadcast Directo (Evita el bloqueo de Netlify)
const supabaseBrowser = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export function useOrdenes(providedTenantId) {
    const tenantId = (!providedTenantId || providedTenantId === 'demo') ? CURRENT_TENANT : providedTenantId;
    const cleanTenant = tenantId ? tenantId.toLowerCase().trim() : '';

    const [ordenesIniciales, setOrdenesIniciales] = useState([]);
    const [cargandoAccion, setCargandoAccion] = useState(false);
    const [errorConexion, setErrorConexion] = useState(null);

    // ==========================================
    // 📡 FETCH MANUAL DE ÓRDENES ACTIVAS
    // ==========================================
    const fetchOrdenesFrecuentes = useCallback(async () => {
        if (!tenantId) return [];

        try {
            const url = `/api/ordenes/list?tenantId=${encodeURIComponent(cleanTenant)}`;
            const res = await fetch(url, { method: 'GET', headers: { 'Cache-Control': 'no-store' } });

            if (!res.ok) throw new Error(`HTTP Error ${res.status}`);

            const data = await res.json();
            const listaLimpia = Array.isArray(data) ? data : [];
            
            setOrdenesIniciales(listaLimpia);
            setErrorConexion(null);
            return listaLimpia;
        } catch (err) {
            console.error("❌ Error en fetch manual de órdenes relacionales:", err);
            setErrorConexion(err);
            return [];
        }
    }, [tenantId, cleanTenant]);

    // ==========================================
    // 👁️ TÚNEL REACTIVO BROADCAST (SUPABASE WEBSOCKETS)
    // ==========================================
    const { ordenes, setOrdenes, isConnected, emitirCambio } = useOrdenesRealtime(
        tenantId, 
        ordenesIniciales, 
        fetchOrdenesFrecuentes
    );

    // Sincronización inicial al montar el POS o cambiar de comercio
    useEffect(() => {
        if (tenantId) {
            fetchOrdenesFrecuentes();
        }
    }, [tenantId, fetchOrdenesFrecuentes]);

    // ==========================================
    // 🚀 DISPARADOR DIRECTO DESDE EL CLIENTE (A PRUEBA DE NETLIFY)
    // ==========================================
    const dispararBroadcastCliente = async () => {
        try {
            if (typeof emitirCambio === 'function') {
                emitirCambio();
            }
            // Canal directo de cliente a cliente vía Supabase (Netlify no interviene aquí)
            const channel = supabaseBrowser.channel(`rt-broadcast-${cleanTenant}`);
            await channel.subscribe();
            await channel.send({
                type: 'broadcast',
                event: 'ORDEN_CAMBIO',
                payload: { timestamp: Date.now() }
            });
            supabaseBrowser.removeChannel(channel);
        } catch (e) {
            console.error("⚠️ Error disparando broadcast nativo desde cliente:", e);
        }
    };

    // ==========================================
    // 💾 OPERACIÓN: GUARDAR ÓRDENES
    // ==========================================
    const guardarOrden = async (ordenPayload) => {
        setCargandoAccion(true);

        try {
            const payload = {
                ...ordenPayload,
                tenant: tenantId,
                estado: ordenPayload.estado || 'abierta',
                metodoPago: ordenPayload.metodoPago || 'efectivo',
                imprimirSolicitada: ordenPayload.imprimirSolicitada !== undefined ? ordenPayload.imprimirSolicitada : true,
                imprimirCliente: ordenPayload.imprimirCliente !== undefined ? ordenPayload.imprimirCliente : false,
                ultimaActualizacion: new Date().toISOString()
            };

            const res = await fetch('/api/ordenes/list', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!res.ok) throw new Error("Error al guardar en servidor");
            const data = await res.json();

            // ⚡ REFRESCO LOCAL INMEDIATO
            await fetchOrdenesFrecuentes();

            // 📣 DISPARO DE BROADCAST DIRECTO DESDE EL NAVEGADOR
            await dispararBroadcastCliente();

            if (tenantId) {
                mutateGlobal(`/api/inventario/list?tenantId=${tenantId}`);
                mutateGlobal(`/api/ventas?tenantId=${tenantId}`);
                mutateGlobal(`/api/clientes/list?tenantId=${tenantId}`);
            }

            return data;
        } catch (err) {
            console.error("❌ Error guardarOrden:", err);
            throw err;
        } finally {
            setCargandoAccion(false);
        }
    };

    // ==========================================
    // 🗑️ OPERACIÓN: ELIMINAR / COBRAR ÓRDENES
    // ==========================================
    const eliminarOrden = async (ordenId) => {
        if (!ordenId || !tenantId) return;

        setCargandoAccion(true);

        try {
            const url = `/api/ordenes/${ordenId}?tenantId=${encodeURIComponent(cleanTenant)}`;
            const res = await fetch(url, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' }
            });

            if (!res.ok) throw new Error("Error al eliminar la orden en Supabase");

            // 🛡️ BISTURÍ ANTI-MESAS FANTASMA
            setOrdenes((prev) => prev.filter((o) => (o._id || o.id) !== ordenId));

            // 📣 DISPARO DE BROADCAST DIRECTO DESDE EL NAVEGADOR
            await dispararBroadcastCliente();

            if (tenantId) {
                mutateGlobal(`/api/inventario/list?tenantId=${tenantId}`);
                mutateGlobal(`/api/ventas?tenantId=${tenantId}`);
                mutateGlobal(`/api/clientes/list?tenantId=${tenantId}`);
            }

        } catch (error) {
            console.error("❌ Error eliminarOrden:", error);
        } finally {
            setCargandoAccion(false);
        }
    };

    // ==========================================
    // ✅ RETORNO COMPLETO
    // ==========================================
    return { 
        ordenes, 
        guardarOrden, 
        eliminarOrden, 
        refresh: fetchOrdenesFrecuentes,
        cargandoAccion, 
        errorConexion,
        isConnected 
    };
}