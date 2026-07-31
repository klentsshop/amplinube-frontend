import { registerTenantListener } from '@/lib/tenantBroadcaster';

export const dynamic = 'force-dynamic'; // Evita el almacenamiento en caché estático de la ruta

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const tenantId = searchParams.get('tenantId');

  if (!tenantId) {
    return new Response(JSON.stringify({ message: 'El parámetro tenantId es obligatorio' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let unbindListener = () => {};
  let heartbeatInterval = null;

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      // Objeto simulado para que sea compatible con el tenantBroadcaster.js existente
      const clientMock = {
        write: (chunk) => {
          try {
            controller.enqueue(encoder.encode(chunk));
          } catch (e) {
            console.error('[SSE App Router] Error enviando chunk:', e);
          }
        },
      };

      // Confirmación inicial
      clientMock.write(`data: ${JSON.stringify({ action: 'CONNECTED', tenantId })}\n\n`);

      // Registrar el cliente en el multiplexor
      unbindListener = registerTenantListener(tenantId, clientMock);

      // Heartbeat / Ping cada 15s
      heartbeatInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(':ping\n\n'));
        } catch (e) {
          clearInterval(heartbeatInterval);
        }
      }, 15000);
    },
    cancel() {
      // Se ejecuta cuando la pestaña se cierra o la red cae
      if (heartbeatInterval) clearInterval(heartbeatInterval);
      unbindListener();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}