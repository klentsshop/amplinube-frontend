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

         const result = await sanityClientServer.create(nuevaCategoriaDoc);

       // ⚡ ACTUALIZACIÓN EN CALIENTE DE LA CACHÉ EN EL ARRAY PLANO (MATCH 100% CON TU JSON)
        try {
            const { supabaseServer } = await import('@/lib/supabase');
            const tenantKey = tenantId.toLowerCase().trim();

            const { data: registroActual } = await supabaseServer
                .from('catalog_cache')
                .select('payload_json')
                .eq('tenant_host', tenantKey)
                .single();

            const nuevaCategoriaCache = {
                _id: result._id,
                _type: 'categoria',
                titulo: titulo,
                slug: { _type: 'slug', current: slug },
                seImprime: seImprime ?? true,
                tenant: tenantId,
                _createdAt: new Date().toISOString(),
                _updatedAt: new Date().toISOString()
            };

            if (registroActual && Array.isArray(registroActual.payload_json)) {
                const nuevoPayload = [nuevaCategoriaCache, ...registroActual.payload_json];

                await supabaseServer
                    .from('catalog_cache')
                    .upsert({ 
                        tenant_host: tenantKey, 
                        payload_json: nuevoPayload, 
                        updated_at: new Date().toISOString() 
                    }, { onConflict: 'tenant_host' });
            } else {
                await supabaseServer
                    .from('catalog_cache')
                    .upsert({ 
                        tenant_host: tenantKey, 
                        payload_json: [nuevaCategoriaCache], 
                        updated_at: new Date().toISOString() 
                    }, { onConflict: 'tenant_host' });
            }
            console.log(`⚡ Categoría inyectada en caliente en el array plano para: ${tenantId}`);
        } catch (cacheError) {
            console.warn("⚠️ Falla no-bloqueante al actualizar la caché en POST categorías:", cacheError.message);
        }
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

        // ⚡ TU LÓGICA ORIGINAL INTACTA: Mutación atómica en Sanity
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

       // ⚡ ACTUALIZACIÓN EN CALIENTE DE LA CACHÉ EN ARRAY PLANO
        try {
            const { supabaseServer } = await import('@/lib/supabase');
            const tenantKey = tenantId.toLowerCase().trim();

            const { data: registroActual } = await supabaseServer
                .from('catalog_cache')
                .select('payload_json')
                .eq('tenant_host', tenantKey)
                .single();

            if (registroActual && Array.isArray(registroActual.payload_json)) {
                const nuevoPayload = registroActual.payload_json.map(item => {
                    if (item?._id === categoriaId) {
                        return {
                            ...item,
                            titulo: titulo,
                            slug: { _type: 'slug', current: slug },
                            seImprime: seImprime === true,
                            _updatedAt: new Date().toISOString()
                        };
                    }
                    return item;
                });

                await supabaseServer
                    .from('catalog_cache')
                    .upsert({ 
                        tenant_host: tenantKey, 
                        payload_json: nuevoPayload, 
                        updated_at: new Date().toISOString() 
                    }, { onConflict: 'tenant_host' });

                console.log(`⚡ Categoría actualizada en caliente en array plano para: ${tenantId}`);
            } else {
                console.warn(`⚠️ No se pudo actualizar categoría: la caché plana de ${tenantKey} no existe.`);
            }
        } catch (cacheError) {
            console.warn("⚠️ Falla no-bloqueante al actualizar el catálogo desde PUT categorías:", cacheError.message);
        }

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

        // TU LÓGICA ORIGINAL INTACTA: Borrado atómico directo en Sanity
        await sanityClientServer.delete(categoriaId);

        // ⚡ REMOCIÓN EN CALIENTE DE LA CACHÉ (Evita peticiones masivas a Sanity)
// ⚡ REMOCIÓN EN CALIENTE DE LA CACHÉ PLANA
        try {
            const { supabaseServer } = await import('@/lib/supabase');
            const tenantKey = tenantId.toLowerCase().trim();

            const { data: registroActual } = await supabaseServer
                .from('catalog_cache')
                .select('payload_json')
                .eq('tenant_host', tenantKey)
                .single();

            if (registroActual && Array.isArray(registroActual.payload_json)) {
                const nuevoPayload = registroActual.payload_json.filter(item => item?._id !== categoriaId);

                await supabaseServer
                    .from('catalog_cache')
                    .upsert({ 
                        tenant_host: tenantKey, 
                        payload_json: nuevoPayload, 
                        updated_at: new Date().toISOString() 
                    }, { onConflict: 'tenant_host' });

                console.log(`⚡ Categoría removida del array plano de la caché para: ${tenantId}`);
            } else {
                console.log(`ℹ️ Remoción omitida: la caché plana de ${tenantKey} no existía.`);
            }
        } catch (cacheError) {
            console.warn("⚠️ Falla no-bloqueante al remover la categoría de la caché plana:", cacheError.message);
        }
        return NextResponse.json({ ok: true });

    } catch (error) {
        console.error('🔥 [API_DELETE_CATEGORIAS_ERROR]:', error.message);
        return NextResponse.json({ error: error.message || 'Error interno en el servidor.' }, { status: 500 });
    }
}