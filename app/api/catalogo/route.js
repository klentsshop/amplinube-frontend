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

/**
 * Función auxiliar para paginar la extracción de platos de Supabase en lotes
 * Evita recortes de respuesta por límites de API/RAM en catálogos extensos.
 */
async function obtenerTodosLosPlatos(tenantAlias) {
    let todosLosPlatos = [];
    let desde = 0;
    const paso = 1000;
    let hayMas = true;

    while (hayMas) {
        const { data, error } = await supabaseServer
            .from('platos')
            .select('*')
            .eq('tenant', tenantAlias)
            .range(desde, desde + paso - 1);

        if (error) {
            console.error(`🔥 Error leyendo bloque de platos (${desde} - ${desde + paso}):`, error.message);
            throw error;
        }

        if (data && data.length > 0) {
            todosLosPlatos = todosLosPlatos.concat(data);
        }

        if (!data || data.length < paso) {
            hayMas = false;
        } else {
            desde += paso;
        }
    }

    return todosLosPlatos;
}

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

        // 2. CACHE MISS: CONSULTA TRIPLE A SUPABASE + SANITY
        console.log(`🔄 Cache Miss para [${tenantAlias}]. Construyendo payload unificado...`);

        const [platosSupabase, resCategorias, resMeseros, resSanity] = await Promise.all([
            // A. Extracción Paginada Completa de Platos (1600+ productos)
            obtenerTodosLosPlatos(tenantAlias),
            // B. Categorías desde public.categorias
            supabaseServer.from('categorias').select('*').eq('tenant', tenantAlias),
            // C. Meseros desde public.meseros
            supabaseServer.from('meseros').select('*').eq('tenant', tenantAlias),
            // D. Residual de Sanity
            sanityClient.fetch(
                `*[( _type in ["estacionPC", "seguridad"] && tenant == $tenantAlias ) || ( _type == "negocio" && slug.current == $tenantAlias )]`,
                { tenantAlias }
            ).catch(err => {
                console.warn("⚠️ Error leyendo Sanity en Miss:", err.message);
                return [];
            })
        ]);

        const categoriasSupabase = resCategorias.data || [];
        const meserosSupabase = resMeseros.data || [];
        const datosSanity = Array.isArray(resSanity) ? resSanity : [];

        // 3. NORMALIZACIÓN EXACTA Y MAPEO DE CATEGORÍAS
        const categoriasProcesadas = categoriasSupabase.map(c => {
            const idVal = String(c.id || c._id || '');
            const tituloVal = c.titulo || c.nombre || 'GENERAL';
            const slugVal = c.slug || tituloVal.toLowerCase().trim().replace(/\s+/g, '-');

            return {
                _id: idVal,
                id: idVal,
                _type: 'categoria',
                tenant: tenantAlias,
                titulo: tituloVal,
                nombre: tituloVal,
                seImprime: c.se_imprime ?? c.seImprime ?? true,
                orden: c.orden || 1,
                slug: { _type: 'slug', current: slugVal }
            };
        });

        const productosProcesados = platosSupabase.map(p => {
            // Extraer el identificador o slug almacenado en el plato
            let rawCat = '';
            if (typeof p.categoria === 'string') {
                rawCat = p.categoria;
            } else if (p.categoria && typeof p.categoria === 'object') {
                rawCat = p.categoria._ref || p.categoria.current || p.categoria.nombre || '';
            }

            // Normalizador de cadenas para prevenir fallos por guiones duplicados o espacios extra
            const normalizarCadena = (str) => String(str || '').toLowerCase().trim().replace(/--+/g, '-');
            const catRefLimpio = normalizarCadena(rawCat);

            // Matcheo profundo: Busca si coincide por UUID, Slug o Título exacto/normalizado
            const catVinculada = categoriasProcesadas.find(c => {
                const idCat = normalizarCadena(c.id);
                const slugCat = normalizarCadena(c.slug?.current);
                const tituloCat = normalizarCadena(c.titulo);

                return idCat === catRefLimpio || 
                       slugCat === catRefLimpio || 
                       tituloCat === catRefLimpio;
            });

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
                    : { _ref: "3e75de88-a39a-49cd-9a7f-80f0bfe4f9eb", _type: 'reference' }, // Fallback para registros huérfanos
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

        // 4. UNIFICACIÓN COMPLETA DE PAYLOAD HÍBRIDO (Control de escala por volumen)
        const esCatalogoMasivo = productosProcesados.length >= 3000;

        // Para catálogos de >= 3,000 productos, no embebemos el pesado array de platos en el snapshot de la BD
        const productosAEmbeber = esCatalogoMasivo ? [] : productosProcesados;

        const payloadCacheGuardar = [
            ...categoriasProcesadas,
            ...productosAEmbeber,
            ...meserosProcesados,
            ...datosSanity
        ];

        // Para la respuesta directa al cliente, entregamos la estructura completa necesaria
        const payloadRespuesta = [
            ...categoriasProcesadas,
            ...productosProcesados,
            ...meserosProcesados,
            ...datosSanity
        ];

        // 5. ACTUALIZACIÓN DE CATALOG_CACHE
        if (payloadCacheGuardar.length > 0) {
            await supabaseServer
                .from('catalog_cache')
                .upsert({
                    tenant_host: tenantAlias,
                    payload_json: payloadCacheGuardar,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'tenant_host' });
        }

        return NextResponse.json(payloadRespuesta, {
            headers: { 
                'X-Cache-Status': 'MISS-REBUILT',
                'X-Catalog-Mode': esCatalogoMasivo ? 'MASIVO_DIRECTO' : 'ESTANDAR_CACHE'
            }
        });

    } catch (error) {
        console.error("🔥 Error crítico en API /catalogo:", error);
        return NextResponse.json({ error: "Error interno del servidor de datos" }, { status: 500 });
    }
}