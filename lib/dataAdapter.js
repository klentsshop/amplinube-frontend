import { client } from '@/lib/sanity';
import { CURRENT_TENANT } from '@/lib/config';

/**
 * 🛡️ REFUERZO DE SEGURIDAD MULTITENANT:
 * Si el componente que llama la función olvida pasar el tenantId,
 * el sistema recurre al CURRENT_TENANT calculado dinámicamente.
 */
const getActiveTenant = (providedId) => {
    if (!providedId) {
        return CURRENT_TENANT;
    }
    return providedId;
};

// 🛰️ CACHÉ EN MEMORIA VOLÁTIL Y CONTROL DE PETICIONES SIMULTÁNEAS
let cacheMemoriaLocal = null;
let peticionEnVuelo = null;

// 🛡️ FUNCIÓN INTERNA AUXILIAR DEL ESCUDO (Deduplicación y Resiliencia SSR)
async function consultarEscudoCentral() {
    // 1. Si ya tenemos el catálogo cargado en esta sesión/ciclo, lo servimos de inmediato
    if (cacheMemoriaLocal) return cacheMemoriaLocal;

    // 2. Si ya hay una petición de catálogo viajando por la red, nos subimos a su promesa
    if (peticionEnVuelo) return peticionEnVuelo;

    peticionEnVuelo = (async () => {
        try {
            // Control estricto para evitar fallas si se ejecuta en servidor durante hidratación
            const esServidor = typeof window === 'undefined';
            const URL_API = esServidor ? '/api/catalogo' : `${window.location.origin}/api/catalogo`;

            const respuesta = await fetch(URL_API, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });

            if (!respuesta.ok) throw new Error(`HTTP Error: ${respuesta.status}`);
            
            const data = await respuesta.json();
            cacheMemoriaLocal = Array.isArray(data) ? data : [];
            return cacheMemoriaLocal;

        } catch (error) {
            console.error("🔥 Falla crítica en puente del adaptador con el escudo:", error);
            return [];
        } finally {
            // Liberamos el candado de la petición para futuros llamados de revalidación
            peticionEnVuelo = null;
        }
    })();

    return peticionEnVuelo;
}

/**
 * 🛒 Obtener Menú (Adaptado a Supabase conservando interfaz Sanity)
 */
export async function getProductos(tenantId) {
    const activeTenant = getActiveTenant(tenantId);
    if (!activeTenant) return [];

    const paqueteCompleto = await consultarEscudoCentral();
    
    // 1. Filtrado por tipo y disponibilidad (Soporta esquemas migrados)
    const platosRaw = paqueteCompleto.filter(item => (item._type === 'plato' || item._type === 'producto') && item.disponible !== false);
    const categoriasRaw = paqueteCompleto.filter(item => item._type === 'categoria');

    // 2. Mapeo y normalización de FKs de Supabase + Sanity
const platosFormateados = platosRaw.map(p => {
    // Extraer el identificador/ref/slug de la categoría
    const catRef = typeof p.categoria === 'object' ? p.categoria?._ref : p.categoria;
    
    // Búsqueda profunda en las categorías
    const catVinculada = categoriasRaw.find(c => 
        c._id === catRef || 
        c.id === catRef || 
        c.slug?.current === catRef || 
        c.slug === catRef
    );

    // Resolver el nombre final en MAYÚSCULAS
    let nombreCategoria = "COCINA";
    if (catVinculada) {
        nombreCategoria = catVinculada.titulo || catVinculada.nombre || "COCINA";
    } else if (typeof catRef === 'string' && catRef.trim().length > 0) {
        // Si no se encontró la entidad pero venía un string (slug o nombre directo), usarlo limpiando guiones si se requiere
        nombreCategoria = catRef;
    }

    // Soporte dual para recetas (FK directa de Supabase o _ref de Sanity)
    const recetaNormalizada = Array.isArray(p.recetaInsumos)
        ? p.recetaInsumos.map(r => ({
            insumoId: r.insumo_id || r.insumoId || r.insumo?._ref || r.insumo?.id || null,
            cantidad: Number(r.cantidad) || 0
          }))
        : [];

    return {
        ...p,
        _id: p._id || p.id,
        id: p.id || p._id,
        imagen: p.imagen || null, 
        categoria: nombreCategoria.toString().toUpperCase().trim(),
        seImprime: catVinculada?.seImprime ?? p.seImprime ?? true,
        stockActual: Number(p.stockActual ?? p.stock_actual ?? 0),
        stockMinimo: Number(p.stockMinimo ?? p.stock_minimo ?? 0),
        recetaInsumos: recetaNormalizada,
        esVentaPorPeso: p.esVentaPorPeso === true || p.es_venta_por_peso === true
    };
});

    // 3. Orden alfabético idéntico
    return platosFormateados.sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));
}

/**
 * 👥 Obtener Meseros (Adaptado a Supabase conservando interfaz Sanity)
 */
export async function getMeseros(tenantId) {
    const activeTenant = getActiveTenant(tenantId);
    if (!activeTenant) return [];

    const paqueteCompleto = await consultarEscudoCentral();
    const meseros = paqueteCompleto.filter(item => item._type === 'mesero');
    
    // Normaliza identificadores id/_id y mapea manteniendo orden alfabético
    return meseros
        .map(m => ({
            ...m,
            _id: m._id || m.id,
            id: m.id || m._id,
            nombre: m.nombre || ""
        }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre));
}

/**
 * 🛡️ Obtener PIN de Seguridad (Atrapa el objeto del payload sin impactar red)
 */
export async function getSeguridad(tenantId) {
    const activeTenant = getActiveTenant(tenantId);
    if (!activeTenant) return null;

    const paqueteCompleto = await consultarEscudoCentral();
    const seguridadObj = paqueteCompleto.find(item => item._type === 'seguridad');
    
    return seguridadObj ? { pinAdmin: seguridadObj.pinAdmin, pinCajero: seguridadObj.pinCajero } : null;
}

/**
 * 📊 Guardar Venta (Híbrida con acople a Supabase)
 */
export async function registrarVenta(datosVenta, tenantId) {
    const activeTenant = getActiveTenant(tenantId);

    if (!activeTenant) {
        console.error("❌ Error Crítico: No hay TenantID para registrar la venta");
        throw new Error("Falta identificador de negocio");
    }

    const ventaFinal = { 
        ...datosVenta, 
        tenant: activeTenant,
        tenantId: activeTenant, 
        clienteId: datosVenta.clienteId || datosVenta.clienteActivo?.id || datosVenta.clienteActivo?._id || null
    };
    
    console.log("🚀 Sincronizando venta para Supabase desde Adaptador:", activeTenant);

    const res = await fetch('/api/ventas', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(ventaFinal) 
    });

    if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Error en el servidor al cerrar mesa");
    }

    return res;
}

/**
 * 🏢 Obtener Datos de Identidad del Negocio
 */
export async function getDatosNegocio(tenantId) {
    const activeTenant = getActiveTenant(tenantId);
    if (!activeTenant) return null;

    try {
        return await client.fetch(
            `*[_type == "negocio" && slug.current == $tenantId][0]{
                nombre,
                nit,
                direccion,
                telefono,
                colordark
            }`,
            { tenantId: activeTenant },
            { useCdn: true }
        );
    } catch (error) {
        console.warn("⚠️ No se pudieron cargar los datos dinámicos de Sanity:", error);
        return null;
    }
}

/**
 * 🗑️ Limpieza de caché local
 */
export function limpiarCacheLocal() {
    cacheMemoriaLocal = null;
}