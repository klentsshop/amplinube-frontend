import "./globals.css";
import { CartProvider } from './context/CartContext'; 
import { SITE_CONFIG } from '@/lib/config'; 

// 🛡️ BISTURÍ: Esta es la función que detecta quién está operando el POS
const getTenantKey = () => {
  // Si estamos en el servidor, devolvemos un valor por defecto seguro
  if (typeof window === 'undefined') return 'demo';
  
  const host = window.location.hostname; // Ej: ikebana.sociopos.com
  const firstPart = host.split('.')[0];
  
  // Si es localhost o el dominio principal, usamos 'demo'
  if (firstPart === 'localhost' || firstPart === 'sociopos' || firstPart === 'talanquera-frontend') {
    return 'demo';
  }
  
  return firstPart;
};

export const metadata = {
  title: `${SITE_CONFIG.brand.name} - POS`,
  description: `Sistema de ventas para ${SITE_CONFIG.brand.name}`,
};

export default function RootLayout({ children }) {
  // 🚀 AHORA SÍ: El nombre coincide con la función de arriba
  const tenantId = getTenantKey(); 

  return (
    <html lang="es">
      <body className="antialiased">
        {/* 🔗 Inyectamos la identidad al carrito para que no salga el error de la imagen 1 */}
        <CartProvider tenantId={tenantId}>
          {children}
        </CartProvider>
      </body>
    </html>
  );
}