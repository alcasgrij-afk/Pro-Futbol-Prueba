'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { TipoCancha, type CanchaDTO } from '@profutbol/shared-types';
import SiteHeader from '../components/public/SiteHeader';
import SiteFooter from '../components/public/SiteFooter';

// Precios de respaldo si /api/canchas no responde: deben coincidir con el
// seed real (ver apps/api/prisma/seed.ts) para no repetir el bug de mostrar
// un precio fijo que no es el real.
const PRECIOS_RESPALDO: Record<TipoCancha, { precioAnticipadoQ: number; precioSedeQ: number }> = {
  [TipoCancha.FUTBOL_5]: { precioAnticipadoQ: 250, precioSedeQ: 300 },
  [TipoCancha.FUTBOL_7]: { precioAnticipadoQ: 350, precioSedeQ: 420 },
};

export default function LandingPage() {
  // Precios reales de /api/canchas: el precio mostrado aqui venia hardcodeado
  // ("Q350" para ambas canchas) y no coincidia con el precio real de reserva.
  const [canchas, setCanchas] = useState<CanchaDTO[] | null>(null);

  useEffect(() => {
    fetch('/api/canchas', { cache: 'no-store' })
      .then((r) => r.json())
      .then(setCanchas)
      .catch(() => setCanchas([]));
  }, []);

  function precioDe(tipo: TipoCancha) {
    return canchas?.find((c) => c.tipo === tipo) ?? PRECIOS_RESPALDO[tipo];
  }

  return (
    <div className="min-h-screen bg-white text-[#122447]">
      <SiteHeader />

      <main>
        {/* Hero */}
        <section id="inicio" className="relative min-h-[560px] flex items-center overflow-hidden">
          <Image
            src="/hero.jpg"
            alt="Jugador de fútbol con balón"
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#092a5c]/95 via-[#0d3a78]/90 to-[#0f468c]/20"></div>
          {/* hero.jpg es un flyer de redes con texto/logo propios pegados en la
              franja inferior; en movil (donde no queda recortada por object-cover)
              esa franja compite con el h1/CTA reales de encima. Se oscurece aparte. */}
          <div className="absolute inset-x-0 bottom-0 h-[55%] bg-gradient-to-t from-[#06213f] from-10% via-[#06213f]/85 via-45% to-transparent"></div>

          <div className="relative z-10 max-w-[1180px] mx-auto px-6 py-20 w-full">
            <div className="max-w-[560px]">
              <p className="text-[13px] font-semibold tracking-wider text-[#d8b32d] mb-5">
                Fútbol · Amigos · Buenos momentos
              </p>
              <h1 className="text-4xl sm:text-5xl font-bold text-white mb-5 leading-tight">
                Reserva tu cancha<br/>
                <em className="not-italic text-[#d8b32d]">en segundos</em>
              </h1>
              <p className="text-lg text-[#dce8ff] leading-relaxed mb-8 max-w-[460px]">
                Disfruta del mejor fútbol en nuestras canchas sintéticas. Rápido, fácil y seguro.
              </p>
              <Link
                href="/reservar"
                className="inline-flex items-center gap-2 bg-[#d8b32d] text-[#0a3d7d] px-6 py-3 rounded-full font-semibold hover:bg-[#d0a92a] transition-all hover:-translate-y-0.5 shadow-xl"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="5" width="18" height="16" rx="2"/>
                  <path d="M16 3v4M8 3v4M3 10h18"/>
                </svg>
                Reservar Ahora
                <span aria-hidden="true">›</span>
              </Link>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="reservar" className="py-20 px-6">
          <div className="max-w-[1180px] mx-auto">
            <div className="text-center max-w-[600px] mx-auto mb-14">
              <p className="text-[13px] font-bold text-[#1668c9] mb-3 tracking-wide">¿Cómo funciona?</p>
              <h2 className="text-3xl font-bold text-[#0a3d7d] mb-4">Reservar es muy fácil</h2>
              <p className="text-[#5b6b85] leading-relaxed">En solo 3 pasos tendrás tu cancha lista.</p>
            </div>

            <div className="grid md:grid-cols-3 gap-9 items-start relative">
              {/* Linea que conecta los 3 pasos: rompe el bloque de 3 columnas
                  centradas identicas, ademas de leerse como una secuencia real. */}
              <div className="hidden md:block absolute top-10 left-[16.5%] right-[16.5%] h-0.5 bg-[#dbe9fb]" aria-hidden />
              {[
                { n: 1, icon: 'M12 2a15 15 0 0 1 0 20M2 12h20', title: 'Elige tu cancha', desc: 'Selecciona el tipo de cancha que prefieres (5 vs 5 o 7 vs 7).' },
                { n: 2, icon: 'M16 2v4M8 2v4M3 10h18', title: 'Selecciona horario', desc: 'Revisa la disponibilidad y elige el horario que más te convenga.' },
                { n: 3, icon: 'm9 12 2 2 4-4', title: 'Confirma tu reserva', desc: 'Completa tus datos y recibe la confirmación al instante.' }
              ].map((step) => (
                <div key={step.n} className="relative text-left px-3">
                  <div className="relative w-20 h-20 rounded-full bg-[#f2f8ff] flex items-center justify-center mb-5">
                    <svg className="w-8 h-8 stroke-[#0f59b3]" viewBox="0 0 24 24" fill="none" strokeWidth="2">
                      {step.n === 1 && <><circle cx="12" cy="12" r="10"/><path d={step.icon}/></>}
                      {step.n === 2 && <><rect x="3" y="4" width="18" height="18" rx="2"/><path d={step.icon}/></>}
                      {step.n === 3 && <><circle cx="12" cy="12" r="10"/><path d={step.icon}/></>}
                    </svg>
                    <div className="absolute -bottom-1.5 -right-1 w-6 h-6 rounded-full bg-[#0d4aa1] text-white text-xs font-bold flex items-center justify-center">
                      {step.n}
                    </div>
                  </div>
                  <h3 className="text-lg font-bold text-[#0a3d7d] mb-2">{step.title}</h3>
                  <p className="text-sm text-[#5b6b85] leading-relaxed max-w-[240px]">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Canchas */}
        <section id="canchas" className="py-20 px-6 bg-[#f2f8ff]">
          <div className="max-w-[1180px] mx-auto">
            <div className="text-center max-w-[600px] mx-auto mb-14">
              <p className="text-[13px] font-bold text-[#1668c9] mb-3 tracking-wide">Nuestras canchas</p>
              <h2 className="text-3xl font-bold text-[#0a3d7d] mb-4">Canchas para todos los estilos</h2>
              <p className="text-[#5b6b85] leading-relaxed">Contamos con diferentes opciones para que juegues como más te gusta.</p>
            </div>

            <div className="grid md:grid-cols-2 gap-7">
              {[
                { title: 'Cancha 5 vs 5', img: '/action.jpg', capacidad: '10 jugadores', tamano: '30x20 m' },
                { title: 'Cancha 7 vs 7', img: '/field.jpg', capacidad: '14 jugadores', tamano: '50x30 m' }
              ].map((cancha, i) => (
                <div key={i} className="bg-white rounded-[22px] overflow-hidden shadow-[0_10px_30px_rgba(15,60,130,.08)]">
                  <div className="relative h-48">
                    <Image src={cancha.img} alt={cancha.title} fill className="object-cover" />
                    <span className="absolute left-4 bottom-4 bg-[#1668c9] text-white text-xs font-bold px-4 py-2 rounded-full tracking-wide">
                      Cancha sintética
                    </span>
                  </div>
                  <div className="p-6">
                    <h3 className="text-xl font-bold text-[#0a3d7d] mb-4">{cancha.title}</h3>
                    <div className="space-y-2 mb-5">
                      <div className="flex items-center gap-3 text-sm text-[#5b6b85]">
                        <svg className="w-4 h-4 stroke-[#1668c9] shrink-0" viewBox="0 0 24 24" fill="none" strokeWidth="2">
                          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                        </svg>
                        Capacidad: {cancha.capacidad}
                      </div>
                      <div className="flex items-center gap-3 text-sm text-[#5b6b85]">
                        <svg className="w-4 h-4 stroke-[#1668c9] shrink-0" viewBox="0 0 24 24" fill="none" strokeWidth="2">
                          <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
                        </svg>
                        Dimensiones: {cancha.tamano}
                      </div>
                    </div>
                    <Link
                      href="/reservar"
                      className="block w-full text-center bg-[#d8b32d] text-[#0a3d7d] px-6 py-3 rounded-full font-semibold hover:bg-[#d0a92a] transition-all hover:-translate-y-0.5"
                    >
                      Reservar <span aria-hidden="true">›</span>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Precios */}
        <section id="precios" className="py-20 px-6 bg-gradient-to-br from-[#0a3d7d] to-[#0f59b3]">
          <div className="max-w-[1180px] mx-auto">
            <div className="text-center max-w-[600px] mx-auto mb-14">
              <p className="text-[13px] font-bold text-[#d8b32d] mb-3 tracking-wide">Precios</p>
              <h2 className="text-3xl font-bold text-white mb-4">Planes y tarifas</h2>
              <p className="text-[#cde8ff] leading-relaxed">Elige la opción que mejor se adapte a ti.</p>
            </div>

            <div className="grid md:grid-cols-2 gap-7 max-w-[820px] mx-auto">
              {[
                { tipo: TipoCancha.FUTBOL_5, title: 'Cancha 5 vs 5', jugadores: '10', nota: 'Ideal para grupos chicos y partidos rápidos.' },
                { tipo: TipoCancha.FUTBOL_7, title: 'Cancha 7 vs 7', jugadores: '14', nota: 'Ideal para torneos y grupos grandes.' },
              ].map((plan) => {
                const precio = precioDe(plan.tipo);
                return (
                  <div key={plan.tipo} className="bg-white rounded-[22px] p-8 shadow-[0_18px_40px_rgba(6,32,70,.35)] border-t-4 border-[#d8b32d]">
                    <h3 className="text-lg font-bold text-[#0a3d7d] mb-1">{plan.title}</h3>
                    <p className="text-xs text-[#5b6b85] mb-3">{plan.nota}</p>
                    <div className="text-[34px] font-bold text-[#0f59b3] leading-none">
                      Q{precio.precioAnticipadoQ} <span className="text-base font-medium text-[#5b6b85]">/hora en línea</span>
                    </div>
                    <div className="text-sm text-[#5b6b85] mb-5">Q{precio.precioSedeQ}/hora pagando en sede</div>
                    <div className="space-y-3 mb-6">
                      {[plan.title, `Hasta ${plan.jugadores} jugadores`, 'Uso exclusivo'].map((item, j) => (
                        <div key={j} className="flex items-center gap-3 text-sm text-[#33475f]">
                          <svg className="w-4 h-4 stroke-[#1668c9] shrink-0" viewBox="0 0 24 24" fill="none" strokeWidth="2">
                            <circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>
                          </svg>
                          {item}
                        </div>
                      ))}
                    </div>
                    <Link
                      href="/reservar"
                      className="block w-full text-center bg-[#d8b32d] text-[#0a3d7d] px-6 py-3 rounded-full font-semibold hover:bg-[#d0a92a] transition-all hover:-translate-y-0.5"
                    >
                      Reservar
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section className="py-20 px-6 bg-[#f2f8ff]">
          <div className="max-w-[1180px] mx-auto">
            <div className="text-center max-w-[600px] mx-auto mb-14">
              <p className="text-[13px] font-bold text-[#1668c9] mb-3 tracking-wide">Lo que dicen nuestros clientes</p>
              <h2 className="text-3xl font-bold text-[#0a3d7d] mb-4">La mejor experiencia, siempre</h2>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {[
                { stars: 5, quote: 'Las canchas están en excelente estado y el proceso de reserva es súper fácil. Recomendado.', name: 'Diego Ramírez', role: 'Jugador amateur', initials: 'DR' },
                { stars: 5, quote: 'Excelente atención y muy buena ubicación. Ideal para partidos con amigos o torneos.', name: 'Carlos Méndez', role: 'Capitán de equipo', initials: 'CM' },
                { stars: 5, quote: 'Siempre limpio, seguro y con buen ambiente. Nuestras tardes de fútbol son aquí.', name: 'María López', role: 'Jugadora', initials: 'ML' }
              ].map((test, i) => (
                // Offset vertical alterno: rompe la fila de 3 tarjetas identicas.
                <div key={i} className={`bg-white rounded-[14px] p-6 shadow-[0_10px_30px_rgba(15,60,130,.08)] ${i === 1 ? 'md:mt-8' : ''}`}>
                  <div className="text-[#f5b942] text-sm mb-3.5 tracking-wider">★★★★★</div>
                  <p className="text-sm text-[#122447] leading-relaxed mb-5">{test.quote}</p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#eaf2ff] text-[#0d4aa1] flex items-center justify-center font-bold text-sm shrink-0">
                      {test.initials}
                    </div>
                    <div>
                      <div className="font-semibold text-sm text-[#0a3d7d]">{test.name}</div>
                      <div className="text-xs text-[#5b6b85]">{test.role}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Info */}
        <section id="informacion" className="py-20 px-6">
          <div className="max-w-[1180px] mx-auto">
            <div className="text-center max-w-[600px] mx-auto mb-12">
              <p className="text-[13px] font-bold text-[#1668c9] mb-3 tracking-wide">Información</p>
              <h2 className="text-3xl font-bold text-[#0a3d7d] mb-4">Todo lo que necesitas saber</h2>
            </div>

            <div className="grid lg:grid-cols-2 gap-14 items-center">
              <div className="space-y-6">
                {[
                  { icon: 'M12 6v6l4 2', title: 'Horario de atención', desc: 'Lunes a sábado\n2:00 p.m. – 10:00 p.m.' },
                  { icon: 'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0ZM12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z', title: 'Nuestra ubicación', desc: 'C. de Chajón 4, Antigua Guatemala' },
                  { icon: 'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 11.2 11.2 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0 1 22 16.92Z', title: 'Teléfono', desc: '3706 3030' }
                ].map((info, i) => (
                  <div key={i} className="flex gap-4">
                    <div className="w-11 h-11 rounded-full bg-[#f2f8ff] flex items-center justify-center shrink-0">
                      <svg className="w-5 h-5 stroke-[#0f59b3]" viewBox="0 0 24 24" fill="none" strokeWidth="2">
                        {i === 0 && <><circle cx="12" cy="12" r="10"/><path d={info.icon}/></>}
                        {i === 1 && <path d={info.icon}/>}
                        {i === 2 && <path d={info.icon}/>}
                      </svg>
                    </div>
                    <div>
                      <h4 className="font-semibold text-[15px] text-[#0a3d7d] mb-1">{info.title}</h4>
                      <p className="text-sm text-[#5b6b85] leading-relaxed whitespace-pre-line">{info.desc}</p>
                    </div>
                  </div>
                ))}
                <a
                  href="https://www.google.com/maps/search/?api=1&query=C.+de+Chaj%C3%B3n+4,+Antigua+Guatemala"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block text-[#1668c9] font-semibold text-sm hover:underline"
                >
                  Ver en Google Maps →
                </a>
              </div>

              <div className="relative h-80 rounded-[22px] border border-[#dce6f5] overflow-hidden">
                <iframe
                  title="Ubicacion de Pro Futbol Antigua"
                  src="https://maps.google.com/maps?q=C.+de+Chaj%C3%B3n+4%2C+Antigua+Guatemala&z=16&output=embed"
                  className="absolute inset-0 h-full w-full border-0"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
                <span className="absolute top-4 left-4 bg-white px-4 py-2 rounded-full text-xs font-semibold text-[#0a3d7d] shadow-lg pointer-events-none">
                  📍 Antigua Guatemala
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section id="contacto" className="py-20 px-6">
          <div className="max-w-[1180px] mx-auto">
            <div className="bg-gradient-to-r from-[#0a3d7d] to-[#0f59b3] rounded-[22px] px-12 py-14 flex flex-col lg:flex-row items-center justify-between gap-8">
              <div>
                <h2 className="text-white text-3xl font-bold mb-2">¿Listo para tu próximo partido?</h2>
                <p className="text-[#cfe0fb] text-[15px]">Reserva ahora y asegura tu horario favorito.</p>
              </div>
              <Link
                href="/reservar"
                className="inline-flex items-center gap-2 bg-[#d8b32d] text-[#0a3d7d] px-6 py-3 rounded-full font-semibold hover:bg-[#d0a92a] transition-all hover:-translate-y-0.5 shadow-xl shrink-0"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="5" width="18" height="16" rx="2"/>
                  <path d="M16 3v4M8 3v4M3 10h18"/>
                </svg>
                Reservar Ahora
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}


