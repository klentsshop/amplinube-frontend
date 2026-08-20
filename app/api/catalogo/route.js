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

// 1. LECTURA RÁPIDA DEL BÚNKER (Cache HIT $0 Impacto - Sanitización Atómica)
        const { data: cacheExistente, error: errCache } = await supabaseServer
            .from('catalog_cache')
            .select('payload_json')
            .eq('tenant_host', tenantAlias)
            .maybeSingle();

        if (cacheExistente?.payload_json && !errCache) {
            let payloadLimpio = cacheExistente.payload_json;

            // 🛡️ Des-serialización si viene como String escapado de Postgres
            if (typeof payloadLimpio === 'string') {
                try {
                    payloadLimpio = JSON.parse(payloadLimpio);
                } catch (e) {
                    console.warn(`⚠️ Error deserializando payload_json de [${tenantAlias}]:`, e.message);
                }
            }

            if (Array.isArray(payloadLimpio) && payloadLimpio.length > 0) {
                // 🔒 FILTRO DE SEGURIDAD ABSOLUTO: Erradica cualquier objeto de seguridad en Cache HIT
                payloadLimpio = payloadLimpio.filter(item => item._type !== 'seguridad');

                // 🧠 EVALUACIÓN DE INTEGRIDAD PARA NEGOCIOS ESTÁNDAR (<3000) vs MASIVOS (>=3000)
                const tienePlatosEnCache = payloadLimpio.some(item => item._type === 'plato' || item._type === 'producto');
                const tieneCategorias = payloadLimpio.some(item => item._type === 'categoria');

                // Si la caché tiene platos (< 3000 como demo) O no tiene categorías, sirve Cache HIT
                if (tienePlatosEnCache || !tieneCategorias) {
                    return NextResponse.json(payloadLimpio, {
                        headers: { 'X-Cache-Status': 'HIT' }
                    });
                }
                
                // Si tiene categorías pero 0 platos (Caso Búnker Masivo >= 3000), continua abajo a reconstruir
                console.log(`⚡ Caché Masiva sin productos para [${tenantAlias}]. Reconstruyendo...`);
            }
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
            // D. Residual de Sanity (Cero seguridad enviada desde la query)
            sanityClient.fetch(
                `*[( _type == "estacionPC" && tenant == $tenantAlias ) || ( _type == "negocio" && slug.current == $tenantAlias )]`,
                { tenantAlias }
            ).catch(err => {
                console.warn("⚠️ Error leyendo Sanity en Miss:", err.message);
                return [];
            })
        ]);

        const categoriasSupabase = resCategorias.data || [];
        const meserosSupabase = resMeseros.data || [];
        const datosSanity = Array.isArray(resSanity) ? resSanity : [];

        // 3. NORMALIZACIÓN EXACTA Y MAPEO DE CATEGORÍAS (Estructura Limpia Postgres)
        const categoriasProcesadas = categoriasSupabase.map(c => {
            const idVal = String(c.id || c._id || '');
            const tituloVal = String(c.titulo || c.nombre || 'GENERAL').toUpperCase();

            return {
                _id: idVal,
                id: idVal,
                _type: 'categoria',
                tenant: tenantAlias,
                titulo: tituloVal,
                nombre: tituloVal,
                seImprime: c.se_imprime !== false,
                orden: Number(c.orden || 1)
            };
        });

        const productosProcesados = platosSupabase.map(p => {
            let rawCat = '';
            if (typeof p.categoria === 'string') {
                rawCat = p.categoria;
            } else if (p.categoria && typeof p.categoria === 'object') {
                rawCat = p.categoria._ref || p.categoria.id || p.categoria.nombre || '';
            }

            const normalizarCadena = (str) => String(str || '').toLowerCase().trim();
            const catRefLimpio = normalizarCadena(rawCat);

            // Búsqueda del UUID de la categoría vinculada
            const catVinculada = categoriasProcesadas.find(c => {
                const idCat = normalizarCadena(c.id);
                const tituloCat = normalizarCadena(c.titulo);
                return idCat === catRefLimpio || tituloCat === catRefLimpio;
            });

            const urlImagen = typeof p.imagen === 'string' ? p.imagen : (p.imagen?.url || null);
            const uuidCategoriaFinal = catVinculada ? catVinculada.id : rawCat;
            const tituloCategoriaFinal = catVinculada ? catVinculada.titulo : 'GENERAL';
            const seImprimeFinal = catVinculada ? catVinculada.seImprime : true;

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
                
                // 🛡️ CAMPOS CLAVE PARA EL POS E IMPRESIÓN DIRECTA
                categoria: uuidCategoriaFinal, // UUID Relacional
                categoriaNombre: tituloCategoriaFinal, // TÍTULO PARA TICKET / COMANDA
                seImprime: seImprimeFinal, // INDICADOR DE IMPRESIÓN
                categoriaRef: uuidCategoriaFinal ? { _ref: uuidCategoriaFinal, _type: 'reference' } : null,
                
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

        // 4. UNIFICACIÓN COMPLETA DE PAYLOAD HÍBRIDO (Sanitizado sin PINes)
        const esCatalogoMasivo = productosProcesados.length >= 3000;
        const productosAEmbeber = esCatalogoMasivo ? [] : productosProcesados;

        // 🔒 Cierre hermético: Filtra explícitamente cualquier residuo de seguridad
        const datosSanityLimpios = datosSanity.filter(item => item._type !== 'seguridad');

        const payloadCacheGuardar = [
            ...categoriasProcesadas,
            ...productosAEmbeber,
            ...meserosProcesados,
            ...datosSanityLimpios
        ];

        const payloadRespuesta = [
            ...categoriasProcesadas,
            ...productosProcesados,
            ...meserosProcesados,
            ...datosSanityLimpios
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