'use client';

import { useState, useCallback, useEffect } from 'react';
import { mutate as mutateGlobal } from 'swr';
import { CURRENT_TENANT } from '@/lib/config';
import { useOrdenesRealtime } from './useOrdenesRealtime';

export function useOrdenes(providedTenantId) {
    const tenantId = (!providedTenantId || providedTenantId === 'demo') ? CURRENT_TENANT : providedTenantId;

    const [ordenesIniciales, setOrdenesIniciales] = useState([]);
    const [cargandoAccion, setCargandoAccion] = useState(false);
    const [errorConexion, setErrorConexion] = useState(null);

    // ==========================================
    // 📡 FETCH MANUAL DE ÓRDENES ACTIVAS
    // ==========================================
    const fetchOrdenesFrecuentes = useCallback(async () => {
        if (!tenantId) return [];

        try {
            const url = `/api/ordenes/list?tenantId=${encodeURIComponent(tenantId.toLowerCase().trim())}`;
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
    }, [tenantId]);

    // ==========================================
    // 👁️ TUNEL REACTIVO BROADCAST (SUPABASE WEBSOCKETS)
    // ==========================================
    // Conecta el navegador directo al canal Broadcast para sincronización instantánea
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

            // ⚡ REFRESCO LOCAL INMEDIATO TRAS EL POST
            await fetchOrdenesFrecuentes();

            // 📣 DISPARO DE BROADCAST EN VIVO
            // Notifica por WebSocket a TODOS los celulares de meseros y la caja
            if (typeof emitirCambio === 'function') {
                emitirCambio();
            }

            // Sincronización optimizada con los demás módulos
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
            const url = `/api/ordenes/${ordenId}?tenantId=${encodeURIComponent(tenantId.toLowerCase().trim())}`;
            const res = await fetch(url, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' }
            });

            if (!res.ok) throw new Error("Error al eliminar la orden en Supabase");

            // 🛡️ BISTURÍ ANTI-MESAS FANTASMA: Evaluamos _id e id simultáneamente
            setOrdenes((prev) => prev.filter((o) => (o._id || o.id) !== ordenId));

            // 📣 DISPARO DE BROADCAST EN VIVO TRAS ELIMINAR/COBRAR
            if (typeof emitirCambio === 'function') {
                emitirCambio();
            }

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
    // ✅ RETORNO COMPLETO SIN DEGRADAR VARIABLES
    // ==========================================
    return { 
        ordenes, 
        guardarOrden, 
        eliminarOrden, 
        refresh: fetchOrdenesFrecuentes,
        cargandoAccion, 
        errorConexion,
        isConnected // Expuesto para monitorear el estado del WebSocket en pantalla
    };
}