import "./globals.css";
import { CartProvider } from './context/CartContext'; 
import { SITE_CONFIG } from '@/lib/config'; 

const getTenantKey = () => {
  if (typeof window === 'undefined') return (process.env.NEXT_PUBLIC_TENANT_ID || 'demo').toLowerCase().trim();
  
  // Separamos el host del puerto por si estamos en desarrollo local (ej: localhost:3000 -> localhost)
  const hostname = window.location.hostname.split(':')[0].toLowerCase().trim();

  // 1. Aislamiento para entorno de desarrollo local o pruebas fijas
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === 'sociopos' || hostname === 'talanquera-frontend') {
    return (process.env.NEXT_PUBLIC_TENANT_ID || 'demo').toLowerCase().trim();
  }

  // 2. Blindaje para URLs técnicas de Netlify (ej: rama--proyecto.netlify.app)
  if (hostname.includes('--')) {
    const parts = hostname.split('--');
    return parts[0].toLowerCase().trim();
  }

  // 3. Extracción estricta del subdominio en producción (ej: talanquera.sociopos.com)
  const parts = hostname.split('.');
  if (parts.length >= 3) {
    const subdomain = parts[0];
    // Evitamos falsos positivos con subdominios técnicos globales
    if (subdomain !== 'www' && subdomain !== 'app' && subdomain !== 'api') {
      return subdomain.toLowerCase().trim();
    }
  }

  return (process.env.NEXT_PUBLIC_TENANT_ID || 'demo').toLowerCase().trim();
};

export const metadata = {
  title: `${SITE_CONFIG.brand.name} - POS`,
  description: `Sistema de ventas para ${SITE_CONFIG.brand.name}`,
};

export default function RootLayout({ children }) {
  const tenantId = getTenantKey(); 

  return (
    <html lang="es">
      <body className="antialiased">
        <CartProvider tenantId={tenantId}>
          {children}
        </CartProvider>
      </body>
    </html>
  );
}