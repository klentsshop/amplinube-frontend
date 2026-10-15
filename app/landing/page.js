'use client';

import React, { useState, useEffect } from 'react';

export default function LandingPage() {
  // Estado para el modal de filtrado
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Estado para la calculadora de fugas
  const [dailyLoss, setDailyLoss] = useState(15000);

  // Número de WhatsApp personal
  const PERSONAL_WA_NUMBER = "573102501107";

  useEffect(() => {
    // Inicializar iconos de Lucide si están disponibles globalmente
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }, []);

  const formatCOP = (num) => {
    return '$' + num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".") + ' COP';
  };

  const monthlyLoss = dailyLoss * 30;
  const saved = monthlyLoss - 70000;

  const openFilterModal = (source) => {
    setIsModalOpen(true);
  };

  const closeFilterModal = () => {
    setIsModalOpen(false);
  };

  const sendToPersonalWhatsApp = () => {
    const bizType = document.getElementById('bizType').value;
    const bizCity = document.getElementById('bizCity').value;
    const priceOk = document.getElementById('priceCheck').checked;

    if (!priceOk) {
      alert("Por favor confirma que conoces el valor del Kit ($770.000 COP + $70.000/mes) para continuar.");
      return;
    }

    const text = `Hola Ingeniera, vi la página de Amplinube y quiero agendar mi demostración/instalación.\n\n` +
                 `• *Mi negocio:* ${bizType}\n` +
                 `• *Ubicación:* ${bizCity}\n` +
                 `• *Presupuesto confirmado:* Kit $770.000 COP con equipos + $70.000/mes.\n\n` +
                 `¿Qué disponibilidad tienes para visitarme o mostrarme el sistema?`;

    const url = `https://wa.me/${PERSONAL_WA_NUMBER}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
    closeFilterModal();
  };

  return (
    <div className="bg-ampli-dark text-slate-100 font-sans antialiased selection:bg-ampli-blue selection:text-white min-h-screen">
      
      {/* BARRA SUPERIOR DE CONFIANZA Y PAGO CONTRA ENTREGA */}
      <div className="bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 text-slate-950 text-xs sm:text-sm font-extrabold py-2.5 px-4 text-center">
        🤝 BOGOTÁ Y SABANA: Llevamos los equipos a tu local, instalamos y te capacitamos paso a paso. ¡Pagas los $770.000 al recibir!
      </div>

      {/* NAVBAR */}
      <header className="sticky top-0 z-40 bg-ampli-dark/95 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-6xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <a href="#" className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-ampli-cyan to-ampli-blue flex items-center justify-center shadow-lg shadow-ampli-blue/30 overflow-hidden p-1">
              <img src="https://res.cloudinary.com/dqod8tmkq/image/upload/v1792028701/logo_hh5oz7.jpg" alt="Logo Amplinube" className="w-full h-full object-contain" />
            </div>
            <div>
              <span className="font-extrabold text-xl tracking-tight text-white block leading-none">AMPLI<span className="text-ampli-cyan">NUBE</span></span>
              <span className="text-[11px] text-slate-400">De dueño de negocio a dueño de negocio</span>
            </div>
          </a>

          <div className="hidden md:flex items-center gap-2.5 text-sm font-medium">
            <a href="#clientes" className="px-4 py-2 rounded-xl bg-slate-900/90 border border-ampli-cyan text-ampli-cyan shadow-lg shadow-ampli-cyan/10 hover:text-white hover:border-white hover:bg-slate-800/90 transition-all duration-200">Clientes Reales</a>
            <a href="#instalacion" className="px-4 py-2 rounded-xl bg-slate-900/90 border border-ampli-cyan text-ampli-cyan shadow-lg shadow-ampli-cyan/10 hover:text-white hover:border-white hover:bg-slate-800/90 transition-all duration-200">Instalación en tu Local</a>
            <a href="#calculadora" className="px-4 py-2 rounded-xl bg-slate-900/90 border border-ampli-cyan text-ampli-cyan shadow-lg shadow-ampli-cyan/10 hover:text-white hover:border-white hover:bg-slate-800/90 transition-all duration-200">Calculadora</a>
            <a href="#precio" className="px-4 py-2 rounded-xl bg-slate-900/90 border border-ampli-cyan text-ampli-cyan shadow-lg shadow-ampli-cyan/10 hover:text-white hover:border-white hover:bg-slate-800/90 transition-all duration-200">Qué Incluye</a>
          </div>

          <button onClick={() => openFilterModal('Navbar')}
             className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs sm:text-sm px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-lg shadow-emerald-500/25 transition">
            <i data-lucide="calendar-check" className="w-4 h-4"></i>
            <span>Agendar Instalación</span>
          </button>
        </div>
      </header>

      {/* 1. HERO SECTION (EMBUDO DE FILTRADO DIRECTO) */}
      <section className="relative pt-10 pb-16 sm:py-20 px-4" style={{ background: 'radial-gradient(circle at 50% 15%, rgba(0, 149, 255, 0.22) 0%, rgba(6, 13, 26, 0) 70%)' }}>
        <div className="max-w-6xl mx-auto grid lg:grid-cols-12 gap-10 items-center">
          
          <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-800/90 border border-slate-700 text-ampli-cyan text-xs sm:text-sm font-semibold">
              <span>✋ Sin licencias por correo donde nadie te ayuda</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight text-white">
              Cambia el cuaderno y el desorden en caja por <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00E0FF] to-[#0095FF]">Control Total con Equipos Incluidos</span>
            </h1>

            <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto lg:mx-0 leading-relaxed">
              No te enviamos una caja para que te defiendas como puedas. <strong>Soy ingeniera de software y creadora de Amplinube:</strong> voy a tu negocio en Bogotá y alrededores, armo tus equipos, conecto tu inventario y no me voy hasta que tú y tu cajero cobren en segundos.
            </p>

            {/* Oferta Transparente */}
            <div className="bg-ampli-navy/95 border-2 border-ampli-blue/50 rounded-2xl p-5 sm:p-6 shadow-2xl max-w-xl mx-auto lg:mx-0">
              <div className="grid grid-cols-2 gap-4 items-center border-b border-slate-800 pb-4">
                <div>
                  <span className="text-xs uppercase tracking-wider text-slate-400 block">Kit Equipos + Sistema</span>
                  <span className="text-2xl sm:text-3xl font-black text-white">$770.000 <small className="text-xs font-normal text-slate-400">COP</small></span>
                  <span className="text-xs text-emerald-400 font-bold block mt-0.5">✓ Pagas al instalar en Bogotá</span>
                </div>
                <div className="border-l border-slate-800 pl-4">
                  <span className="text-xs uppercase tracking-wider text-slate-400 block">Mensualidad en la nube</span>
                  <span className="text-2xl sm:text-3xl font-black text-ampli-cyan">$70.000 <small className="text-xs font-normal text-slate-400">/mes</small></span>
                  <span className="text-xs text-slate-300 font-medium block mt-0.5">Solo $2.333 pesos al día</span>
                </div>
              </div>

              <div className="pt-4">
                <button onClick={() => openFilterModal('Hero Principal')}
                   className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black py-4 px-6 rounded-xl text-center flex items-center justify-center gap-2 text-base shadow-lg shadow-emerald-500/30 transition transform hover:-translate-y-0.5">
                  <i data-lucide="check-square" className="w-5 h-5"></i>
                  <span>Verificar Disponibilidad y Agendar Cita</span>
                </button>
              </div>
              <p className="text-[12px] text-slate-400 text-center mt-3">
                Ideal para control interno, comandas e inventario sin obligarte a facturación electrónica.
              </p>
            </div>
          </div>

          {/* Tarjeta Visual: Promesa Presencial */}
          <div className="lg:col-span-5">
            <div className="bg-slate-900 border-2 border-slate-700 rounded-3xl p-6 shadow-2xl space-y-5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <span className="text-xs font-bold uppercase text-emerald-400 block">Acompañamiento 1 a 1</span>
                  <h3 className="text-lg font-black text-white">¿Por qué los negocios eligen Amplinube?</h3>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                  <i data-lucide="shield-check" className="w-6 h-6"></i>
                </div>
              </div>

              <div className="space-y-3.5 text-sm">
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 flex gap-3 items-start">
                  <span className="bg-ampli-blue/20 text-ampli-cyan font-black px-2.5 py-1 rounded-lg text-xs">1</span>
                  <div>
                    <strong className="text-white block">Meseros toman pedidos desde su celular</strong>
                    <span className="text-xs text-slate-400">Sin comprarle tablets a cada mesero. La comanda sale impresa en la cocina en 1 segundo con notas claras (&quot;Sin azúcar&quot;, &quot;Mesa 3&quot;).</span>
                  </div>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 flex gap-3 items-start">
                  <span className="bg-ampli-blue/20 text-ampli-cyan font-black px-2.5 py-1 rounded-lg text-xs">2</span>
                  <div>
                    <strong className="text-white block">Táblet, Impresora, Lector y Cajón Automático</strong>
                    <span className="text-xs text-slate-400">Registra o pistolea en 1 segundo, abre el cajón monedero sin errores de vueltas e imprime tu recibo de control interno en 58mm.</span>
                  </div>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 flex gap-3 items-start">
                  <span className="bg-ampli-blue/20 text-ampli-cyan font-black px-2.5 py-1 rounded-lg text-xs">3</span>
                  <div>
                    <strong className="text-white block">Mira tus ventas y stock desde donde estés</strong>
                    <span className="text-xs text-slate-400">Revisa en tu celular cuántas unidades quedan en las neveras cuando llega Coca-Cola o Postobón y deja tu negocio a cargo con paz mental.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* 2. PRUEBA SOCIAL REAL (TUS CLIENTES REALES EN VIDEO) */}
      <section id="clientes" className="py-16 px-4 bg-slate-900/70 border-y border-slate-800">
        <div className="max-w-6xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <span className="text-emerald-400 font-bold text-xs uppercase tracking-widest">Casos Reales en Colombia</span>
            <h2 className="text-2xl sm:text-4xl font-black text-white mt-2">
              Comerciantes como tú que ya jubilaron el cuaderno
            </h2>
            <p className="text-slate-300 mt-2 text-sm sm:text-base">
              No importa si nunca has tocado un sistema o si tienes alto flujo en hora pico: así funciona Amplinube en la vida real.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            
            {/* Caso 1: Cafetería / Repostería */}
            <div className="bg-ampli-dark border border-slate-800 rounded-2xl p-5 flex flex-col justify-between overflow-hidden">
              <div>
                <div className="relative w-full aspect-[9/16] rounded-xl overflow-hidden bg-slate-950 mb-4 border border-slate-800/60 shadow-md">
                  <video 
                    src="https://res.cloudinary.com/dqod8tmkq/video/upload/v1792030122/latelier_dtkkun.mp4" 
                    className="w-full h-full object-cover" 
                    controls 
                    playsinline>
                    Tu navegador no soporta la reproducción de videos.
                  </video>
                </div>
                <div className="text-xs font-bold text-amber-400 mb-2">☕ Cafetería y Repostería</div>
                <p className="text-sm text-slate-200 italic mb-4">
                  &quot;A mí que no me gusta nada esto de sistemas, me pareció muy práctico. Pongo un capuchino, un merengón, un brownie con helado y ya me da cobrar sin estar apuntando.&quot;
                </p>
              </div>
              <div className="border-t border-slate-800 pt-3 text-xs text-slate-400 font-semibold">
                ✓ Cero miedo a la tecnología
              </div>
            </div>

            {/* Caso 2: Restaurante La Avenida */}
            <div className="bg-ampli-dark border border-slate-800 rounded-2xl p-5 flex flex-col justify-between overflow-hidden">
              <div>
                <div className="relative w-full aspect-[9/16] rounded-xl overflow-hidden bg-slate-950 mb-4 border border-slate-800/60 shadow-md">
                  <video 
                    src="https://res.cloudinary.com/dqod8tmkq/video/upload/v1792030635/andrey_jsqzrm.mp4" 
                    className="w-full h-full object-cover" 
                    controls 
                    playsinline>
                    Tu navegador no soporta la reproducción de videos.
                  </video>
                </div>
                <div className="text-xs font-bold text-ampli-cyan mb-2">🍖 Andrey Parra • Restaurante La Avenida</div>
                <p className="text-sm text-slate-200 italic mb-4">
                  &quot;Pensaba que tocaba comprar computador o tablets para cada mesero, pero no: cada chico desde su propio celular maneja el programa, fácil de aprender y elegante.&quot;
                </p>
              </div>
              <div className="border-t border-slate-800 pt-3 text-xs text-slate-400 font-semibold">
                ✓ Ahorro en equipos para meseros
              </div>
            </div>

            {/* Caso 3: Leo Salsamentaria */}
            <div className="bg-ampli-dark border border-slate-800 rounded-2xl p-5 flex flex-col justify-between overflow-hidden">
              <div>
                <div className="relative w-full aspect-[9/16] rounded-xl overflow-hidden bg-slate-950 mb-4 border border-slate-800/60 shadow-md">
                  <video 
                    src="https://res.cloudinary.com/dqod8tmkq/video/upload/v1792031355/adriana_yf1mcz.mp4" 
                    className="w-full h-full object-cover" 
                    controls 
                    playsinline>
                    Tu navegador no soporta la reproducción de videos.
                  </video>
                </div>
                <div className="text-xs font-bold text-emerald-400 mb-2">🧀 Leo Salsamentaria y Minimarket</div>
                <p className="text-sm text-slate-200 italic mb-4">
                  &quot;Me da tranquilidad porque veo el reporte desde mi celular donde me encuentre. Cuando queda otra persona a cargo, factura sin complicación y las cuentas salen exactas.&quot;
                </p>
              </div>
              <div className="border-t border-slate-800 pt-3 text-xs text-slate-400 font-semibold">
                ✓ Control total a distancia
              </div>
            </div>

            {/* Caso 4: Asadero y Fruver */}
            <div className="bg-ampli-dark border border-slate-800 rounded-2xl p-5 flex flex-col justify-between overflow-hidden">
              <div>
                <div className="relative w-full aspect-[9/16] rounded-xl overflow-hidden bg-slate-950 mb-4 border border-slate-800/60 shadow-md">
                  <video 
                    src="https://res.cloudinary.com/dqod8tmkq/video/upload/v1792030955/talanquera_vqa7yj.mp4" 
                    className="w-full h-full object-cover" 
                    controls 
                    playsinline>
                    Tu navegador no soporta la reproducción de videos.
                  </video>
                </div>
                <div className="text-xs font-bold text-rose-400 mb-2">🥬 Fruvers y Asaderos</div>
                <p className="text-sm text-slate-200 italic mb-4">
                  &quot;Pasamos de la lentitud pesando a mano y gritando pedidos a la cocina, a tener la báscula calculando sola, el cajón abriendo automático y comandas impresas en 1 segundo.&quot;
                </p>
              </div>
              <div className="border-t border-slate-800 pt-3 text-xs text-slate-400 font-semibold">
                ✓ Cero filas en hora pico
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 3. CÓMO FUNCIONA LA INSTALACIÓN PRESENCIAL EN BOGOTÁ */}
      <section id="instalacion" className="py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <span className="text-ampli-cyan font-bold text-xs uppercase tracking-widest">Cero Riesgo Para Ti</span>
            <h2 className="text-2xl sm:text-4xl font-black text-white mt-2">
              ¿Cómo entregamos e instalamos en tu negocio?
            </h2>
            <p className="text-slate-300 mt-2 text-sm sm:text-base">
              Mientras otros te mandan un enlace por correo y no vuelven a contestar, nosotros vamos personalmente a tu local en Bogotá y Sabana.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-ampli-navy border border-slate-700 rounded-2xl p-6">
              <div className="w-10 h-10 rounded-xl bg-ampli-blue text-slate-950 font-black flex items-center justify-center mb-4">1</div>
              <h3 className="text-lg font-extrabold text-white mb-2">Agendamos tu cita por WhatsApp</h3>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Nos cuentas qué tipo de negocio tienes (restaurante, fruver, minimarket, cafetería o salón) y acordamos el día y hora para visitarte en tu local.
              </p>
            </div>

            <div className="bg-ampli-navy border border-slate-700 rounded-2xl p-6">
              <div className="w-10 h-10 rounded-xl bg-ampli-cyan text-slate-950 font-black flex items-center justify-center mb-4">2</div>
              <h3 className="text-lg font-extrabold text-white mb-2">Llevamos, armamos los equipos o te los ahorras si ya cuentas con ellos</h3>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Yo misma, como creadora del sistema, instalo los equipos en tu mostrador, dejo configurados tus productos y verifico que todo imprima perfecto.
              </p>
            </div>

            <div className="bg-ampli-navy border border-slate-700 rounded-2xl p-6">
              <div className="w-10 h-10 rounded-xl bg-emerald-400 text-slate-950 font-black flex items-center justify-center mb-4">3</div>
              <h3 className="text-lg font-extrabold text-white mb-2">Aprendes en 10 min y pagas al recibir</h3>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                No me voy del local hasta que tú y tu cajero digan: <em>&quot;¡Ahhh, esto era así de fácil!&quot;</em>. Ahí mismo realizas el pago de tus $770.000 o el pago de acuerdo a los equipos que necesites.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. CALCULADORA DE FUGA DE DINERO */}
      <section id="calculadora" className="py-16 px-4 bg-slate-900/60 border-y border-slate-800">
        <div className="max-w-5xl mx-auto">
          <div className="bg-ampli-navy border border-slate-700 rounded-2xl p-6 sm:p-8 shadow-xl grid md:grid-cols-2 gap-8 items-center">
            <div className="space-y-4">
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">Haz la cuenta antes de decidir</span>
              <h3 className="text-xl sm:text-2xl font-black text-white">
                ¿Cuánto te cuesta seguir con papel y calculadora?
              </h3>
              <p className="text-sm text-slate-300">
                Mueve la barra según lo que crees que se pierde al día en tu negocio por productos no anotados, errores dando vueltas o descuadres de Nequi:
              </p>
              <input 
                id="lossSlider" 
                type="range" 
                min="5000" 
                max="50000" 
                step="5000" 
                value={dailyLoss} 
                className="w-full accent-ampli-cyan cursor-pointer h-2 bg-slate-700 rounded-lg"
                onChange={(e) => setDailyLoss(e.target.value)} 
              />
              <div className="flex justify-between text-xs text-slate-400 font-semibold">
                <span>$5.000/día</span>
                <span id="dailyLossLabel" className="text-amber-400 font-bold text-sm">{formatCOP(dailyLoss)} perdidos al día</span>
                <span>$50.000/día</span>
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <span className="text-xs sm:text-sm text-slate-400">Pérdida mensual con el cuaderno:</span>
                <span id="monthlyLossValue" className="text-xl sm:text-2xl font-black text-rose-400">{formatCOP(monthlyLoss)}</span>
              </div>
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <span className="text-xs sm:text-sm text-slate-400">Mensualidad fija de Amplinube:</span>
                <span className="text-xl sm:text-2xl font-black text-emerald-400">$70.000 COP</span>
              </div>
              <div className="flex justify-between items-center pt-1">
                <span className="text-xs sm:text-sm font-bold text-white">Dinero que salvas cada mes:</span>
                <span id="monthlySavedValue" className="text-xl sm:text-2xl font-black text-ampli-cyan">{formatCOP(saved)}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. CIERRE DE EMBUDO */}
      <section id="precio" className="py-16 px-4">
        <div className="max-w-3xl mx-auto bg-gradient-to-b from-ampli-navy to-slate-900 border-2 border-emerald-500/60 rounded-3xl p-6 sm:p-10 text-center shadow-2xl space-y-6">
          <span className="bg-emerald-500 text-slate-950 text-xs font-black px-3.5 py-1 rounded-full uppercase">
            Cupos semanales de instalación presencial
          </span>
          <h2 className="text-2xl sm:text-4xl font-black text-white">
            ¿Listo para sistematizar tu negocio sin complicarte la vida?
          </h2>
          <p className="text-sm sm:text-base text-slate-300 max-w-xl mx-auto">
            Haz clic abajo, responde 3 preguntas rápidas sobre tu negocio y pasa directo a mi WhatsApp personal para agendar tu demostración o instalación.
          </p>
          <div className="text-3xl sm:text-4xl font-black text-white">
            $700.000 COP <span className="text-base font-normal text-ampli-cyan block sm:inline">+ $70.000/mes</span>
          </div>
          <button onClick={() => openFilterModal('Cierre Final')}
             className="w-full sm:w-auto mx-auto bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black py-4 px-8 rounded-xl flex items-center justify-center gap-2 text-base shadow-lg shadow-emerald-500/30 transition">
            <i data-lucide="message-circle" className="w-5 h-5"></i>
            <span>Agendar Visita o Demo en mi WhatsApp</span>
          </button>
        </div>
      </section>

      {/* MODAL FILTRO DE VENTAS */}
      {isModalOpen && (
        <div id="filterModal" className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-ampli-navy border-2 border-ampli-blue rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 relative">
            <button onClick={closeFilterModal} className="absolute top-4 right-4 text-slate-400 hover:text-white">
              <i data-lucide="x" className="w-5 h-5"></i>
            </button>

            <div>
              <span className="text-xs font-bold uppercase text-ampli-cyan">Paso único antes de ir a WhatsApp</span>
              <h3 className="text-xl font-black text-white mt-1">Personalicemos tu atención</h3>
              <p className="text-xs text-slate-300 mt-1">
                Para atenderte personalmente y sin demoras, indícanos estos 3 datos de tu comercio:
              </p>
            </div>

            <div className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">1. ¿Qué tipo de negocio tienes?</label>
                <select id="bizType" className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white focus:border-ampli-cyan outline-none">
                  <option value="Restaurante / Asadero / Comidas Rápidas">Restaurante / Asadero / Comidas Rápidas</option>
                  <option value="Fruver / Salsamentaria / Carnicería">Fruver / Salsamentaria / Carnicería</option>
                  <option value="Minimarket / Tienda / Panadería">Minimarket / Tienda</option>
                  <option value="Cafetería / Heladería / Repostería">Cafetería / Heladería</option>
                  <option value="Salón de Belleza / Barbería / Nails">Salón de Belleza / Barbería / Nails</option>
                  <option value="Otro comercio">Otro comercio</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">2. ¿Dónde está ubicado tu local?</label>
                <select id="bizCity" className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white focus:border-ampli-cyan outline-none">
                  <option value="Bogotá (Instalación presencial)">Bogotá (Quiero instalación en mi local)</option>
                  <option value="Sabana / Cundinamarca (Soacha, Chía, Fusa, etc.)">Sabana / Cundinamarca (Soacha, Chía, Fusa, etc.)</option>
                  <option value="Otra ciudad de Colombia">Otra ciudad de Colombia (Envío configurado)</option>
                </select>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
                <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-200">
                  <input id="priceCheck" type="checkbox" defaultChecked className="mt-0.5 accent-emerald-500 w-4 h-4 rounded" />
                  <span>Tengo claro que el Kit con Equipos + Sistema tiene un valor de <strong>$770.000 COP</strong> y una mensualidad de <strong>$70.000 COP</strong> (control interno sin facturación electrónica).</span>
                </label>
              </div>
            </div>

            <button onClick={sendToPersonalWhatsApp}
               className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black py-3.5 px-5 rounded-xl flex items-center justify-center gap-2 text-sm shadow-lg shadow-emerald-500/25 transition">
              <i data-lucide="send" className="w-4 h-4"></i>
              <span>Hablar con la Ingeniera en WhatsApp</span>
            </button>
          </div>
        </div>
      )}

      {/* FOOTER */}
      <footer className="py-8 px-4 border-t border-slate-800 text-center text-xs text-slate-500">
        <p>© 2026 AMPLINUBE • Controla tu negocio, no dejes que tu negocio te controle • Bogotá, Colombia 🇨🇴</p>
      </footer>

    </div>
  );
}