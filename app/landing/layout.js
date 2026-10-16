export const metadata = {
  title: 'AMPLINUBE | Sistema POS + Equipos Instalados en tu Local por $770.000 COP',
  description: 'Cambia el cuaderno por control total. Equipos POS + Sistema en la nube por $770.000 COP y mensualidad de $70.000.',
};

export default function LandingLayout({ children }) {
  return (
    <html lang="es" className="scroll-smooth">
      <head>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
      </head>
      <body className="bg-[#060D1A] text-slate-100 font-sans antialiased m-0 p-0 selection:bg-[#0095FF] selection:text-white">
        {children}
      </body>
    </html>
  );
}