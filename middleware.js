import { NextResponse } from 'next/server';

export function middleware(request) {
  const url = request.nextUrl;
  const hostname = request.headers.get('host') || '';

  // 1. Definimos los dominios raíz de tu web principal (con y sin puerto local)
  const rootDomains = ['localhost:3000', '127.0.0.1:3000', 'amplinube.com', 'www.amplinube.com', 'sociopos.com', 'www.sociopos.com', 'tu-dominio-netlify.netlify.app'];

  // 2. Si entra directamente al dominio raíz (tu landing page), lo mandamos a la carpeta /landing
  if (rootDomains.includes(hostname)) {
    if (url.pathname === '/') {
      url.pathname = '/landing';
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  }

  // 3. Extraemos el subdominio para los comercios (Ej: "talanquera" de "talanquera.amplinube.com")
  const subdomain = hostname.split('.')[0];

  // 4. BISTURÍ: Inyectamos el 'tenant' en los headers para que Next.js lo lea fácil (Intacto para tus comercios)
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-tenant-id', subdomain);

  // 5. Reescribimos la ruta internamente para los POS de los clientes
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