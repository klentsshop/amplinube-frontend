import useSWR, { mutate as mutateGlobal } from 'swr';
import { useState } from 'react';
import { CURRENT_TENANT } from '@/lib/config';

const fetcher = (url) => fetch(url).then((res) => {
    if (!res.ok) throw new Error('Error al obtener datos');
    return res.json();
});
// ✅ DESPUÉS (Quirúrgico):
export function useOrdenes(providedTenantId) {
    const tenantId = (!providedTenantId || providedTenantId === 'demo') ? CURRENT_TENANT : providedTenantId;
    const { data: ordenes = [], mutate, error } = useSWR(tenantId ? `/api/ordenes/list?tenantId=${tenantId}` : null, fetcher, {
        refreshInterval: 8000, 
        revalidateOnFocus: false, // Evita bombardeos al tocar la pantalla si ya está en bucle
        revalidateOnReconnect: true,
        dedupingInterval: 3000,       
        revalidateIfStale: true,
        
        // 🛡️ GUILLOTINA SENIOR ANTI-CONSUMO FANTASMA:
        // 1. Si la tablet se bloquea, se apaga o cambian de pestaña, detiene el bucle de 8s de inmediato.
        isPaused: () => {
            if (typeof document !== 'undefined' && document.hidden) {
                return true; // Congela el pooling a cero requests
            }
            return false;
        }
    });

    const [cargandoAccion, setCargandoAccion] = useState(false);

    const guardarOrden = async (ordenPayload) => {
        setCargandoAccion(true);
        try {
            // ✅ TODA TU LÓGICA DE VARIABLES ORIGINAL SE MANTIENE
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
            
            // Sincronizamos mesas
           await mutate(); 

            // 🛡️ Cirugía: Acople exacto con useInventario y aviso a módulos de Supabase
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

    const eliminarOrden = async (ordenId) => {
        if (!ordenId || !tenantId) return;

        try {
            // ✅ Mantenemos la petición de borrado exactamente igual
            const res = await fetch('/api/ordenes/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ordenId, tenantId }),
            });
            
            if (!res.ok) throw new Error("Error al eliminar la orden");
            
            await mutate(); 
            
            // 🛡️ Cirugía: Sincronización del ecosistema al liberar la mesa
            if (tenantId) {
                mutateGlobal(`/api/inventario/list?tenantId=${tenantId}`);
                mutateGlobal(`/api/ventas?tenantId=${tenantId}`);
                mutateGlobal(`/api/clientes/list?tenantId=${tenantId}`);
            }

        } catch (error) {
            console.error("❌ Error eliminarOrden:", error);
        }
    };

    // ✅ NO SE OMITE NINGUNA VARIABLE DE RETORNO
    return { ordenes, guardarOrden, eliminarOrden, refresh: mutate, cargandoAccion, errorConexion: error };
}