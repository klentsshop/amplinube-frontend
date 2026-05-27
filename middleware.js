import { NextResponse } from 'next/server';

export function middleware(request) {
  const url = request.nextUrl;
  const hostname = request.headers.get('host');

  // 1. Definimos los dominios que NO son clientes (tu web principal)
  const rootDomains = ['localhost:3000', 'sociopos.com', 'tu-dominio-netlify.netlify.app'];

  // 2. Extraemos el subdominio
  // Si el host es "talanquera.localhost:3000", el subdomain será "talanquera"
  const subdomain = hostname.split('.')[0];

  // 3. Si es un dominio raíz, no hacemos nada especial
  if (rootDomains.includes(hostname)) {
    return NextResponse.next();
  }

  // 4. BISTURÍ: Inyectamos el 'tenant' en los headers para que Next.js lo lea fácil
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-tenant-id', subdomain);

  // 5. Reescribimos la ruta internamente (esto es invisible para el usuario)
  // Esto permite que el sistema crea que está en la ruta del cliente
  return NextResponse.next({
    request: {
      headers: requestHeaders,
    }
  });
}

// Configuramos en qué rutas corre el middleware (evitamos archivos estáticos)
export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};