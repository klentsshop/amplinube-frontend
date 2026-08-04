export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { NextResponse } from 'next/server';
import { createClient } from '@sanity/client';
import { supabaseServer } from '@/lib/supabase';

// 🔌 Client de Sanity residual para PINes, Estaciones y Negocio
const sanityClient = createClient({
    projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID,
    dataset: process.env.NEXT_PUBLIC_SANITY_DATASET,
    useCdn: false,
    apiVersion: '2026-03-01',
    token: process.env.SANITY_API_TOKEN
});

const extractTenantAlias = (hostHeader) => {
    if (!hostHeader) return (process.env.NEXT_PUBLIC_TENANT_ID || "demo").toLowerCase().trim();
    const hostname = hostHeader.split(':')[0].toLowerCase().trim();

    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return (process.env.NEXT_PUBLIC_TENANT_ID || "demo").toLowerCase().trim();
    }
    if (hostname.includes('--')) {
        return hostname.split('--')[0].toLowerCase().trim();
    }
    const parts = hostname.split('.');
    if (parts.length >= 3 && !['www', 'app', 'api'].includes(parts[0])) {
        return parts[0].toLowerCase().trim();
    }
    return (process.env.NEXT_PUBLIC_TENANT_ID || "demo").toLowerCase().trim();
};

export async function GET(request) {
    try {
        const hostHeader = request.headers.get('host') || '';
        const tenantAlias = extractTenantAlias(hostHeader);

        console.log(`🛡️ Escudo procesando petición para Tenant: [${tenantAlias}]`);

        // 1. LECTURA RÁPIDA DEL BÚNKER (Cache HIT $0 Impacto)
        const { data: cacheExistente, error: errCache } = await supabaseServer
            .from('catalog_cache')
            .select('payload_json')
            .eq('tenant_host', tenantAlias)
            .maybeSingle();

        if (cacheExistente && !errCache && Array.isArray(cacheExistente.payload_json) && cacheExistente.payload_json.length > 0) {
            return NextResponse.json(cacheExistente.payload_json, {
                headers: { 'X-Cache-Status': 'HIT' }
            });
        }

        // 2. CACHE MISS: CONSULTA TRIPLE A SUPABASE (PLATOS, CATEGORIAS, MESEROS) + SANITY
        console.log(`🔄 Cache Miss para [${tenantAlias}]. Construyendo payload unificado desde Supabase...`);

        const [resPlatos, resCategorias, resMeseros, resSanity] = await Promise.all([
            // A. Platos desde public.platos
            supabaseServer.from('platos').select('*').eq('tenant', tenantAlias),
            // B. Categorías desde public.categorias
            supabaseServer.from('categorias').select('*').eq('tenant', tenantAlias),
            // C. Meseros desde public.meseros
            supabaseServer.from('meseros').select('*').eq('tenant', tenantAlias),
            // D. Residual de Sanity (Negocio, Estaciones, Seguridad)
            sanityClient.fetch(
                `*[( _type in ["estacionPC", "seguridad"] && tenant == $tenantAlias ) || ( _type == "negocio" && slug.current == $tenantAlias )]`,
                { tenantAlias }
            ).catch(err => {
                console.warn("⚠️ Error leyendo Sanity en Miss:", err.message);
                return [];
            })
        ]);

        const platosSupabase = resPlatos.data || [];
        const categoriasSupabase = resCategorias.data || [];
        const meserosSupabase = resMeseros.data || [];
        const datosSanity = Array.isArray(resSanity) ? resSanity : [];

        // 3. NORMALIZACIÓN EXACTA AL FORMATO DEL ESCUDO POS
        const categoriasProcesadas = categoriasSupabase.map(c => ({
            _id: c.id,
            id: c.id,
            _type: 'categoria',
            tenant: tenantAlias,
            titulo: c.titulo || 'GENERAL',
            seImprime: c.se_imprime ?? true,
            orden: c.orden || 1,
            slug: { _type: 'slug', current: c.slug || (c.titulo || 'gen').toLowerCase().replace(/\s+/g, '-') }
        }));

        const productosProcesados = platosSupabase.map(p => {
            const catVinculada = categoriasProcesadas.find(c => c._id === p.categoria || c.id === p.categoria);
            const urlImagen = typeof p.imagen === 'string' ? p.imagen : (p.imagen?.url || null);

            return {
                _id: p.id,
                id: p.id,
                _type: 'plato',
                tenant: tenantAlias,
                nombre: p.nombre,
                precio: Number(p.precio) || 0,
                precioCosto: Number(p.precio_costo || 0),
                disponible: p.disponible !== false,
                barcode: p.barcode || null,
                codigoBalanza: p.codigo_balanza || null,
                imagenUrl: urlImagen,
                imagen: urlImagen ? { _type: 'image', asset: { url: urlImagen } } : null,
                categoria: catVinculada 
                    ? { _ref: catVinculada._id, _type: 'reference' } 
                    : (p.categoria ? { _ref: p.categoria, _type: 'reference' } : "COCINA"),
                recetaInsumos: p.receta_insumos || [],
                esVentaPorPeso: p.es_venta_por_peso === true,
                controlaInventario: p.controla_inventario === true,
                totalVentas: p.total_ventas || 0
            };
        });

        const meserosProcesados = meserosSupabase.map(m => ({
            _id: m.id,
            id: m.id,
            _type: 'mesero',
            tenant: tenantAlias,
            nombre: m.nombre,
            activo: m.activo !== false,
            verReporte: m.ver_reporte ?? false,
            verAdmin: m.ver_admin ?? false,
            puedeCargarGasto: m.puede_cargar_gasto ?? false,
            verVentas: m.ver_ventas ?? false,
            verInventario: m.ver_inventario ?? false,
            puedeCobrar: m.puede_cobrar ?? false
        }));

        // 4. UNIFICACIÓN COMPLETA
        const payloadUnificado = [
            ...categoriasProcesadas,
            ...productosProcesados,
            ...meserosProcesados,
            ...datosSanity
        ];

        // 5. GUARDADO EN CATALOG_CACHE
        if (payloadUnificado.length > 0) {
            await supabaseServer
                .from('catalog_cache')
                .upsert({
                    tenant_host: tenantAlias,
                    payload_json: payloadUnificado,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'tenant_host' });
        }

        return NextResponse.json(payloadUnificado, {
            headers: { 'X-Cache-Status': 'MISS-REBUILT' }
        });

    } catch (error) {
        console.error("🔥 Error crítico en API /catalogo:", error);
        return NextResponse.json({ error: "Error interno del servidor de datos" }, { status: 500 });
    }
}