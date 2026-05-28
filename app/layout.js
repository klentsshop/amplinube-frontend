import "./globals.css";
import { CartProvider } from './context/CartContext'; 
import { SITE_CONFIG } from '@/lib/config'; 

const getTenantKey = () => {
  if (typeof window === 'undefined') return 'demo';
  const host = window.location.hostname;
  const firstPart = host.split('.')[0];
  
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