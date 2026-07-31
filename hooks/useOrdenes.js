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

    // 1. Fetch manual de órdenes activas (Snapshot HTTP inicial y para forzar refrescos)
    const fetchOrdenesFrecuentes = useCallback(async () => {
        if (!tenantId) return;
        try {
            const url = `/api/ordenes/list?tenantId=${encodeURIComponent(tenantId.toLowerCase().trim())}`;
            const res = await fetch(url, { method: 'GET', headers: { 'Cache-Control': 'no-store' } });
            if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
            
            const data = await res.json();
            setOrdenesIniciales(data || []);
            setErrorConexion(null);
            return data;
        } catch (err) {
            console.error("❌ Error en fetch manual de órdenes relacionales:", err);
            setErrorConexion(err);
        }
    }, [tenantId]);

    // 2. Conectamos la canalización en tiempo real vía SSE (Next.js / Supabase Multiplexor)
    const { ordenes, setOrdenes, isConnected } = useOrdenesRealtime(
        tenantId, 
        ordenesIniciales, 
        fetchOrdenesFrecuentes
    );

    // Carga inicial al montar o cambiar de tenant
    useEffect(() => {
        if (tenantId) {
            fetchOrdenesFrecuentes();
        }
    }, [tenantId, fetchOrdenesFrecuentes]);

    // 3. Operación: Guardar Orden
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
            
            // Re-sincronización con módulos transaccionales
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

    // 4. Operación: Eliminar Orden
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
            
            // Remoción optimista local (el evento SSE DELETE terminará de confirmarlo)
            setOrdenes((prev) => prev.filter((o) => (o._id || o.id) !== ordenId));
            
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

    return { 
        ordenes, 
        guardarOrden, 
        eliminarOrden, 
        refresh: fetchOrdenesFrecuentes,
        cargandoAccion, 
        errorConexion,
        isConnected // Expuesto para mostrar status de conexión en vivo
    };
}