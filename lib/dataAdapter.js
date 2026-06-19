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
 * 🛒 Obtener Menú (Bisturí Senior: Reconstrucción fiel de Tipos y Coalesces de tu GROQ)
 */
export async function getProductos(tenantId) {
    const activeTenant = getActiveTenant(tenantId);
    if (!activeTenant) return [];

    const paqueteCompleto = await consultarEscudoCentral();
    
    // 1. Aislamiento perimetral por tipo y disponibilidad
    const platosRaw = paqueteCompleto.filter(item => item._type === 'plato' && item.disponible !== false);
    const categoriasRaw = paqueteCompleto.filter(item => item._type === 'categoria');

    // 2. Mapeo relacional idéntico a las expansiones de referencias (->) de Sanity
    const platosFormateados = platosRaw.map(p => {
    const idCat = p.categoria?._ref;
    const catVinculada = categoriasRaw.find(c => c._id === idCat);

    const recetaNormalizada = Array.isArray(p.recetaInsumos)
        ? p.recetaInsumos.map(r => ({
            insumoId: r.insumo?._ref || r.insumoId || null,
            cantidad: r.cantidad || 0
          }))
        : [];

    return {
        ...p,
        _id: p._id || p.id,
        // 🛡️ REFUERZO DE IMAGEN CRUDA: Mantiene el nodo tal cual viene en tu JSON plano de Supabase
        imagen: p.imagen || null, 
        categoria: catVinculada?.titulo ? catVinculada.titulo.toString().toUpperCase().trim() : "COCINA",
        seImprime: catVinculada?.seImprime ?? true,
        stockActual: p.stockActual ?? 0,
        stockMinimo: p.stockMinimo ?? 0,
        recetaInsumos: recetaNormalizada,
        esVentaPorPeso: p.esVentaPorPeso === true
    };
});

    // 3. Simula: | order(nombre asc)
    return platosFormateados.sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));
}

/**
 * 👥 Obtener Meseros (Bisturí: Filtra y ordena alfabéticamente)
 */
export async function getMeseros(tenantId) {
    const activeTenant = getActiveTenant(tenantId);
    if (!activeTenant) return [];

    const paqueteCompleto = await consultarEscudoCentral();
    const meseros = paqueteCompleto.filter(item => item._type === 'mesero');
    
    // Mantiene el orden: | order(nombre asc)
    return meseros.sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));
}

/**
 * 🛡️ Obtener PIN de Seguridad (Bisturí: Atrapa el objeto del payload sin impactar red)
 */
export async function getSeguridad(tenantId) {
    const activeTenant = getActiveTenant(tenantId);
    if (!activeTenant) return null;

    const paqueteCompleto = await consultarEscudoCentral();
    const seguridadObj = paqueteCompleto.find(item => item._type === 'seguridad');
    
    return seguridadObj ? { pinAdmin: seguridadObj.pinAdmin, pinCajero: seguridadObj.pinCajero } : null;
}

/**
 * 📊 Guardar Venta (Híbrida con acople a Supabase) - 100% INTACTA
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
 * 🏢 Obtener Datos de Identidad del Negocio - 100% INTACTA (Solo corre una vez al loguearse)
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
 * 🗑️ FUNCIÓN ADICIONAL DE CONTROL (Opcional por si necesitas forzar limpieza desde UI)
 */
export function limpiarCacheLocal() {
    cacheMemoriaLocal = null;
}