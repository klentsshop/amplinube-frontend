import { NextResponse } from 'next/server';
import { sanityClientServer } from '@/lib/sanity'; // Asegúrate de que esta sea tu instancia con write token

export async function POST(request) {
    try {
        const body = await request.json();
        const { titulo, slug, seImprime, tenantId } = body;

        // 🛡️ ESCUDO MULTITENANT ADMINISTRATIVO
        if (!tenantId || tenantId === 'undefined') {
            return NextResponse.json({ error: 'Identificador de negocio ausente o corrupto.' }, { status: 400 });
        }

        // 🧠 ESTRUCTURA EXACTA COMPATIBLE CON TU SCHEMATYPE
        const nuevaCategoriaDoc = {
            _type: 'categoria',
            titulo: titulo, // Ya viene limpio y en MAYÚSCULAS desde el POS
            slug: {
                _type: 'slug',
                current: slug // Ya viene formateado en minúsculas y con guiones (ej: "jugos-naturales")
            },
            seImprime: seImprime ?? true, // Respeta el checkbox del administrador
            tenant: tenantId // 👈 SE MAPEA AL CAMPO 'tenant' EXIGIDO POR TU SCHEMA
        };

        // Inyección directa atómica en Sanity
        const result = await sanityClientServer.create(nuevaCategoriaDoc);

        return NextResponse.json({ ok: true, id: result._id });

    } catch (error) {
        console.error('🔥 [API_ADMIN_CATEGORIAS_ERROR]:', error.message);
        return NextResponse.json({ error: error.message || 'Error interno en el servidor.' }, { status: 500 });
    }
}
// ==========================================
// 🔄 MÉTODO PUT: ACTUALIZAR CATEGORÍA EXTRAPOLADA
// ==========================================
export async function PUT(request) {
    try {
        const body = await request.json();
        const { categoriaId, titulo, slug, seImprime, tenantId } = body;

        // 🛡️ ESCUDO MULTITENANT
        if (!tenantId || !categoriaId) {
            return NextResponse.json({ error: 'Faltan parámetros críticos (tenantId o categoriaId).' }, { status: 400 });
        }

        console.log(`🔄 [PATCH_SANITY]: Actualizando ID ${categoriaId} para el Tenant: ${tenantId}`);

        // ⚡ MUTACIÓN ATÓMICA CON EL CLIENTE DE ESCRITURA
        const result = await sanityClientServer
            .patch(categoriaId)
            .set({
                titulo: titulo,
                slug: {
                    _type: 'slug',
                    current: slug
                },
                seImprime: seImprime === true
            })
            .commit(); // Inyecta y consolida el cambio en la nube

        return NextResponse.json({ ok: true, id: result._id });

    } catch (error) {
        console.error('🔥 [API_PUT_CATEGORIAS_ERROR]:', error.message);
        return NextResponse.json({ error: error.message || 'Error interno en el servidor.' }, { status: 500 });
    }
}
// ==========================================
// 🗑️ MÉTODO DELETE: ELIMINACIÓN SEGURA
// ==========================================
export async function DELETE(request) {
    try {
        const body = await request.json();
        const { categoriaId, tenantId } = body;

        // 🛡️ CONTROL DE SEGURIDAD MULTITENANT
        if (!tenantId || !categoriaId) {
            return NextResponse.json({ error: 'Faltan credenciales o el ID para ejecutar el borrado.' }, { status: 400 });
        }

        console.log(`🗑️ [DELETE_SANITY]: Eliminando Categoría ID ${categoriaId} del Tenant: ${tenantId}`);

        // Borrado atómico directo en Sanity
        await sanityClientServer.delete(categoriaId);

        return NextResponse.json({ ok: true });

    } catch (error) {
        console.error('🔥 [API_DELETE_CATEGORIAS_ERROR]:', error.message);
        return NextResponse.json({ error: error.message || 'Error interno en el servidor.' }, { status: 500 });
    }
}