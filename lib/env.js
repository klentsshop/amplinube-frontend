// Archivo: lib/env.js

export const ENV = {
    // 🚀 MODO: "production" (Usa Sanity) o "template" (Usa DEMO_DATA para pruebas rápidas)
    mode: process.env.NEXT_PUBLIC_APP_MODE || "production", 
    
    // 🛡️ SEGURIDAD: Define si permitimos que el sistema funcione sin TenantId (Recomendado: false)
    strictMultitenant: true,

    // 🕒 CONFIGURACIÓN GLOBAL
    version: "1.2.5",
    build: "2026-05-16"
};

/**
 * 💡 DEMO_DATA: 
 * Se mantiene vacío para asegurar que el sistema falle si no hay conexión 
 * a Sanity en producción, evitando que un mesero venda "productos fantasma".
 */
export const DEMO_DATA = {
    platos: [],
    meseros: []
};