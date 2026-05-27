import { NextResponse } from 'next/server';
import { sanityClientServer } from '@/lib/sanity';
import { DEFAULT_CONFIG } from '@/lib/config'; // Traemos los valores por defecto

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const tenantId = searchParams.get('tenantId');

        if (!tenantId) {
            return NextResponse.json({ error: 'Tenant ID requerido' }, { status: 400 });
        }

        // 🛡️ BISTURÍ: Usamos "configuracion" que es el nombre real del schema que migramos
        // Además, traemos el logo y colores si existen
        const query = `*[_type == "configuracion" && tenant == $tenantId][0]{
            nombreNegocio,
            nit,
            direccion,
            telefono,
            mensajeTicket,
            colores,
            logo
        }`;

        const configSanity = await sanityClientServer.fetch(query, { tenantId }, { useCdn: false });

        // 🧠 LÓGICA DE FUSIÓN:
        // Si hay datos en Sanity, los usamos. Si no, usamos el DEFAULT_CONFIG para que el POS no se rompa.
        const finalConfig = {
            brand: {
                name: configSanity?.nombreNegocio || DEFAULT_CONFIG.brand.name,
                nit: configSanity?.nit || DEFAULT_CONFIG.brand.nit,
                address: configSanity?.direccion || DEFAULT_CONFIG.brand.address,
                phone: configSanity?.telefono || DEFAULT_CONFIG.brand.phone,
                mensajeTicket: configSanity?.mensajeTicket || DEFAULT_CONFIG.brand.mensajeTicket,
            },
            theme: {
                ...DEFAULT_CONFIG.theme,
                primary: configSanity?.colores?.primary || DEFAULT_CONFIG.theme.primary,
            }
        };

        return NextResponse.json(finalConfig);

    } catch (error) {
        console.error("🔥 Error cargando configuración multitenant:", error);
        // Nunca devolvemos un error 500 si podemos devolver la configuración por defecto
        return NextResponse.json(DEFAULT_CONFIG);
    }
}