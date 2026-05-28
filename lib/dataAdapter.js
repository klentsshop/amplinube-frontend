// Archivo: dataAdapter.js
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

// 🛒 Obtener Menú
export async function getProductos(tenantId) {
    const activeTenant = getActiveTenant(tenantId);
    
    if (!activeTenant) return [];

    return await client.fetch(
        `*[_type == "plato" && tenant == $tenantId && disponible != false] | order(nombre asc){ 
            _id, 
            nombre, 
            precio, 
            disponible,
            "categoria": coalesce(categoria->titulo, "COCINA"),
            barcode,
            codigoBalanza,
            "seImprime": coalesce(categoria->seImprime, true),
            imagen,
            controlaInventario,
            insumoVinculado,
            cantidadADescontar,
            totalVentas,
            "recetaInsumos": recetaInsumos[]{
                "insumoId": insumo._ref,
                cantidad
            },
            "stockActual": coalesce(insumoVinculado->stockActual, 0),
            "stockMinimo": coalesce(insumoVinculado->stockMinimo, 0)
        }`,
        { tenantId: activeTenant }, 
        { useCdn: true } // 🚀 OPTIMIZADO SENIOR: Usa el CDN para salvar la cuota de peticiones
    );
}

// 👥 Obtener Meseros
export async function getMeseros(tenantId) {
    const activeTenant = getActiveTenant(tenantId);
    
    if (!activeTenant) return [];

    return await client.fetch(
        `*[_type == "mesero" && tenant == $tenantId] | order(nombre asc)`,
        { tenantId: activeTenant },
        { useCdn: true } // 🚀 OPTIMIZADO SENIOR: Usa el CDN
    );
}

// 🛡️ Obtener PIN de Seguridad
export async function getSeguridad(tenantId) {
    const activeTenant = getActiveTenant(tenantId);
    
    if (!activeTenant) return null;

    return await client.fetch(
        `*[_type == "seguridad" && tenant == $tenantId][0]{ pinAdmin, pinCajero }`,
        { tenantId: activeTenant },
        { useCdn: true } // 🚀 OPTIMIZADO SENIOR: Usa el CDN
    );
}

// 📊 Guardar Venta
export async function registrarVenta(datosVenta, tenantId) {
    const activeTenant = getActiveTenant(tenantId);

    if (!activeTenant) {
        console.error("❌ Error Crítico: No hay TenantID para registrar la venta");
        throw new Error("Falta identificador de negocio");
    }

    const ventaFinal = { 
        ...datosVenta, 
        tenant: activeTenant 
    };
    
    console.log("🚀 Sincronizando venta para:", activeTenant);

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
// 🏢 Obtener Datos de Identidad del Negocio (NUEVO)
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
            { useCdn: true } // El CDN salva tu cuota de peticiones
        );
    } catch (error) {
        console.warn("⚠️ No se pudieron cargar los datos dinámicos de Sanity:", error);
        return null;
    }
}