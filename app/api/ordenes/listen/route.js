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
                        table: 'ordenes_activas'
                    },
                    async (payload) => {
                        // Evitamos procesar eventos de eliminación (DELETE) para que las tablets no pinten nulos
                        if (payload.eventType === 'DELETE') return;

                        // 🛡️ ESCUDO MULTI-TENANT 1: Verificación manual estricta en memoria de Node.js
                        const payloadTenant = (payload.new?.tenant || payload.old?.tenant)?.toLowerCase().trim();
                        if (payloadTenant !== tenantId) return;

                        const ordenId = payload.new?.id;
                        if (!ordenId) return;
                        
                       try {
                            // Consultamos la estructura completa unificada orientada a documentos desde el RPC
                            const { data: ordenCompleta } = await supabaseRealtimeClient
                                .rpc('obtener_orden_formateada_json', { p_orden_id: ordenId });

                            if (ordenCompleta) {
                                // 🛡️ DESCOMPRESIÓN DE CURSORES: Extrae cursores_estaciones e inyecta ultimoKey<ESTACION> directo en la raíz
                                let cursoresDescomprimidos = {};
                                if (ordenCompleta.cursores_estaciones) {
                                    cursoresDescomprimidos = typeof ordenCompleta.cursores_estaciones === 'string'
                                        ? JSON.parse(ordenCompleta.cursores_estaciones || '{}')
                                        : ordenCompleta.cursores_estaciones;
                                }

                                // 🛡️ BISTURÍ RELOJ SUIZO: Ordenamiento cronológico de la lista de platos en SSE
                                const listaPlatosBruta = ordenCompleta.platosOrdenados || ordenCompleta.platos_ordenados || [];
                                const platosOrdenadosCronologico = Array.isArray(listaPlatosBruta)
                                    ? [...listaPlatosBruta].sort((a, b) => {
                                        const timeA = new Date(a.created_at || a.createdAt || 0).getTime();
                                        const timeB = new Date(b.created_at || b.createdAt || 0).getTime();
                                        if (timeA !== timeB) return timeA - timeB;
                                        return String(a._key || a.line_id || '').localeCompare(String(b._key || b.line_id || ''));
                                      })
                                    : listaPlatosBruta;

                                const objetoNormalizado = {
                                    ...ordenCompleta,
                                    ...cursoresDescomprimidos,
                                    platosOrdenados: platosOrdenadosCronologico,
                                    _id: ordenCompleta._id || ordenCompleta.id || ordenId,
                                    _type: 'ordenActiva'
                                };
                                controller.enqueue(encoder.encode(`data: ${JSON.stringify(objetoNormalizado)}\n\n`));
                            }
                        } catch (err) {
                            console.error('❌ Error formateando RPC Cocina en Stream:', err);
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
                        table: 'tickets_caja_pendientes'
                    },
                    (payload) => {
                        const nuevoTicket = payload.new;
                        if (!nuevoTicket) return;

                        // 🛡️ ESCUDO MULTI-TENANT 2: Verificación manual estricta del ticket entrante
                        const ticketTenant = nuevoTicket.tenant_id?.toLowerCase().trim();
                        if (ticketTenant !== tenantId) return;

                        try {
                            // 🛡️ REPARACIÓN CABLE ROTOR: Homologamos el payload plano de Postgres al JSON que espera la APK
                            const objetoCajaNormalizado = {
                                ...nuevoTicket,
                                _id: nuevoTicket.id, // Sincronía con doc.optString("_id")
                                tenant: nuevoTicket.tenant_id,
                                tipo_orden: nuevoTicket.tipo_orden || nuevoTicket.tipo_order || 'mesa' // Paracaídas para el error de tipado de la API ventas
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