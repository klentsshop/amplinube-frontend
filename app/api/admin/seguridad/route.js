import { NextResponse } from 'next/server';
import { sanityClientServer } from '@/lib/sanity';
import { supabaseServer } from '@/lib/supabase'; // 🛡️ Cliente oficial de Supabase

export const dynamic = 'force-dynamic';

// 🔍 1. OBTENER LOS PINES DEL NEGOCIO DESDE EL ESCUDO (Zero llamadas a Sanity)
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const tenantId = searchParams.get('tenantId');

        if (!tenantId) {
            return NextResponse.json({ error: 'Falta el tenantId.' }, { status: 400 });
        }

        // 🛡️ BISTURÍ: Jalamos la configuración directamente desde el búnker local de Supabase
        const { data: configNegocio } = await supabaseServer
            .from('catalog_cache')
            .select('payload_json')
            .eq('tenant_host', tenantId.toLowerCase().trim())
            .single();

       // 🛡️ BISTURÍ: Buscamos el objeto plano de seguridad dentro del array payload_json
        let configuracion = null;

        if (configNegocio?.payload_json && Array.isArray(configNegocio.payload_json)) {
            const docSeguridad = configNegocio.payload_json.find(item => item?._type === 'seguridad');
            
            if (docSeguridad) {
                configuracion = {
                    _id: docSeguridad._id,
                    pinCajero: docSeguridad.pinCajero ? String(docSeguridad.pinCajero).trim() : "",
                    pinAdmin: docSeguridad.pinAdmin ? String(docSeguridad.pinAdmin).trim() : ""
                };
            }
        }
        return NextResponse.json({ ok: true, data: configuracion });
    } catch (error) {
        console.error('🔥 [API_GET_SEGURIDAD_ERROR]:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// 🔄 2. ACTUALIZAR O INICIALIZAR PINES (Con Guillotina Síncrona)
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

        // ⚡ ACTUALIZACIÓN EN CALIENTE DE LA CONFIGURACIÓN DE SEGURIDAD (Cero borrados destructivos)
        try {
            const tenantKey = tenantId.toLowerCase().trim();

            // 1. Traemos el array plano actual
            const { data: registroActual } = await supabaseServer
                .from('catalog_cache')
                .select('payload_json')
                .eq('tenant_host', tenantKey)
                .single();

            if (registroActual && Array.isArray(registroActual.payload_json)) {
                let existeSeguridad = false;

                // 2. Mapeamos si ya existía el objeto seguridad dentro del array plano
                let nuevoPayload = registroActual.payload_json.map(item => {
                    if (item?._type === 'seguridad') {
                        existeSeguridad = true;
                        return {
                            ...item,
                            _id: resultId,
                            pinCajero: pinCajero.trim(),
                            pinAdmin: pinAdmin.trim(),
                            _updatedAt: new Date().toISOString()
                        };
                    }
                    return item;
                });

                // 3. Si no existía el objeto seguridad en el array, lo inyectamos de primero
                if (!existeSeguridad) {
                    const nuevoDocSeguridadCache = {
                        _id: resultId,
                        _type: 'seguridad',
                        tenant: tenantId,
                        pinAdmin: pinAdmin.trim(),
                        pinCajero: pinCajero.trim(),
                        _createdAt: new Date().toISOString(),
                        _updatedAt: new Date().toISOString()
                    };
                    nuevoPayload = [nuevoDocSeguridadCache, ...registroActual.payload_json];
                }

                // 4. Hacemos upsert atómico de la fila manteniendo vivo el escudo plano
                await supabaseServer
                    .from('catalog_cache')
                    .upsert({ 
                        tenant_host: tenantKey, 
                        payload_json: nuevoPayload, 
                        updated_at: new Date().toISOString() 
                    }, { onConflict: 'tenant_host' });

                console.log(`⚡ Seguridad actualizada en caliente dentro del array plano para: ${tenantId}`);
            }
        } catch (cacheError) {
            console.warn("⚠️ Falla no-bloqueante al actualizar la seguridad en la caché plana:", cacheError.message);
        }
        return NextResponse.json({ ok: true, id: resultId });
    } catch (error) {
        console.error('🔥 [API_PUT_SEGURIDAD_ERROR]:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}