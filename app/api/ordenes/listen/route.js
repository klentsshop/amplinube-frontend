import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId')?.toLowerCase().trim();

    if (!tenantId) {
        return new Response('Missing tenantId', { status: 400 });
    }

    // 🚀 SOLUCIÓN SENIOR: Instancia fresca y aislada por petición para evitar colisiones de canales en RAM
    const supabaseRealtimeClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY, // O tu llave anon si no usas RLS estricto
        {
            auth: { persistSession: false }
        }
    );

    const encoder = new TextEncoder();

    // 🌊 Inicializamos el canal de flujo continuo (Server-Sent Events)
    const stream = new ReadableStream({
        start(controller) {
            // Envía un pulso de vida (keep-alive) cada 20 segundos para evitar que Claro/Movistar/Tigo congelen el socket
            const keepAlive = setInterval(() => {
                try {
                    controller.enqueue(encoder.encode("data: ping\n\n"));
                } catch (e) {
                    clearInterval(keepAlive);
                }
            }, 20000);

           // 🎯 CANAL 1: ESCUCHA COCINA/BARRA (ordenes_activas)
            const channelCocina = supabaseRealtimeClient
                .channel(`realtime_cocina_${tenantId}`)
                .on(
                    'postgres_changes',
                    { 
                        event: '*', 
                        schema: 'public', 
                        table: 'ordenes_activas',
                        filter: `tenant=eq.${tenantId}` // 🛡️ FILTRO NATIVO EN POSTGRES
                    },
                    async (payload) => {
                        if (payload.eventType === 'DELETE') return;

                        const ordenId = payload.new?.id;
                        if (!ordenId) return;
                        
                        try {
                            // Consultamos de forma paralela garantizando filtro de tenant en las 3 tablas
                            const [ordenRes, platosRes, pendientesRes] = await Promise.all([
                                supabaseRealtimeClient.from('ordenes_activas').select('*').eq('id', ordenId).eq('tenant', tenantId).maybeSingle(),
                                supabaseRealtimeClient.from('platos_ordenados').select('*').eq('orden_id', ordenId).eq('tenant', tenantId).order('created_at', { ascending: true }),
                                supabaseRealtimeClient.from('estaciones_pendientes').select('estacion').eq('orden_id', ordenId).eq('tenant', tenantId)
                            ]);

                            const ordenRow = ordenRes.data;
                            if (!ordenRow) return;

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

                            const objetoNormalizado = {
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

                            controller.enqueue(encoder.encode(`data: ${JSON.stringify(objetoNormalizado)}\n\n`));
                        } catch (err) {
                            console.error('❌ Error formateando Cocina en Stream:', err);
                        }
                    }
                )
                .subscribe();
            // 🎯 CANAL 2: ESCUCHA PULSOS DE CAJA Y REIMPRESIONES (tickets_caja_pendientes)
            const channelCaja = supabaseRealtimeClient
                .channel(`realtime_caja_${tenantId}`)
                .on(
                    'postgres_changes',
                    { 
                        event: 'INSERT', 
                        schema: 'public', 
                        table: 'tickets_caja_pendientes',
                        filter: `tenant_id=eq.${tenantId}` // 🛡️ FILTRO NATIVO EN POSTGRES
                    },
                    (payload) => {
                        const nuevoTicket = payload.new;
                        if (!nuevoTicket) return;

                        try {
                            const objetoCajaNormalizado = {
                                ...nuevoTicket,
                                _id: nuevoTicket.id,
                                tenant: nuevoTicket.tenant_id,
                                tipo_orden: nuevoTicket.tipo_orden || nuevoTicket.tipo_order || 'mesa'
                            };

                            controller.enqueue(encoder.encode(`data: ${JSON.stringify(objetoCajaNormalizado)}\n\n`));
                        } catch (err) {
                            console.error('❌ Error formateando payload Caja en Stream:', err);
                        }
                    }
                )
                .subscribe();

            // 🧹 LIMPIEZA ATÓMICA DE SOCKETS: Cuando la tablet se desconecta o aborta, destruimos los listeners de RAM inmediatamente
            request.signal.addEventListener('abort', () => {
                clearInterval(keepAlive);
                supabaseRealtimeClient.removeChannel(channelCocina);
                supabaseRealtimeClient.removeChannel(channelCaja);
                try {
                    controller.close();
                } catch (e) {}
            });
        }
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no', // 🛡️ ORDEN CRÍTICA: Desactiva el almacenamiento en búfer en Nginx/Vercel/Netlify
        },
    });
}
