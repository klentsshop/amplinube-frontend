import { registerTenantListener } from '@/lib/tenantBroadcaster';

export const dynamic = 'force-dynamic';

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId')?.toLowerCase().trim();

    if (!tenantId || tenantId === 'undefined') {
        return new Response('Missing or invalid tenantId', { status: 400 });
    }

    let unbindListener = () => {};
    let keepAliveInterval = null;

    const stream = new ReadableStream({
        start(controller) {
            const encoder = new TextEncoder();

            // Adaptador transparente: entrega los chunks directos al flujo HTTP
            const clientAdapter = {
                write: (chunk) => {
                    try {
                        controller.enqueue(encoder.encode(chunk));
                    } catch (e) {
                        // El cliente o impresora cerró la conexión
                    }
                }
            };

            // 1. Mensaje Keep-Alive inicial para confirmar apertura del canal
            clientAdapter.write(`data: ${JSON.stringify({ action: 'CONNECTED', tenantId })}\n\n`);

            // 2. Registra esta conexión en el Hub Multiplexor
            unbindListener = registerTenantListener(tenantId, clientAdapter);

            // 3. Heartbeat cada 20 segundos (idéntico a tu tiempo original para Tigo/Claro/Movistar)
            keepAliveInterval = setInterval(() => {
                try {
                    controller.enqueue(encoder.encode("data: ping\n\n"));
                } catch (e) {
                    clearInterval(keepAliveInterval);
                }
            }, 20000);

            // 4. Limpieza atómica cuando la tablet o impresora se desconecta
            request.signal.addEventListener('abort', () => {
                if (keepAliveInterval) clearInterval(keepAliveInterval);
                unbindListener();
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
            'X-Accel-Buffering': 'no', // Crítico para Nginx / Vercel / Netlify
        },
    });
}