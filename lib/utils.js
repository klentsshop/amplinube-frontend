import { SITE_CONFIG } from './config';

/**
 * 🛠️ UTILS - SOCIO POS 
 * Versión: Multitenant Blindada 1.2.5
 */

// 1. 🏗️ DETECTOR DE IDENTIDAD (TENANT) - REFORZADO
export const getTenantKey = () => {
    if (typeof window === 'undefined') return 'demo';
    const host = window.location.hostname; // ej: talanquera.sociopos.com
    
    // 🛡️ BISTURÍ: Manejo de Localhost y Dominios Principales
    if (host.includes('localhost') || host === 'sociopos.com' || host === 'www.sociopos.com') {
        return 'demo';
    }

    // Extraemos la primera parte (el subdominio)
    const parts = host.split('.');
    if (parts.length > 1) {
        return parts[0]; // Retorna 'talanquera'
    }
    
    return 'demo';
};

// 2. 💰 LIMPIEZA DE PRECIOS (INTACTO - EXCELENTE)
export const cleanPrice = (valor) => {
    if (typeof valor === 'number') return valor;
    if (!valor && valor !== 0) return 0;
    const cleaned = String(valor).replace(/[^0-9]/g, '');
    const n = parseInt(cleaned, 10);
    return isNaN(n) ? 0 : n;
};

export const formatPrecioDisplay = cleanPrice;

// 3. 🏷️ MAPEOS DE CONFIGURACIÓN
export const categoriasMap = SITE_CONFIG.categorias;
export const METODOS_PAGO = SITE_CONFIG.metodosPago;

// 4. 📅 TIEMPO REAL (BOGOTÁ)
export const getFechaBogota = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: SITE_CONFIG.logic.timezone || 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());

// 5. 🖨️ HUELLA DIGITAL DE LA ESTACIÓN (PRINTING ID)
export const getStationFingerprint = () => {
    if (typeof window === 'undefined') return null;
    let id = localStorage.getItem('socio_pos_pc_id');
    if (!id) {
        const screenData = `${window.screen.width}x${window.screen.height}`;
        const browserData = navigator.userAgent.replace(/\D/g, '').substring(0, 10);
        id = `PC-${screenData}-${browserData}`;
        localStorage.setItem('socio_pos_pc_id', id);
    }
    return id;
};