import { sanityClientServer } from '@/lib/sanity';
import { NextResponse } from 'next/server';

export async function POST(request) {
    try {
        const body = await request.json();
        const { fingerprint, nombre, categorias, tenantId } = body;
        
        if (!tenantId) {
            return NextResponse.json({ success: false, error: "Tenant ID requerido" }, { status: 400 });
        }

        // Generamos el ID único determinista para evitar duplicación de estaciones
        const idLimpio = `estacion-${tenantId.toLowerCase().replace(/[^a-z0-9_-]/g, '')}-${fingerprint.toLowerCase().replace(/[^a-z0-9_-]/g, '-')}`;

        // Escritura maestra en Sanity
        const result = await sanityClientServer.createOrReplace({
            _id: idLimpio,
            _type: 'estacionPC',
            tenant: tenantId,
            nombre: nombre || 'Caja Principal',
            pcFingerprint: fingerprint,
            categoriasVinculadas: Array.isArray(categorias) && categorias.length > 0 ? categorias : []
        });

        // 🛡️ LUPA SENIOR: Se eliminó el borrado de la caché.
        // No destruimos la configuración global del búnker por el registro de una estación de trabajo.

        return NextResponse.json({ success: true, result });
    } catch (error) {
        console.error("🔥 Error API Estaciones:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}