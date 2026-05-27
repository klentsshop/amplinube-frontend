import { sanityClientServer } from '@/lib/sanity';

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

        const objetoTicket = {
            _type: 'ticketCobro', 
            tenant: tenantId,
            mesa: `${venta.mesa}`,
            mesero: venta.mesero,
            tipoOrden: venta.tipoOrden || 'mesa', // 🚀 BISTURÍ: Pasamos el tipo
            datosEntrega: venta.datosEntrega || null,
            metodoPago: venta.metodoPago || "Efectivo",
            platosOrdenados: (venta.platosVendidosV2 || []).map(p => ({
                _key: crypto.randomUUID(), // 👈 Cambiado por seguridad criptográfica atómica
                nombrePlato: p.nombrePlato,
                cantidad: p.cantidad,
                precio: p.precioUnitario,
                subtotal: p.subtotal,
            })),

            // 🎯 ETIQUETAS PARA LA APK (Pintará los datos desglosados correctamente)
            subtotal: valorNetoComida,   // La comida sola
            propina: valorPropina,       // La propina sola
            total: granTotal,            // El total que viste en el historial

            // ✅ CAMPOS PARA SANITY (Mantener histórico)
            totalPagado: granTotal,
            propinaRecaudada: valorPropina,
            
            imprimirSolicitada: true, 
            imprimirCliente: true,    
            fecha: new Date().toISOString()
        };

        await sanityClientServer.create(objetoTicket);
        return Response.json({ ok: true });
    } catch (err) {
        console.error('[REIMPRESION_ERROR]:', err);
        return Response.json({ error: err.message }, { status: 500 });
    }
}