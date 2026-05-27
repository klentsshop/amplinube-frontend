import { NextResponse } from 'next/server';
import { sanityClientServer } from '@/lib/sanity';

// ➕ 1. CREAR REGISTRO DE GASTO
export async function POST(request) {
    try {
        const body = await request.json();
        const { descripcion, monto, tenantId } = body;

        if (!tenantId) {
            return NextResponse.json({ error: 'Identificador de negocio ausente.' }, { status: 400 });
        }

        const nuevoGastoDoc = {
            _type: 'gasto',
            descripcion: descripcion.trim(),
            monto: Number(monto) || 0,
            fecha: new Date().toISOString(), // Inyecta la fecha y hora exacta del egreso
            tenant: tenantId
        };

        const result = await sanityClientServer.create(nuevoGastoDoc);
        return NextResponse.json({ ok: true, item: result });
    } catch (error) {
        console.error('🔥 [API_POST_GASTOS_ERROR]:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// 🔄 2. ACTUALIZAR GASTO EXISTENTE
export async function PUT(request) {
    try {
        const body = await request.json();
        const { itemId, descripcion, monto, tenantId } = body; // Usamos itemId para mantener la coherencia con tu frontend

        if (!tenantId || !itemId) {
            return NextResponse.json({ error: 'Faltan parámetros críticos (tenantId o itemId).' }, { status: 400 });
        }

        const camposAActualizar = {};
        if (descripcion !== undefined) camposAActualizar.descripcion = descripcion.trim();
        if (monto !== undefined) camposAActualizar.monto = Number(monto);

        const result = await sanityClientServer
            .patch(itemId)
            .set(camposAActualizar)
            .commit();

        return NextResponse.json({ ok: true, id: result._id });
    } catch (error) {
        console.error('🔥 [API_PUT_GASTOS_ERROR]:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// 🗑️ 3. ELIMINAR REGISTRO DE GASTO
export async function DELETE(request) {
    try {
        const body = await request.json();
        const { itemId, tenantId } = body;

        if (!tenantId || !itemId) {
            return NextResponse.json({ error: 'Faltan credenciales o el ID para borrar.' }, { status: 400 });
        }

        await sanityClientServer.delete(itemId);
        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error('🔥 [API_DELETE_GASTOS_ERROR]:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}