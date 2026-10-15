export const metadata = {
  title: 'AMPLINUBE | Sistema POS + Equipos Instalados en tu Local por $770.000 COP',
  description: 'Cambia el cuaderno por control total. Equipos POS + Sistema en la nube por $770.000 COP y mensualidad de $70.000.',
};

export default function LandingLayout({ children }) {
  return (
    <html lang="es" className="scroll-smooth">
      <head>
        <script src="https://cdn.tailwindcss.com"></script>
        <script src="https://unpkg.com/lucide@latest"></script>
        <script dangerouslySetInnerHTML={{ __html: `
          tailwind.config = {
            theme: {
              extend: {
                colors: {
                  ampli: {
                    dark: '#060D1A',
                    navy: '#0D1B35',
                    blue: '#0095FF',
                    cyan: '#00E0FF'
                  }
                }
              }
            }
          }
        `}} />
      </head>
      {/* QUITAMOS h-full o min-h-full que fuercen alturas extrañas y dejamos que el body fluya */}
      <body className="bg-[#060D1A] text-slate-100 font-sans antialiased selection:bg-[#0095FF] selection:text-white m-0 p-0">
        {children}
      </body>
    </html>
  );
}