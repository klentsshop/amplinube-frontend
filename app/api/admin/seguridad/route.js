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

        // Mapeamos el payload al formato exacto que espera recibir el frontend para no romper nada
        let configuracion = null;
        
        if (configNegocio?.payload_json) {
            const p = configNegocio.payload_json;
            // Evaluamos las rutas dinámicas en las que el escudo clona la seguridad
            const pinAdmin = p?.seguridad?.pinAdmin || p?.configSeguridad?.pinAdmin || p?.pinAdmin;
            const pinCajero = p?.seguridad?.pinCajero || p?.configSeguridad?.pinCajero || p?.pinCajero;
            const id = p?.seguridad?._id || p?.configSeguridad?._id || p?._id || 'seguridad_cache';

            if (pinAdmin || pinCajero) {
                configuracion = {
                    _id: id,
                    pinCajero: pinCajero ? String(pinCajero).trim() : "",
                    pinAdmin: pinAdmin ? String(pinAdmin).trim() : ""
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

        // 🪓 GUILLOTINA SÍNCRONA: Destruimos la caché en Supabase para que los nuevos PINs entren en vigencia de inmediato
        try {
            await supabaseServer
                .from('catalog_cache')
                .delete()
                .eq('tenant_host', tenantId.toLowerCase().trim());
            console.log(`🗑️ Caché invalidado síncronamente tras actualización de seguridad para: ${tenantId}`);
        } catch (cacheError) {
            console.warn("⚠️ Falla no-bloqueante al purgar caché desde PUT seguridad:", cacheError.message);
        }

        return NextResponse.json({ ok: true, id: resultId });
    } catch (error) {
        console.error('🔥 [API_PUT_SEGURIDAD_ERROR]:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}