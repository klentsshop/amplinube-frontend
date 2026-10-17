export const metadata = {
  title: 'AMPLINUBE | Sistema POS + Equipos Instalados en tu Local por $770.000 COP',
  description: 'Cambia el cuaderno por control total. Equipos POS + Sistema en la nube por $770.000 COP y mensualidad de $70.000.',
};

export default function LandingLayout({ children }) {
  return (
    <>
      {/* Fondo oscuro inmediato desde el milisegundo cero */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            html, body {
              background-color: #060D1A !important;
              color: #f8fafc !important;
            }
          `,
        }}
      />
      <script src="https://cdn.tailwindcss.com"></script>
      <script
        dangerouslySetInnerHTML={{
          __html: `
            window.tailwind = window.tailwind || {};
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
            };
          `,
        }}
      />
      {children}
    </>
  );
}