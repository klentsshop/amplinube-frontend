import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!globalThis.__tenant_broadcaster__) {
    globalThis.__tenant_broadcaster__ = {
        listeners: new Map(), // tenantId -> Set<clientAdapter>
        channels: new Map(),   // tenantId -> { channelCocina, channelCaja }
    };
}

const broadcasterState = globalThis.__tenant_broadcaster__;

function broadcastToTenant(tenantId, rawPayload) {
    const clients = broadcasterState.listeners.get(tenantId);
    if (!clients || clients.size === 0) return;

    // Transmitimos exactamente el objeto normalizado que la APK/Impresora espera
    const message = `data: ${JSON.stringify(rawPayload)}\n\n`;
    for (const client of clients) {
        try {
            client.write(message);
        } catch (err) {
            console.error(`[Broadcaster] Error enviando a cliente SSE en tenant ${tenantId}:`, err);
        }
    }
}

async function fetchOrdenCompleta(supabase, ordenId, tenantId) {
    const [ordenRes, platosRes, pendientesRes] = await Promise.all([
        supabase.from('ordenes_activas').select('*').eq('id', ordenId).eq('tenant', tenantId).maybeSingle(),
        supabase.from('platos_ordenados').select('*').eq('orden_id', ordenId).eq('tenant', tenantId).order('created_at', { ascending: true }),
        supabase.from('estaciones_pendientes').select('estacion').eq('orden_id', ordenId).eq('tenant', tenantId)
    ]);

    const ordenRow = ordenRes.data;
    if (!ordenRow) return null;

    let cursoresDescomprimidos = {};
    if (ordenRow.cursores_estaciones) {
        cursoresDescomprimidos = typeof ordenRow.cursores_estaciones === 'string'
            ? JSON.parse(ordenRow.cursores_estaciones || '{}')
            : ordenRow.cursores_estaciones;
    }

    const misPlatos = (platosRes.data || []).map(p => ({
        _key: p.line_id,
        _id: p.plato_id,
        nombrePlato: p.nombre_plato,
        cantidad: Number(p.cantidad || 0),
        precioUnitario: Number(p.precio_unitario || 0),
        subtotal: Number(p.subtotal || 0),
        comentario: p.comentario || "",
        categoria: p.categoria || "",
        created_at: p.created_at
    }));

    const misEstaciones = (pendientesRes.data || []).map(e => e.estacion);

    // Mantenemos la firma idéntica a tu código original
    return {
        _id: ordenRow.id,
        id: ordenRow.id,
        _type: 'ordenActiva',
        tenant: ordenRow.tenant,
        mesa: ordenRow.mesa,
        mesero: ordenRow.mesero || 'Caja',
        tipoOrden: ordenRow.tipo_orden,
        fechaCreacion: ordenRow.fecha_creacion,
        ultimaActualizacion: ordenRow.ultima_actualizacion,
        imprimirSolicitada: ordenRow.imprimir_solicitada,
        imprimirCliente: ordenRow.imprimir_cliente,
        clienteRef: ordenRow.cliente_ref ? JSON.parse(ordenRow.cliente_ref) : null,
        datosEntrega: ordenRow.datos_entrega,
        platosOrdenados: misPlatos,
        estacionesPendientes: misEstaciones,
        ...cursoresDescomprimidos
    };
}

function subscribeTenantChannel(tenantId) {
    if (broadcasterState.channels.has(tenantId)) return;

    const supabase = createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false },
    });

    console.log(`[Broadcaster] 🚀 Abriendo canal dual (Cocina + Caja) para tenant: ${tenantId}`);

    // CANAL 1: ESCUCHA COCINA/BARRA (ordenes_activas)
    const channelCocina = supabase
        .channel(`realtime_cocina_${tenantId}`)
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'ordenes_activas', filter: `tenant=eq.${tenantId}` },
            async (payload) => {
                if (payload.eventType === 'DELETE') {
                    // Notificamos eliminación para limpiar mesas en el Front
                    broadcastToTenant(tenantId, { _id: payload.old?.id, id: payload.old?.id, deleted: true });
                    return;
                }

                const ordenId = payload.new?.id;
                if (!ordenId) return;

                const objetoNormalizado = await fetchOrdenCompleta(supabase, ordenId, tenantId);
                if (objetoNormalizado) {
                    broadcastToTenant(tenantId, objetoNormalizado);
                }
            }
        )
        .subscribe();

    // CANAL 2: ESCUCHA PULSOS DE CAJA Y REIMPRESIONES (tickets_caja_pendientes)
    const channelCaja = supabase
        .channel(`realtime_caja_${tenantId}`)
        .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'tickets_caja_pendientes', filter: `tenant_id=eq.${tenantId}` },
            (payload) => {
                const nuevoTicket = payload.new;
                if (!nuevoTicket) return;

                const objetoCajaNormalizado = {
                    ...nuevoTicket,
                    _id: nuevoTicket.id,
                    tenant: nuevoTicket.tenant_id,
                    tipo_orden: nuevoTicket.tipo_orden || nuevoTicket.tipo_order || 'mesa'
                };

                // Transmite el pulso exacto para la impresora de caja
                broadcastToTenant(tenantId, objetoCajaNormalizado);
            }
        )
        .subscribe();

    broadcasterState.channels.set(tenantId, { supabase, channelCocina, channelCaja });
}

function unsubscribeTenantChannelIfEmpty(tenantId) {
    const clients = broadcasterState.listeners.get(tenantId);
    if (!clients || clients.size === 0) {
        const tenantChannels = broadcasterState.channels.get(tenantId);
        if (tenantChannels) {
            console.log(`[Broadcaster] 🧹 Cerrando canales de Supabase para tenant: ${tenantId}`);
            const { supabase, channelCocina, channelCaja } = tenantChannels;
            if (channelCocina) supabase.removeChannel(channelCocina);
            if (channelCaja) supabase.removeChannel(channelCaja);
            broadcasterState.channels.delete(tenantId);
        }
        broadcasterState.listeners.delete(tenantId);
    }
}

export function registerTenantListener(tenantId, client) {
    if (!tenantId) return () => {};

    if (!broadcasterState.listeners.has(tenantId)) {
        broadcasterState.listeners.set(tenantId, new Set());
    }

    const clients = broadcasterState.listeners.get(tenantId);
    clients.add(client);

    subscribeTenantChannel(tenantId);

    return () => {
        clients.delete(client);
        unsubscribeTenantChannelIfEmpty(tenantId);
    };
}