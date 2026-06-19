import { NextResponse } from 'next/server';
import { sanityClientServer } from '@/lib/sanity';

// ➕ 1. CREAR VENDEDOR
export async function POST(request) {
    try {
        const body = await request.json();
        const { 
            nombre, activo, tenantId,
            verReporte, verAdmin, puedeCargarGasto, verVentas, verInventario, puedeCobrar 
        } = body;

        if (!tenantId) {
            return NextResponse.json({ error: 'Identificador de negocio ausente.' }, { status: 400 });
        }

        const nuevoMeseroDoc = {
            _type: 'mesero',
            nombre: nombre.trim().toUpperCase(),
            tenant: tenantId,
            activo: activo !== false,
            verReporte: Boolean(verReporte),
            verAdmin: Boolean(verAdmin),
            puedeCargarGasto: Boolean(puedeCargarGasto),
            verVentas: Boolean(verVentas),
            verInventario: Boolean(verInventario),
            puedeCobrar: Boolean(puedeCobrar)
        };

        const result = await sanityClientServer.create(nuevoMeseroDoc);

        try {
            const { supabaseServer } = await import('@/lib/supabase');
            const tenantKey = tenantId.toLowerCase().trim();

            // 1. Traemos el documento de caché actual
            const { data: registroActual } = await supabaseServer
                .from('catalog_cache')
                .select('payload_json')
                .eq('tenant_host', tenantKey)
                .single();

            if (registroActual && Array.isArray(registroActual.payload_json)) {
                // 2. Preparamos el nuevo objeto simulando la respuesta exacta de Sanity
                const nuevoMeseroCache = {
                    _id: result._id,
                    _type: 'mesero',
                    nombre: nombre.trim().toUpperCase(),
                    tenant: tenantId,
                    activo: activo !== false,
                    verReporte: Boolean(verReporte),
                    verAdmin: Boolean(verAdmin),
                    puedeCargarGasto: Boolean(puedeCargarGasto),
                    verVentas: Boolean(verVentas),
                    verInventario: Boolean(verInventario),
                    puedeCobrar: Boolean(puedeCobrar)
                };

                // 3. Lo inyectamos al inicio del array plano en memoria
                const nuevoPayload = [nuevoMeseroCache, ...registroActual.payload_json];

                // 4. Escribimos encima de la fila sin dejarla vacía en ningún milisegundo
                await supabaseServer
                    .from('catalog_cache')
                    .upsert({ 
                        tenant_host: tenantKey, 
                        payload_json: nuevoPayload, 
                        updated_at: new Date().toISOString() 
                    }, { onConflict: 'tenant_host' });
                
                console.log(`⚡ Caché actualizado en caliente tras creación de mesero para: ${tenantId}`);
            } else {
                // 🔥 Inicializa el array plano directamente con el primer mesero si la caché venía vacía
                await supabaseServer
                    .from('catalog_cache')
                    .upsert({ 
                        tenant_host: tenantKey, 
                        payload_json: [nuevoMeseroCache], 
                        updated_at: new Date().toISOString() 
                    }, { onConflict: 'tenant_host' });
            }
        } catch (cacheError) {
            console.warn("⚠️ Falla no-bloqueante al actualizar la caché en POST meseros:", cacheError.message);
        }

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
        const { 
            itemId, nombre, activo, tenantId,
            verReporte, verAdmin, puedeCargarGasto, verVentas, verInventario, puedeCobrar 
        } = body;

        if (!tenantId || !itemId) {
            return NextResponse.json({ error: 'Faltan parámetros críticos (tenantId o itemId).' }, { status: 400 });
        }

        const camposAActualizar = {};
        if (nombre !== undefined) camposAActualizar.nombre = nombre.trim().toUpperCase();
        if (activo !== undefined) camposAActualizar.activo = Boolean(activo);
        if (verReporte !== undefined) camposAActualizar.verReporte = Boolean(verReporte);
        if (verAdmin !== undefined) camposAActualizar.verAdmin = Boolean(verAdmin);
        if (puedeCargarGasto !== undefined) camposAActualizar.puedeCargarGasto = Boolean(puedeCargarGasto);
        if (verVentas !== undefined) camposAActualizar.verVentas = Boolean(verVentas);
        if (verInventario !== undefined) camposAActualizar.verInventario = Boolean(verInventario);
        if (puedeCobrar !== undefined) camposAActualizar.puedeCobrar = Boolean(puedeCobrar);

        const result = await sanityClientServer
            .patch(itemId)
            .set(camposAActualizar)
            .commit();
try {
            const { supabaseServer } = await import('@/lib/supabase');
            const tenantKey = tenantId.toLowerCase().trim();

            const { data: registroActual } = await supabaseServer
                .from('catalog_cache')
                .select('payload_json')
                .eq('tenant_host', tenantKey)
                .single();

            if (registroActual && Array.isArray(registroActual.payload_json)) {
                // 1. Mapeamos el array plano reemplazando únicamente las propiedades editadas del mesero coincidente
                const nuevoPayload = registroActual.payload_json.map(item => {
                    if (item?._id === itemId) {
                        return {
                            ...item,
                            ...(nombre !== undefined && { nombre: nombre.trim().toUpperCase() }),
                            ...(activo !== undefined && { activo: Boolean(activo) }),
                            ...(verReporte !== undefined && { verReporte: Boolean(verReporte) }),
                            ...(verAdmin !== undefined && { verAdmin: Boolean(verAdmin) }),
                            ...(puedeCargarGasto !== undefined && { puedeCargarGasto: Boolean(puedeCargarGasto) }),
                            ...(verVentas !== undefined && { verVentas: Boolean(verVentas) }),
                            ...(verInventario !== undefined && { verInventario: Boolean(verInventario) }),
                            ...(puedeCobrar !== undefined && { puedeCobrar: Boolean(puedeCobrar) })
                        };
                    }
                    return item;
                });

                // 2. Guardamos la nueva lista en Supabase mediante upsert atómico
                await supabaseServer
                    .from('catalog_cache')
                    .upsert({ 
                        tenant_host: tenantKey, 
                        payload_json: nuevoPayload, 
                        updated_at: new Date().toISOString() 
                    }, { onConflict: 'tenant_host' });

                console.log(`⚡ Caché actualizado en caliente tras modificación de mesero para: ${tenantId}`);
            } else {
                console.warn(`⚠️ No se pudo actualizar mesero en caliente: la caché de ${tenantKey} no existe.`);
            }
        } catch (cacheError) {
            console.warn("⚠️ Falla no-bloqueante al actualizar la caché en PUT meseros:", cacheError.message);
        }

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

        try {
            const { supabaseServer } = await import('@/lib/supabase');
            const tenantKey = tenantId.toLowerCase().trim();

            const { data: registroActual } = await supabaseServer
                .from('catalog_cache')
                .select('payload_json')
                .eq('tenant_host', tenantKey)
                .single();

            if (registroActual && Array.isArray(registroActual.payload_json)) {
                // 1. Filtramos el array para remover al vendedor eliminado sin tocar el resto del catálogo
                const nuevoPayload = registroActual.payload_json.filter(item => item?._id !== itemId);

                // 2. Consolidamos el array resultante directamente en Supabase
                await supabaseServer
                    .from('catalog_cache')
                    .upsert({ 
                        tenant_host: tenantKey, 
                        payload_json: nuevoPayload, 
                        updated_at: new Date().toISOString() 
                    }, { onConflict: 'tenant_host' });

                console.log(`⚡ Mesero removido de la caché en caliente para: ${tenantId}`);
            } else {
                console.log(`ℹ️ Remoción omitida: la caché de ${tenantKey} ya se encontraba limpia.`);
            }
        } catch (cacheError) {
            console.warn("⚠️ Falla no-bloqueante al actualizar la caché en DELETE meseros:", cacheError.message);
        }

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error('🔥 [API_DELETE_MESEROS_ERROR]:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}