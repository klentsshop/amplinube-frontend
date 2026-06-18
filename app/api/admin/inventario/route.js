import { NextResponse } from 'next/server';
import { sanityClientServer } from '@/lib/sanity';
import { supabaseServer } from '@/lib/supabase'; // 🛡️ Cliente oficial de Supabase

export const dynamic = 'force-dynamic';

// ➕ 1. CREAR ÍTEM DE INVENTARIO (HÍBRIDO: Metadatos a Sanity, Stock Inicial a Supabase)
export async function POST(request) {
    try {
        const body = await request.json();
        const { nombre, stockActual, barcode, codigoBalanza, stockMinimo, tenantId } = body;

        if (!tenantId) {
            return NextResponse.json({ error: 'Identificador de negocio ausente.' }, { status: 400 });
        }

        // A. Guardamos la estructura estática en Sanity (Sin stockActual)
        const nuevoInventarioDoc = {
            _type: 'inventario',
            nombre: nombre.trim(),
            barcode: barcode ? barcode.trim() : undefined,
            codigoBalanza: codigoBalanza ? codigoBalanza.trim() : undefined,
            stockMinimo: Number(stockMinimo) || 5,
            tenant: tenantId
        };

        const resultSanity = await sanityClientServer.create(nuevoInventarioDoc);
        const idGenerado = resultSanity._id;

        // B. Inyectamos de forma inmediata y síncrona el Stock Vivo en Supabase vinculando el mismo ID
        const { error: supabaseError } = await supabaseServer
            .from('inventarios') 
            .insert([{
                insumo_id: idGenerado,
                tenant_id: tenantId,
                stock_actual: Number(stockActual) || 0,
                stock_minimo: Number(stockMinimo) || 5,
                nombre: nombre.trim().toUpperCase(),
                unidad_medida: body.unidadMedida || 'unidades'
            }]);

           if (supabaseError) {
    await sanityClientServer.delete(idGenerado);
    throw new Error(`SUPABASE_INSERT_FAILED: ${supabaseError.message}`);
}

// ⚡ ACTUALIZACIÓN EN CALIENTE DE LA CACHÉ EN EL ARRAY PLANO (MATCH 100% CON TU JSON)
        try {
            const tenantKey = tenantId.toLowerCase().trim();

            // 1. Traemos el escudo plano actual
            const { data: registroActual } = await supabaseServer
                .from('catalog_cache')
                .select('payload_json')
                .eq('tenant_host', tenantKey)
                .single();

            // 2. Simulamos el objeto exacto de inventario según tu JSON real
            const nuevoInventarioCache = {
                _id: idGenerado,
                _type: 'inventario',
                nombre: nombre.trim(),
                tenant: tenantId,
                barcode: barcode ? barcode.trim() : null,
                _createdAt: resultSanity._createdAt || new Date().toISOString(),
                _updatedAt: resultSanity._updatedAt || new Date().toISOString(),
                stockActual: Number(stockActual) || 0,
                stockMinimo: Number(stockMinimo) || 5,
                codigoBalanza: codigoBalanza ? codigoBalanza.trim() : null
            };

            if (registroActual && Array.isArray(registroActual.payload_json)) {
                // 3. Lo inyectamos al principio de la raíz del array plano
                const nuevoPayload = [nuevoInventarioCache, ...registroActual.payload_json];

                await supabaseServer
                    .from('catalog_cache')
                    .upsert({ 
                        tenant_host: tenantKey, 
                        payload_json: nuevoPayload, 
                        updated_at: new Date().toISOString() 
                    }, { onConflict: 'tenant_host' });
            }
            console.log(`⚡ Insumo inyectado en caliente en el array plano de caché para: ${tenantId}`);
        } catch (cacheError) {
            console.warn("⚠️ Falla no-bloqueante al inyectar el insumo en la caché plana:", cacheError.message);
        }

return NextResponse.json({ ok: true, item: resultSanity });
    } catch (error) {
        console.error('🔥 [API_POST_INVENTARIO_ERROR]:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// 🔄 2. ACTUALIZAR EN LÍNEA (Sincronización en ambos sistemas)
export async function PUT(request) {
    try {
        const body = await request.json();
        const { itemId, nombre, stockActual, barcode, codigoBalanza, stockMinimo, tenantId } = body;

        if (!tenantId || !itemId) {
            return NextResponse.json({ error: 'Faltan parámetros críticos (tenantId o itemId).' }, { status: 400 });
        }

        // A. Actualización en Sanity para campos estáticos
        const camposSanity = {};
        if (nombre !== undefined) camposSanity.nombre = nombre.trim();
        if (barcode !== undefined) camposSanity.barcode = barcode ? barcode.trim() : null;
        if (codigoBalanza !== undefined) camposSanity.codigoBalanza = codigoBalanza ? codigoBalanza.trim() : null;
        if (stockMinimo !== undefined) camposSanity.stockMinimo = Number(stockMinimo);

        let resultSanityId = itemId;
        // 🛡️ Solo golpeamos a Sanity si hay cambios estructurales reales (nombre, barcode, etc.)
        if (Object.keys(camposSanity).length > 0) {
            const resultSanity = await sanityClientServer
                .patch(itemId)
                .set(camposSanity)
                .commit();
            resultSanityId = resultSanity._id;
        }
        // B. Actualización en Supabase para el Stock Numérico Vivo
        const camposSupabase = {};
        if (nombre !== undefined) camposSupabase.nombre = nombre.trim().toUpperCase();
        if (stockActual !== undefined) camposSupabase.stock_actual = Number(stockActual);
        if (stockMinimo !== undefined) camposSupabase.stock_minimo = Number(stockMinimo);

        if (Object.keys(camposSupabase).length > 0) {
            const { error: supabaseError } = await supabaseServer
                .from('inventarios') 
                .update(camposSupabase)
                .eq('insumo_id', itemId) 
                .eq('tenant_id', tenantId);

            if (supabaseError) throw new Error(`SUPABASE_UPDATE_FAILED: ${supabaseError.message}`);
        }
       // ⚡ ACTUALIZACIÓN EN CALIENTE DE LOS INSUMOS EN EL ARRAY PLANO
        try {
            const tenantKey = tenantId.toLowerCase().trim();

            const { data: registroActual } = await supabaseServer
                .from('catalog_cache')
                .select('payload_json')
                .eq('tenant_host', tenantKey)
                .single();

            if (registroActual && Array.isArray(registroActual.payload_json)) {
                // Mapeamos directo en la raíz del array plano buscando el itemId del insumo
                const nuevoPayload = registroActual.payload_json.map(item => {
                    if (item?._id === itemId && item?._type === 'inventario') {
                        return {
                            ...item,
                            ...(nombre !== undefined && { nombre: nombre.trim() }),
                            ...(barcode !== undefined && { barcode: barcode ? barcode.trim() : null }),
                            ...(codigoBalanza !== undefined && { codigoBalanza: codigoBalanza ? codigoBalanza.trim() : null }),
                            ...(stockMinimo !== undefined && { stockMinimo: Number(stockMinimo) }),
                            ...(stockActual !== undefined && { stockActual: Number(stockActual) }),
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
                
                console.log(`⚡ Insumo actualizado en caliente en array plano para: ${tenantId}`);
            }
        } catch (cacheError) {
            console.warn("⚠️ Falla no-bloqueante al actualizar el insumo en la caché plana:", cacheError.message);
        }
        return NextResponse.json({ ok: true, id: resultSanityId });
    } catch (error) {
        console.error('🔥 [API_PUT_INVENTARIO_ERROR]:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// 🗑️ 3. ELIMINAR ÍTEM DE INVENTARIO (Doble remoción atómica y saneamiento de alertas para la APK)
export async function DELETE(request) {
    try {
        const body = await request.json();
        const { itemId, tenantId } = body;

        if (!tenantId || !itemId) {
            return NextResponse.json({ error: 'Faltan credenciales o el ID para borrar.' }, { status: 400 });
        }

        console.log(`🗑️ Removiendo de forma aislada el insumo ${itemId} del tenant ${tenantId}`);

        const documentoOriginal = await sanityClientServer.fetch(
            `*[_id == $itemId && tenant == $tenantId][0]`,
            { itemId, tenantId }
        );

        // 🚨 SI NO EXISTE O NO COINCIDE EL TENANT: Denegamos de inmediato.
        // No le decimos al usuario si el ID existe en otra tienda o no, por privacidad de datos.
        if (!documentoOriginal) {
            return NextResponse.json({ 
                error: 'Operación denegada. El recurso no existe o no tiene autorización para gestionarlo en este negocio.' 
            }, { status: 403 });
        }

        // Paso B: Eliminación directa del registro numérico de existencias en Supabase
        const { error: supabaseError } = await supabaseServer
            .from('inventarios') 
            .delete()
            .eq('insumo_id', itemId) 
            .eq('tenant_id', tenantId);

        if (supabaseError) {
            throw new Error(`SUPABASE_DELETE_FAILED: ${supabaseError.message}`);
        }

        // Paso C: Eliminación física del documento maestro en Sanity
        await sanityClientServer.delete(itemId);

        // Paso D: Saneamiento de alertas críticas en Sanity para que la APK no pinte fantasmas
        const configCritica = await sanityClientServer.fetch(
            `*[_type == "inventarioCritico" && tenant == $tenantId][0]`,
            { tenantId }
        );

        if (configCritica && Array.isArray(configCritica.productosCriticos)) {
            const nuevasAlertas = configCritica.productosCriticos.filter(p => p.productoId !== itemId);
            
            await sanityClientServer
                .patch(configCritica._id)
                .set({ productosCriticos: nuevasAlertas, ultimaSincronizacion: new Date().toISOString() })
                .commit();
        }
         // ⚡ REMOCIÓN EN CALIENTE DEL INSUMO DENTRO DEL ARRAY PLANO
        try {
            const tenantKey = tenantId.toLowerCase().trim();

            const { data: registroActual } = await supabaseServer
                .from('catalog_cache')
                .select('payload_json')
                .eq('tenant_host', tenantKey)
                .single();

            if (registroActual && Array.isArray(registroActual.payload_json)) {
                // Filtramos sobre la raíz del array plano para sacar el itemId del insumo borrado
                const nuevoPayload = registroActual.payload_json.filter(item => !(item?._id === itemId && item?._type === 'inventario'));

                await supabaseServer
                    .from('catalog_cache')
                    .upsert({ 
                        tenant_host: tenantKey, 
                        payload_json: nuevoPayload, 
                        updated_at: new Date().toISOString() 
                    }, { onConflict: 'tenant_host' });

                console.log(`⚡ Insumo removido del array plano de la caché para: ${tenantId}`);
            }
        } catch (cacheError) {
            console.warn("⚠️ Falla no-bloqueante al remover el insumo de la caché plana:", cacheError.message);
        }
        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error('🔥 [API_DELETE_INVENTARIO_ERROR]:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}