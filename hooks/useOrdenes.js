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
            const query = `*[_type == "ordenActiva" && tenant == $tenantId] | order(fechaCreacion asc) {
                _id, _rev, tenant, mesa, mesero, tipoOrden, fechaCreacion, 
                imprimirSolicitada, clienteRef, datosEntrega, estacionesPendientes, platosOrdenados
            }`;
            const data = await client.fetch(query, { tenantId }, { useCdn: false });
            setOrdenes(data || []);
            setErrorConexion(null);
        } catch (err) {
            console.error("❌ Error en fetch manual de órdenes:", err);
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

        console.log(`📡 Ecosistema Reactivo activado para Lista de Órdenes. Tenant: ${tenantId}`);

        // Filtro estricto: Escucha cualquier mutación (creación, edición, borrado) de ordenActiva para este tenant
        const query = `*[_type == "ordenActiva" && tenant == $tenantId]`;
        
        const subscription = client.listen(query, { tenantId }, { includeResult: true })
            .subscribe((update) => {
                // Evaluamos el tipo de transición en la base de datos de Sanity
                if (update.transition === 'disappear') {
                    // 🗑️ Si la orden se eliminó o cobró, la removemos del estado local de inmediato
                    setOrdenes((prev) => prev.filter((o) => o._id !== update.documentId));
                } else if (update.transition === 'appear' || update.transition === 'update') {
                    const documentoMutado = update.result;
                    if (!documentoMutado) return;

                    setOrdenes((prev) => {
                        const existe = prev.some((o) => o._id === documentoMutado._id);
                        if (existe) {
                            // 🔄 Actualización quirúrgica de la mesa en la pantalla de todos
                            return prev.map((o) => o._id === documentoMutado._id ? documentoMutado : o);
                        } else {
                            // 📥 Inserción instantánea de nueva mesa en orden cronológico
                            const nuevaLista = [...prev, documentoMutado];
                            return nuevaLista.sort((a, b) => new Date(a.fechaCreacion) - new Date(b.fechaCreacion));
                        }
                    });
                }
            });

        // 🛡️ GUILLOTINA DE DESUSCRIPCIÓN ABSOLUTA AL DESMONTAR COMPONENTE
        return () => {
            if (subscription && typeof subscription.unsubscribe === 'function') {
                subscription.unsubscribe();
                console.log(`🔌 Conexión WebSocket liberada para Tenant: ${tenantId}`);
            }
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
    const eliminarOrden = async (ordenId) => {
        if (!ordenId || !tenantId) return;

        setCargandoAccion(true);
        try {
            // ✅ Petición HTTP a la API nativa sin alteraciones
            const res = await fetch('/api/ordenes/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ordenId, tenantId }),
            });
            
            if (!res.ok) throw new Error("Error al eliminar la orden");
            
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