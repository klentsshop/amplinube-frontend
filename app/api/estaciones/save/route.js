import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';

export async function POST(request) {
    try {
        const { categorias, tenantAlias, impresoraNombre, ancho_papel } = await request.json();

        if (!tenantAlias) return NextResponse.json({ error: "Falta el tenant" }, { status: 400 });

        const cleanTenant = tenantAlias.trim().toLowerCase();
        const categoriasString = Array.isArray(categorias) ? categorias.join(',') : (categorias || '');
        const impresoraLimpia = impresoraNombre ? impresoraNombre.trim() : null;
        const anchoPapelNum = Number(ancho_papel) || 58;

        // 1. Actualización primaria en la tabla relacional 'negocios'
        const { error: errNegocios } = await supabaseServer
            .from('negocios')
            .update({ 
                categorias: categoriasString, 
                impresoraNombre: impresoraLimpia,
                ancho_papel: anchoPapelNum,
                updated_at: new Date().toISOString() 
            })
            .eq('tenant', cleanTenant);

        if (errNegocios) throw errNegocios;

        // 2. ⚡ Inyección atómica en 'catalog_cache' para invalidación en caliente (POS Masivo / Standard)
        const { data: cacheExistente } = await supabaseServer
            .from('catalog_cache')
            .select('payload_json')
            .eq('tenant_host', cleanTenant)
            .maybeSingle();

        if (cacheExistente?.payload_json && Array.isArray(cacheExistente.payload_json)) {
            const payloadActualizado = cacheExistente.payload_json.map(item => {
                if (item._type === 'negocio' || item._type === 'estacionPC' || item.tenant === cleanTenant) {
                    return {
                        ...item,
                        categorias: categoriasString,
                        categoriasVinculadas: categoriasString.split(','),
                        impresoraNombre: impresoraLimpia,
                        ancho_papel: anchoPapelNum,
                        anchoPapel: anchoPapelNum
                    };
                }
                return item;
            });

            await supabaseServer
                .from('catalog_cache')
                .update({ 
                    payload_json: payloadActualizado, 
                    updated_at: new Date().toISOString() 
                })
                .eq('tenant_host', cleanTenant);
        }

        return NextResponse.json({ 
            success: true, 
            categorias: categoriasString, 
            impresoraNombre: impresoraLimpia,
            ancho_papel: anchoPapelNum
        });

    } catch (error) {
        console.error("🔥 [ERROR_SAVE_ESTACIONES]:", error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}