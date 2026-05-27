import { NextResponse } from 'next/server';
import { sanityClientServer } from '@/lib/sanity';

// ➕ 1. CREAR VENDEDOR
export async function POST(request) {
    try {
        const body = await request.json();
        const { nombre, tenantId } = body;

        if (!tenantId) {
            return NextResponse.json({ error: 'Identificador de negocio ausente.' }, { status: 400 });
        }

        const nuevoMeseroDoc = {
            _type: 'mesero',
            nombre: nombre.trim().toUpperCase(), // Lo guardamos limpio y en mayúsculas
            tenant: tenantId
        };

        const result = await sanityClientServer.create(nuevoMeseroDoc);
        return NextResponse.json({ ok: true, item: result });
    } catch (error) {
        console.error('🔥 [API_POST_MESEROS_ERROR]:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// 🔄 2. ACTUALIZAR VENDEDOR
export async function PUT(request) {
    try {
        const body = await request.json();
        const { itemId, nombre, tenantId } = body;

        if (!tenantId || !itemId) {
            return NextResponse.json({ error: 'Faltan parámetros críticos (tenantId o itemId).' }, { status: 400 });
        }

        const camposAActualizar = {};
        if (nombre !== undefined) camposAActualizar.nombre = nombre.trim().toUpperCase();

        const result = await sanityClientServer
            .patch(itemId)
            .set(camposAActualizar)
            .commit();

        return NextResponse.json({ ok: true, id: result._id });
    } catch (error) {
        console.error('🔥 [API_PUT_MESEROS_ERROR]:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// 🗑️ 3. ELIMINAR VENDEDOR
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
        console.error('🔥 [API_DELETE_MESEROS_ERROR]:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}