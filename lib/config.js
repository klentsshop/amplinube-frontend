// Archivo: lib/config.js

export const SYSTEM = {
    name: "Socio POS", 
    version: "1.2.0",
    developer: "Klentsshop"
};

// 🚀 DETERMINAR EL TENANT ACTUAL
// 1. Mira si estamos en el navegador y saca el subdominio (ej: demo.sociopos.com)
// 2. Si no hay subdominio, busca una variable de entorno
// 3. Si todo falla, usa "demo" como fallback
const getTenant = () => {
    if (typeof window !== 'undefined') {
        const hostname = window.location.hostname;

        // 1. Si estamos probando en Localhost, la prioridad la tiene el archivo .env
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            return process.env.NEXT_PUBLIC_TENANT_ID || "demo";
        }

        // 2. Si estamos en producción (Netlify), extraemos estrictamente el subdominio
        const parts = hostname.split('.');
        if (parts.length >= 3) {
            const subdomain = parts[0].toLowerCase();
            // Evitamos que subdominios técnicos comunes se confundan con clientes
            if (subdomain !== 'www' && subdomain !== 'app' && subdomain !== 'api') {
                return subdomain;
            }
        }
    }
    
    // Fallback de seguridad absoluta si no se detecta subdominio en producción
    return process.env.NEXT_PUBLIC_TENANT_ID || "demo";
};

// 🎯 La Fuente de la Verdad Única para todo el Frontend
export const CURRENT_TENANT = getTenant();
export const DEFAULT_CONFIG = {
    brand: {
        name: "Socio POS",
        nit: "900.000.000-1",
        address: "Cargando dirección...",
        phone: "000",
        mensajeTicket: "¡Gracias por su compra!",
        currency: "es-CO",
        symbol: "$",
    },

    theme: {
        primary: "#10B981", 
        secondary: "#166534",
        accent: "#F59E0B",
        danger: "#EF4444",
        dark: "#111827",
        textLight: "#FFFFFF",
        textDark: "#4B5563",
    },

    logic: {
        timezone: 'America/Bogota',
        drinkCategory: "bebidas",
        priorityKeywords: ["especial", "promo", "combo"],
        defaultAdminPin: "0000", 
   },
    
    // 💳 MÉTODOS DE PAGO RESTABLECIDOS
    metodosPago: [
        { title: '💵 Efectivo', value: 'efectivo' },
        { title: '📱 Digital', value: 'digital' },
        { title: '💳 Tarjeta', value: 'tarjeta' }
    ]
};

export const SITE_CONFIG = DEFAULT_CONFIG;