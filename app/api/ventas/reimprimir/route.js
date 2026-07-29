import { supabaseServer } from '@/lib/supabase';
import crypto from 'crypto';

export async function POST(req) {
    try {
        const { venta, tenantId } = await req.json();
        if (!tenantId) {
            return Response.json({ error: 'Tenant ID es obligatorio para reimprimir' }, { status: 400 });
        }

        if (!venta) {
            return Response.json({ error: 'No hay datos de venta' }, { status: 400 });
        }
        // 1. EL GRAN TOTAL ya viene sumado desde tu API de Historial
        const granTotal = Number(venta.totalPagado || 0); 
        const valorPropina = Number(venta.propinaRecaudada || 0);
        
        // 2. EL NETO (Comida) es la resta del total que mandó el historial menos la propina
        // Así la suma en el papel (Neto + Propina) dará el Total correcto.
        const valorNetoComida = granTotal - valorPropina;

        // 🚀 INYECCIÓN SÉNIOR EN SUPABASE (Reimpresión Directa sin Sanity)
        // Insertamos el registro con la acción de impresión explícita para que lo capture el Live Stream
        const { error: errInsert } = await supabaseServer
            .from('tickets_caja_pendientes')
            .insert([{
                id: `ticket-reimpresion-${Date.now()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
                tenant_id: tenantId,
                tipo_accion: 'IMPRIMIR_TICKET', // 🖨️ Le indica al Watcher que ejecute ClienteRenderer
                metodo_pago: (venta.metodoPago || "Efectivo").toUpperCase(),
                mesa: String(venta.mesa || 'General'),
                mesero: venta.mesero || 'Caja',
                folio: venta.folio || '01',
                tipo_orden: venta.tipoOrden || 'mesa',
                subtotal: valorNetoComida,
                propina: valorPropina,
                total: granTotal,
                datos_entrega: venta.datosEntrega || null,
                
                // Mapeamos el array de platos como un JSONB relacional idéntico a lo que espera la APK
                platos_ordenados: (venta.platosVendidosV2 || []).map(p => ({
                    _key: crypto.randomUUID(),
                    nombrePlato: p.nombrePlato,
                    cantidad: p.cantidad,
                    precio: p.precioUnitario,
                    subtotal: p.subtotal
                }))
            }]);

        if (errInsert) {
            console.error('❌ Error registrando ticket de reimpresión en Supabase:', errInsert.message);
            throw new Error(`DB_WRITE_FAILED: ${errInsert.message}`);
        }

        return Response.json({ ok: true });
    } catch (err) {
        console.error('[REIMPRESION_ERROR]:', err);
        return Response.json({ error: err.message }, { status: 500 });
    }
}