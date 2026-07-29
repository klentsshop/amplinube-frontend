'use client';

import { useState, useEffect, useCallback } from 'react';
import { mutate as mutateGlobal } from 'swr';
import { client } from '@/lib/sanity'; // 🛡️ Importación del cliente de Sanity nativo
import { CURRENT_TENANT } from '@/lib/config';

export function useOrdenes(providedTenantId) {
    const tenantId = (!providedTenantId || providedTenantId === 'demo') ? CURRENT_TENANT : providedTenantId;

    // 🧬 Estados nativos sustitutos de SWR
    const [ordenes, setOrdenes] = useState([]);
    const [cargandoAccion, setCargandoAccion] = useState(false);
    const [errorConexion, setErrorConexion] = useState(null);

    // ==========================================
    // 📡 ESCUDO DE EXTRACTOR REPOSITORIO (FETCH MANUAL)
    // ==========================================
    // Esta función reemplaza la llamada de red inicial y sirve para forzar refrescos manuales
    const fetchOrdenesFrecuentes = useCallback(async () => {
        if (!tenantId) return;
        try {
            // 🛡️ BISTURÍ: Consumimos la nueva API optimizada anti-N+1 de Supabase
            const url = `/api/ordenes/list?tenantId=${encodeURIComponent(tenantId.toLowerCase().trim())}`;
            const res = await fetch(url, { method: 'GET', headers: { 'Cache-Control': 'no-store' } });
            if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
            
            const data = await res.json();
            setOrdenes(data || []);
            setErrorConexion(null);
        } catch (err) {
            console.error("❌ Error en fetch manual de órdenes relacionales:", err);
            setErrorConexion(err);
        }
    }, [tenantId]);

    // ==========================================
    // 👁️ TUNEL REACTIVO WEB-SOCKET (SANITY LISTEN)
    // ==========================================
    useEffect(() => {
        if (!tenantId) return;

        // 🛡️ Carga inicial al montar o cambiar de comercio
        fetchOrdenesFrecuentes();

       // 🛡️ Sincronización inicial rápida al montar el POS o cambiar de comercio
        fetchOrdenesFrecuentes();
        console.log(`📡 Sincronización Relacional activada para Lista de Órdenes. Tenant: ${tenantId}`);

        return () => {
            console.log(`🔌 Limpieza perimetral de hook de órdenes para Tenant: ${tenantId}`);
        };
    }, [tenantId, fetchOrdenesFrecuentes]);

    // ==========================================
    // 💾 OPERACIÓN: GUARDAR ÓRDENES
    // ==========================================
    const guardarOrden = async (ordenPayload) => {
        setCargandoAccion(true);
        try {
            // ✅ Mantenemos intacta tu lógica exacta de variables originales
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
            
            // 🔄 Sincronización optimizada: ejecutamos fetch local rápido por persistencia de red
            await fetchOrdenesFrecuentes(); 

            // 🛡️ Acople exacto con useInventario y aviso a módulos transaccionales de Supabase (Intactos)
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
    // 🗑️ OPERACIÓN: ELIMINAR ÓRDENES
    // ==========================================
    // ==========================================
    // 🗑️ OPERACIÓN: ELIMINAR ÓRDENES (MIGRADO A SUPABASE ID)
    // ==========================================
    const eliminarOrden = async (ordenId) => {
        if (!ordenId || !tenantId) return;

        setCargandoAccion(true);
        try {
            // 🛡️ BISTURÍ: Apuntamos al endpoint relacional por ID con el método DELETE nativo
            const url = `/api/ordenes/${ordenId}?tenantId=${encodeURIComponent(tenantId.toLowerCase().trim())}`;
            const res = await fetch(url, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (!res.ok) throw new Error("Error al eliminar la orden en Supabase");
            
            // Forzamos remoción local inmediata por consistencia visual
            setOrdenes((prev) => prev.filter((o) => o._id !== ordenId));
            
            // 🛡️ Sincronización del ecosistema al liberar la mesa en Supabase/Inventarios
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
    // Conservamos exactamente la misma firma estructural para que MenuPanel no rompa
    return { 
        ordenes, 
        guardarOrden, 
        eliminarOrden, 
        refresh: fetchOrdenesFrecuentes, // Mapeado directo para compatibilidad heredada
        cargandoAccion, 
        errorConexion 
    };
}