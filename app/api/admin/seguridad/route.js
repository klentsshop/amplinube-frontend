import { NextResponse } from 'next/server';
import { sanityClientServer } from '@/lib/sanity';

// 🔍 1. OBTENER LOS PINES DEL NEGOCIO
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const tenantId = searchParams.get('tenantId');

        if (!tenantId) {
            return NextResponse.json({ error: 'Falta el tenantId.' }, { status: 400 });
        }

        // Buscamos el documento único de seguridad para este tenant
        const query = `*[_type == "seguridad" && tenant == $tenantId][0] { _id, pinCajero, pinAdmin }`;
        const configuracion = await sanityClientServer.fetch(query, { tenantId }, { useCdn: false });

        return NextResponse.json({ ok: true, data: configuracion || null });
    } catch (error) {
        console.error('🔥 [API_GET_SEGURIDAD_ERROR]:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// 🔄 2. ACTUALIZAR O INICIALIZAR PINES
export async function PUT(request) {
    try {
        const body = await request.json();
        const { itemId, pinCajero, pinAdmin, tenantId } = body;

        if (!tenantId) {
            return NextResponse.json({ error: 'Identificador de negocio ausente.' }, { status: 400 });
        }

        if (!pinCajero || !pinAdmin) {
            return NextResponse.json({ error: 'Ambos PINs son obligatorios.' }, { status: 400 });
        }

        let resultId;

        // Si ya existe el documento en el frontend, lo parchamos
        if (itemId) {
            const result = await sanityClientServer
                .patch(itemId)
                .set({ pinCajero: pinCajero.trim(), pinAdmin: pinAdmin.trim() })
                .commit();
            resultId = result._id;
        } else {
            // Si el negocio es nuevo o no tenía pines inicializados, creamos el documento único
            const nuevoDoc = {
                _type: 'seguridad',
                pinCajero: pinCajero.trim(),
                pinAdmin: pinAdmin.trim(),
                tenant: tenantId
            };
            const result = await sanityClientServer.create(nuevoDoc);
            resultId = result._id;
        }

        return NextResponse.json({ ok: true, id: resultId });
    } catch (error) {
        console.error('🔥 [API_PUT_SEGURIDAD_ERROR]:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}