'use client';

import { useState, useCallback, useEffect } from 'react';
import { mutate as mutateGlobal } from 'swr';
import { CURRENT_TENANT } from '@/lib/config';
import { useOrdenesRealtime } from './useOrdenesRealtime';

export function useOrdenes(providedTenantId) {
  const tenantId = (!providedTenantId || providedTenantId === 'demo') ? CURRENT_TENANT : providedTenantId;
  const cleanTenant = tenantId ? tenantId.toLowerCase().trim() : '';

  const [ordenesIniciales, setOrdenesIniciales] = useState([]);
  const [cargandoAccion, setCargandoAccion] = useState(false);
  const [errorConexion, setErrorConexion] = useState(null);

  // Fetch memorizado sin re-instanciaciones
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
      console.error("❌ Error en fetch manual de órdenes:", err);
      setErrorConexion(err);
      return [];
    }
  }, [tenantId, cleanTenant]);

  // Hook de tiempo real centralizado
  const { ordenes, setOrdenes, isConnected, emitirCambio } = useOrdenesRealtime(
    tenantId, 
    ordenesIniciales, 
    fetchOrdenesFrecuentes
  );

  useEffect(() => {
    if (tenantId) {
      fetchOrdenesFrecuentes();
    }
  }, [tenantId, fetchOrdenesFrecuentes]);

  // Guardar Ordenes
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

      await fetchOrdenesFrecuentes();

      // Emitir usando el canal abierto persistente
      await emitirCambio();

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

  // Eliminar u Ordenes Cobradas
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

      setOrdenes((prev) => prev.filter((o) => (o._id || o.id) !== ordenId));

      // Emitir usando el canal abierto persistente
      await emitirCambio();

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
    isConnected,
    emitirCambio 
  };
}