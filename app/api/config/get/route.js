import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase'; // 🛡️ Cliente oficial de Supabase
import { DEFAULT_CONFIG } from '@/lib/config'; // Traemos los valores por defecto

export const dynamic = 'force-dynamic';

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const tenantId = searchParams.get('tenantId');

        if (!tenantId) {
            return NextResponse.json({ error: 'Tenant ID requerido' }, { status: 400 });
        }

        // 🛡️ BISTURÍ SENIOR: Leemos la configuración pre-clonada directamente del búnker (Costos Sanity: $0)
        const { data: cacheRow } = await supabaseServer
            .from('catalog_cache')
            .select('payload_json')
            .eq('tenant_host', tenantId.toLowerCase().trim())
            .single();

        // Extraemos el nodo correspondiente a la configuración guardada por el escudo
        const p = cacheRow?.payload_json;
        const configSanity = p?.configuracion || p?.config || p;

        // 🧠 LÓGICA DE FUSIÓN PRESERVADA:
        // Si hay datos en el búnker, los usamos. Si no, mapeamos DEFAULT_CONFIG para que el POS no parpadee.
        const finalConfig = {
            brand: {
                name: configSanity?.nombreNegocio || configSanity?.brand?.name || DEFAULT_CONFIG.brand.name,
                nit: configSanity?.nit || configSanity?.brand?.nit || DEFAULT_CONFIG.brand.nit,
                address: configSanity?.direccion || configSanity?.brand?.address || DEFAULT_CONFIG.brand.address,
                phone: configSanity?.telefono || configSanity?.brand?.phone || DEFAULT_CONFIG.brand.phone,
                mensajeTicket: configSanity?.mensajeTicket || configSanity?.brand?.mensajeTicket || DEFAULT_CONFIG.brand.mensajeTicket,
            },
            theme: {
                ...DEFAULT_CONFIG.theme,
                primary: configSanity?.colores?.primary || configSanity?.theme?.primary || DEFAULT_CONFIG.theme.primary,
            }
        };

        return NextResponse.json(finalConfig);

    } catch (error) {
        console.error("🔥 Error cargando configuración desde el búnker multitenant:", error.message);
        // Respaldo absoluto: Nunca devolvemos un error 500 si podemos devolver la configuración por defecto
        return NextResponse.json(DEFAULT_CONFIG);
    }
}