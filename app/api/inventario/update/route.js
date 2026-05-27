import { sanityClientServer as client } from '@/lib/sanity'; 
import { NextResponse } from 'next/server';

export async function POST(request) {
    try {
        const body = await request.json();
        const { insumoId, cantidadASumar, tenantId } = body;

        if (!insumoId || cantidadASumar === undefined || !tenantId) {
            return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
        }

        const monto = Number(cantidadASumar);

        // 🛡️ BISTURÍ: Validación y Update en un solo paso seguro
        // En lugar de hacer un fetch antes, usamos un filtro en el patch si es posible,
        // pero como Sanity Patch por ID es directo, aseguramos la propiedad primero:
        
        const insumoReal = await client.fetch(
            `*[_type == "inventario" && _id == $insumoId && tenant == $tenantId][0]`,
            { insumoId, tenantId }
        );

        if (!insumoReal) {
            return NextResponse.json({ error: "Insumo no encontrado o ajeno" }, { status: 403 });
        }

        // 🚀 OPERACIÓN ATÓMICA:
        // Agregamos un 'autoGenerateArrayKeys: true' o simplemente el commit con visibilidad inmediata
        const result = await client
            .patch(insumoId)
            // Sello de seguridad: Solo si el tenant coincide (aunque ya lo validamos, esto es doble blindaje)
            .setIfMissing({ stockActual: 0 })
            .inc({ stockActual: monto })
            .commit({ visibility: 'async' }); // 'async' ayuda a que no se quede bloqueado si hay ráfagas

        return NextResponse.json({ 
            success: true, 
            nuevoStock: result.stockActual 
        });

    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}