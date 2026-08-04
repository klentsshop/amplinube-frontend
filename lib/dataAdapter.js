import { client } from '@/lib/sanity';
import { CURRENT_TENANT } from '@/lib/config';

/**
 * 🛡️ REFUERZO DE SEGURIDAD MULTITENANT
 */
const getActiveTenant = (providedId) => {
    if (!providedId) {
        return CURRENT_TENANT;
    }
    return providedId;
};

// 🛰️ CACHÉ EN MEMORIA VOLÁTIL
let cacheMemoriaLocal = null;
let peticionEnVuelo = null;

// 🛡️ FUNCIÓN INTERNA AUXILIAR DEL ESCUDO (Deduplicación y Resiliencia SSR)
async function consultarEscudoCentral(tenantId) {
    if (cacheMemoriaLocal) return cacheMemoriaLocal;
    if (peticionEnVuelo) return peticionEnVuelo;

    peticionEnVuelo = (async () => {
        try {
            const esServidor = typeof window === 'undefined';
            // 🚀 CLAVE 1: SE INCLUYE EL TENANTID EN LA PETICIÓN
            const baseUrl = esServidor ? '/api/catalogo' : `${window.location.origin}/api/catalogo`;
            const URL_API = tenantId ? `${baseUrl}?tenantId=${tenantId}` : baseUrl;

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

    const paqueteCompleto = await consultarEscudoCentral(activeTenant);
    
    // 1. Filtrado por tipo y disponibilidad blindada (Soporta esquemas migrados y nativos de Supabase)
    const platosRaw = paqueteCompleto.filter(item => {
        const esPlato = item._type === 'plato' || item._type === 'producto' || item.id || item._id;
        const estaDisponible = item.disponible !== false && item.disponible !== 0;
        return esPlato && estaDisponible;
    });
    
    const categoriasRaw = paqueteCompleto.filter(item => item._type === 'categoria' || item.titulo || item.nombre);

    // 2. Mapeo y normalización de FKs de Supabase + Sanity
    const platosFormateados = platosRaw.map(p => {
        const catRef = typeof p.categoria === 'object' ? p.categoria?._ref : p.categoria;
        
        // Búsqueda profunda de categoría por id, _id o slug
        const catVinculada = categoriasRaw.find(c => 
            String(c._id || c.id) === String(catRef) || 
            String(c.slug?.current || c.slug).toLowerCase() === String(catRef).toLowerCase()
        );

        // Resolver el nombre final en MAYÚSCULAS
        let nombreCategoria = "COCINA";
        if (catVinculada) {
            nombreCategoria = catVinculada.titulo || catVinculada.nombre || "COCINA";
        } else if (typeof catRef === 'string' && catRef.trim().length > 0) {
            nombreCategoria = catRef;
        }

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
            seImprime: catVinculada?.se_imprime ?? catVinculada?.seImprime ?? p.seImprime ?? true,
            stockActual: Number(p.stockActual ?? p.stock_actual ?? 0),
            stockMinimo: Number(p.stockMinimo ?? p.stock_minimo ?? 0),
            recetaInsumos: recetaNormalizada,
            esVentaPorPeso: p.esVentaPorPeso === true || p.es_venta_por_peso === true
        };
    });

    // 3. Orden alfabético
    return platosFormateados.sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));
}

/**
 * 👥 Obtener Meseros
 */
export async function getMeseros(tenantId) {
    const activeTenant = getActiveTenant(tenantId);
    if (!activeTenant) return [];

    const paqueteCompleto = await consultarEscudoCentral(activeTenant);
    const meseros = paqueteCompleto.filter(item => item._type === 'mesero');
    
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
 * 🛡️ Obtener PIN de Seguridad
 */
export async function getSeguridad(tenantId) {
    const activeTenant = getActiveTenant(tenantId);
    if (!activeTenant) return null;

    const paqueteCompleto = await consultarEscudoCentral(activeTenant);
    const seguridadObj = paqueteCompleto.find(item => item._type === 'seguridad');
    
    return seguridadObj ? { pinAdmin: seguridadObj.pinAdmin, pinCajero: seguridadObj.pinCajero } : null;
}

/**
 * 📊 Guardar Venta
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