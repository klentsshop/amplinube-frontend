import { sanityClientServer } from '@/lib/sanity';
import { NextResponse } from 'next/server';

export async function POST(request) {
    try {
        const body = await request.json();
        const { fingerprint, nombre, categorias, tenantId} = body;
        if (!tenantId) {
            return NextResponse.json({ success: false, error: "Tenant ID requerido" }, { status: 400 });
        }

        const idLimpio = `estacion-${tenantId.toLowerCase().replace(/[^a-z0-9_-]/g, '')}-${fingerprint.toLowerCase().replace(/[^a-z0-9_-]/g, '-')}`;

        const result = await sanityClientServer.createOrReplace({
            _id: idLimpio,
            _type: 'estacionPC',
            tenant: tenantId,
            nombre: nombre || 'Caja Principal',
            pcFingerprint: fingerprint,
            categoriasVinculadas: categorias
        });

        return NextResponse.json({ success: true, result });
    } catch (error) {
        console.error("🔥 Error API Estaciones:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}