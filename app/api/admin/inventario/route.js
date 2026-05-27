import { NextResponse } from 'next/server';
import { sanityClientServer } from '@/lib/sanity';

// ➕ 1. CREAR ÍTEM DE INVENTARIO
export async function POST(request) {
    try {
        const body = await request.json();
        const { nombre, stockActual, barcode, codigoBalanza, stockMinimo, tenantId } = body;

        if (!tenantId) {
            return NextResponse.json({ error: 'Identificador de negocio ausente.' }, { status: 400 });
        }

        const nuevoInventarioDoc = {
            _type: 'inventario',
            nombre: nombre.trim(),
            stockActual: Number(stockActual) || 0,
            barcode: barcode ? barcode.trim() : undefined,
            codigoBalanza: codigoBalanza ? codigoBalanza.trim() : undefined,
            stockMinimo: Number(stockMinimo) || 5,
            tenant: tenantId
        };

        const result = await sanityClientServer.create(nuevoInventarioDoc);
        return NextResponse.json({ ok: true, item: result });
    } catch (error) {
        console.error('🔥 [API_POST_INVENTARIO_ERROR]:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// 🔄 2. ACTUALIZAR EN LÍNEA (Cualquier campo dinámicamente)
export async function PUT(request) {
    try {
        const body = await request.json();
        const { itemId, nombre, stockActual, barcode, codigoBalanza, stockMinimo, tenantId } = body;

        if (!tenantId || !itemId) {
            return NextResponse.json({ error: 'Faltan parámetros críticos (tenantId o itemId).' }, { status: 400 });
        }

        // Construimos dinámicamente el objeto patch para actualizar solo lo que se altere
        const camposAActualizar = {};
        if (nombre !== undefined) camposAActualizar.nombre = nombre.trim();
        if (stockActual !== undefined) camposAActualizar.stockActual = Number(stockActual);
        if (barcode !== undefined) camposAActualizar.barcode = barcode ? barcode.trim() : null;
        if (codigoBalanza !== undefined) camposAActualizar.codigoBalanza = codigoBalanza ? codigoBalanza.trim() : null;
        if (stockMinimo !== undefined) camposAActualizar.stockMinimo = Number(stockMinimo);

        const result = await sanityClientServer
            .patch(itemId)
            .set(camposAActualizar)
            .commit();

        return NextResponse.json({ ok: true, id: result._id });
    } catch (error) {
        console.error('🔥 [API_PUT_INVENTARIO_ERROR]:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// 🗑️ 3. ELIMINAR ÍTEM DE INVENTARIO
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
        console.error('🔥 [API_DELETE_INVENTARIO_ERROR]:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}