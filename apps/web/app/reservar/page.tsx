'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { MensajeSaliente } from '@profutbol/shared-types';
import WeekDatePicker from '../../components/WeekDatePicker';

const SESSION_KEY = 'profutbol_chat_session';

// Fecha local (no UTC): toISOString() corre el "hoy" un dia hacia adelante
// cerca de medianoche GT, y el server rechazaria la fecha local del usuario.
function hoyISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

type Mensaje = {
  tipo: string;
  texto: string;
  opciones?: { id: string; titulo: string }[];
  gateway?: string;
  reservaId?: string;
  montoQ?: number;
};

function normalizar(lista: MensajeSaliente[]): Mensaje[] {
  return lista.map((m) => ({
    tipo: m.tipo,
    texto: m.texto,
    opciones: m.tipo === 'lista' || m.tipo === 'botones' ? (m as { opciones: { id: string; titulo: string }[] }).opciones : undefined,
    gateway: m.tipo === 'pago' ? (m as { gateway: string }).gateway : undefined,
    reservaId: m.tipo === 'pago' ? (m as { reservaId: string }).reservaId : undefined,
    montoQ: m.tipo === 'pago' ? (m as { montoQ: number }).montoQ : undefined,
  }));
}

/**
 * Pagina publica para reservar canchas a traves del chatbot.
 * Layout del chattemplate.html (tema claro navy/lime, hero + pasos, shell
 * chat + sidebar) pero conservando el backend real: health check, sesion por
 * localStorage, opciones dinámicas del bot, pago, y reglas de fecha
 * (min hoy, max RESERVA_MAX_DIAS).
 */
export default function ReservarPage() {
  const [conectado, setConectado] = useState<boolean | null>(null);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [cargando, setCargando] = useState(false);
  const [escribiendo, setEscribiendo] = useState('');
  // Fecha para la cual se reserva; el date picker la envia con cada mensaje.
  const [fecha, setFecha] = useState(hoyISO());
  // El chat queda deshabilitado hasta que el usuario elige explicitamente un
  // dia en el WeekDatePicker (no alcanza con el default de "hoy").
  const [fechaConfirmada, setFechaConfirmada] = useState(false);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const finRef = useRef<HTMLDivElement>(null);

  // --- Readiness check ---
  const verificar = useCallback(async () => {
    try {
      const r = await fetch('/api/health', { cache: 'no-store' });
      const data = await r.json();
      setConectado(data?.status === 'ok');
    } catch {
      setConectado(false);
    }
  }, []);

  useEffect(() => {
    verificar();
    areaRef.current?.focus();
  }, [verificar]);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }, [mensajes]);

  // --- Paso activo del stepper (derivado de la conversacion) ---
  const paso = useMemo(() => {
    if (mensajes.some((m) => m.tipo === 'pago')) return 4;
    const prompts = mensajes.filter((m) => m.tipo === 'lista' || m.tipo === 'botones').length;
    if (prompts === 0) return 1;
    if (prompts === 1) return 2;
    if (prompts === 2) return 3;
    return 4;
  }, [mensajes]);

  // --- Enviar mensaje ---
  const enviar = useCallback(async (texto: string, skipMsg = false) => {
    const t = texto.trim();
    if (!t || cargando) return;

    if (!skipMsg) setMensajes((prev) => [...prev, { tipo: 'texto', texto: t }]);
    setEscribiendo('');
    setCargando(true);

    try {
      const sessionId = localStorage.getItem(SESSION_KEY) || undefined;
      const res = await fetch('/api/chat/mensajes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, texto: t, fecha }),
      });

      if (!res.ok) throw new Error(`Error ${res.status}`);

      const data: { sessionId: string; mensajes: MensajeSaliente[] } = await res.json();
      localStorage.setItem(SESSION_KEY, data.sessionId);
      setMensajes((prev) => [...prev, ...normalizar(data.mensajes)]);
    } catch {
      setMensajes((prev) => [...prev, { tipo: 'texto', texto: 'Ocurrió un error. Intentá de nuevo.' }]);
    } finally {
      setCargando(false);
      areaRef.current?.focus();
    }
  }, [cargando, fecha]);

  const enviarOpcion = useCallback((o: { id: string; titulo: string }) => enviar(o.id), [enviar]);

  // --- Pago (mismo que ChatWidget) ---
  const pagar = useCallback(async (m: Mensaje) => {
    if (!m.gateway || !m.reservaId) return;
    try {
      const res = await fetch(`/api/payments/${m.gateway.toLowerCase()}/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referenciaTipo: 'RESERVA', referenciaId: m.reservaId, monto: m.montoQ }),
      });
      const data = await res.json();
      if (data.redirectUrl) window.location.href = data.redirectUrl;
      else setMensajes((prev) => [...prev, { tipo: 'texto', texto: 'No se pudo iniciar el pago. Intentá de nuevo.' }]);
    } catch {
      setMensajes((prev) => [...prev, { tipo: 'texto', texto: 'No se pudo iniciar el pago. Intentá de nuevo.' }]);
    }
  }, []);

  // --- Nueva reserva: limpia la conversacion local y vuelve a hoy ---
  function nuevaReserva() {
    localStorage.removeItem(SESSION_KEY);
    setMensajes([]);
    setFecha(hoyISO());
    setFechaConfirmada(false);
    setTimeout(focusChat, 100);
  }

  const elegirFecha = useCallback((f: string) => {
    setFecha(f);
    setFechaConfirmada(true);
  }, []);

  const focusChat = useCallback(() => {
    document.getElementById('chatArea')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(() => areaRef.current?.focus(), 350);
  }, []);

  function encogerTextarea(e: { currentTarget: HTMLTextAreaElement }) {
    const el = e.currentTarget;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 130) + 'px';
  }

  const renderMensaje = (m: Mensaje, i: number) => {
    const esUsuario = m.tipo === 'texto' && !m.opciones && !m.gateway;
    const tiempo = new Date().toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit', hour12: false });
    return (
      <div key={i} className={`flex items-end gap-2 max-w-[92%] ${esUsuario ? 'self-end flex-row-reverse' : ''}`}>
        <div
          className={`w-[29px] h-[29px] rounded-full border flex items-center justify-center overflow-hidden flex-none ${
            esUsuario ? 'bg-[#073b82] border-[#d4e9f8] text-white text-[9px] font-black' : 'bg-white border-[#d4e9f8]'
          }`}
        >
          {esUsuario ? 'Tú' : <Image src="/profutbollogo.png" alt="" width={26} height={26} className="w-[85%] h-[85%] object-contain" />}
        </div>
        <div
          className={`px-3.5 py-3 rounded-[17px] text-sm leading-relaxed shadow-[0_4px_14px_rgba(4,49,104,.05)] ${
            esUsuario
              ? 'rounded-br-[6px] bg-[#073b82] border border-[#073b82] text-white'
              : 'rounded-bl-[6px] bg-white border border-[#d9ebf8] text-[#173f70]'
          }`}
        >
          <div className="whitespace-pre-wrap break-words">{m.texto}</div>

          {m.opciones && (
            <div className="flex flex-wrap gap-2 pt-2">
              {m.opciones.map((o) => (
                <button
                  key={o.id}
                  disabled={cargando}
                  onClick={() => enviarOpcion(o)}
                  className="min-h-11 rounded-full border border-[#bddff7] bg-white text-[#0d76e8] px-3 py-1.5 text-xs font-black hover:bg-[#f7fcff] disabled:opacity-40 transition-colors"
                >
                  {o.titulo}
                </button>
              ))}
            </div>
          )}

          {m.gateway && m.reservaId && (
            <button
              onClick={() => pagar(m)}
              className="mt-3 w-full rounded-[12px] bg-[#0d76e8] text-white px-4 py-2.5 text-sm font-semibold hover:bg-[#0b66c4] transition-colors"
            >
              Pagar ahora — Q{m.montoQ}
            </button>
          )}

          <span className="block mt-1 text-[10px] opacity-60 text-right">{tiempo}</span>
        </div>
      </div>
    );
  };

  const pasos = [
    { n: 1, t: 'Elegí fecha' },
    { n: 2, t: 'Elegí cancha' },
    { n: 3, t: 'Elegí horario' },
    { n: 4, t: 'Pagá' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f7fbff] to-[#edf7ff] text-[#173f70] font-[Inter,system-ui,sans-serif]">
      <a href="#chatArea" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-white focus:text-[#173f70] focus:px-3 focus:py-2 rounded">
        Saltar al chat de reservas
      </a>

      {/* Top bar */}
      <header className="sticky top-0 z-50 bg-white/94 backdrop-blur-md border-b border-[rgba(10,80,145,.09)]">
        <div className="max-w-[1180px] mx-auto px-4 min-h-[68px] flex items-center justify-between gap-5">
          <Link href="/" aria-label="Pro Futbol Antigua" className="flex items-center shrink-0">
            <Image src="/profutbollogo.png" alt="Pro Futbol Antigua" width={453} height={162} className="h-[50px] w-auto max-sm:h-[44px]" />
          </Link>
          <nav className="hidden md:flex items-center gap-7" aria-label="Navegación principal">
            <Link href="/#inicio" className="text-[13px] font-extrabold text-[#173f70] hover:text-[#0d76e8] transition-colors">Inicio</Link>
            <Link href="/reservar" className="text-[13px] font-extrabold text-[#0d76e8]">Reservar</Link>
            <Link href="/#canchas" className="text-[13px] font-extrabold text-[#173f70] hover:text-[#0d76e8] transition-colors">Canchas</Link>
            <Link href="/#precios" className="text-[13px] font-extrabold text-[#173f70] hover:text-[#0d76e8] transition-colors">Precios</Link>
            <Link href="/#informacion" className="text-[13px] font-extrabold text-[#173f70] hover:text-[#0d76e8] transition-colors">Información</Link>
            <Link href="/#contacto" className="text-[13px] font-extrabold text-[#173f70] hover:text-[#0d76e8] transition-colors">Contacto</Link>
          </nav>
          <button
            onClick={focusChat}
            className="hidden sm:block bg-[#d8b32d] text-[#07345d] px-5 py-3 rounded-full font-black text-sm shadow-[0_7px_18px_rgba(165,194,0,.16)] hover:bg-[#d0a92a] transition-colors"
          >
            Reservar ahora
          </button>
        </div>
      </header>

      {/* Booking hero */}
      <section className="relative text-white px-4 py-10 border-b border-white/10 overflow-hidden">
        <Image src="/chatbannertop.png" alt="" fill className="object-cover" priority quality={75} />
        <div className="absolute inset-0 bg-[#032c65]/65" />
        <div className="relative z-10 max-w-[1000px] mx-auto text-center">
          <div className="inline-flex items-center gap-2 text-[11px] tracking-[.15em] font-black uppercase text-[#cde8ff]">
            ⚽ Pro Futbol Antigua
          </div>
          <h1 className="mt-2 mb-2.5 text-4xl sm:text-5xl leading-none tracking-tight font-bold drop-shadow-lg">Reservá tu cancha</h1>
          <p className="mx-auto max-w-[650px] text-[#d4e5f8] text-base drop-shadow-sm">Elegí tu cancha, horario y forma de pago. Es rápido y fácil.</p>

          <div className="mt-7 flex justify-start sm:justify-center items-center gap-2.5 overflow-x-auto flex-nowrap sm:flex-wrap pb-0.5">
            {pasos.map((s) => (
              <div
                key={s.n}
                className={`flex items-center gap-2 whitespace-nowrap rounded-full border px-3 py-2 text-[13px] font-extrabold ${
                  paso === s.n
                    ? 'bg-[rgba(233,250,59,.14)] border-[rgba(233,250,59,.42)] text-white'
                    : 'border-white/15 bg-white/5 text-[#d4e5f8]'
                }`}
              >
                <span
                  className={`w-6 h-6 rounded-full grid place-items-center text-xs ${
                    paso === s.n ? 'bg-[#d8b32d] text-[#07345d]' : 'bg-[#193f79] text-white'
                  }`}
                >
                  {s.n}
                </span>
                {s.t}
              </div>
            ))}
          </div>

          {/* Selector semanal: paso 1, la fecha manda el resto del flujo */}
          <WeekDatePicker value={fecha} confirmed={fechaConfirmada} onSelect={elegirFecha} />
        </div>
      </section>

      {/* Main shell */}
      <main id="chatArea" className="w-full max-w-[1180px] mx-auto mt-6 mb-9 px-4">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] gap-[18px] items-start">
          {/* Chat card */}
          <section className="min-h-[620px] bg-white/95 border border-[#c9e6ff] rounded-3xl shadow-[0_18px_45px_rgba(4,49,104,.12)] overflow-hidden flex flex-col" aria-label="Chat de reservas">
            <div className="px-4 py-3.5 border-b border-[#e0eef8] bg-white flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-[42px] h-[42px] rounded-full bg-[#edf8ff] border border-[#d4ebff] flex-none grid place-items-center overflow-hidden">
                  <Image src="/profutbollogo.png" alt="" width={36} height={36} className="w-[85%] h-[85%] object-contain" />
                </div>
                <div className="min-w-0">
                  <div className="font-black text-sm">Asistente de reservas</div>
                  <div className="text-xs font-extrabold text-[#0ca678]">
                    <span className="inline-block w-2 h-2 rounded-full bg-[#12b886] mr-1.5 shadow-[0_0_0_3px_rgba(18,184,134,.10)]" />
                    En línea · responde rápido
                  </div>
                </div>
              </div>
              <button
                onClick={nuevaReserva}
                className="border border-[#cfe4f5] bg-white text-[#0d76e8] px-2.5 py-2 rounded-[10px] text-xs font-black hover:bg-[#f7fcff] transition-colors"
              >
                Nueva reserva
              </button>
            </div>

            <div className="relative flex-1 min-h-0 flex flex-col bg-[#eef8ff]">
              {!fechaConfirmada && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-white/75 backdrop-blur-[2px] text-center px-6">
                  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#0d76e8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <rect x="3" y="4" width="18" height="18" rx="2" />
                    <path d="M16 2v4M8 2v4M3 10h18" />
                    <path d="M8 20l3-3-3-3" transform="translate(0 -1)" />
                  </svg>
                  <p className="text-sm font-bold text-[#173f70]">Elegí una fecha arriba para empezar</p>
                  <p className="text-xs text-[#6b89ab] max-w-[240px]">Así te mostramos los horarios que realmente están libres ese día.</p>
                </div>
              )}
              <div className="flex-1 min-h-0 flex flex-col" inert={!fechaConfirmada || undefined}>
              <div className={`flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3 overscroll-contain ${!fechaConfirmada ? 'opacity-40' : ''}`} role="log" aria-live="polite">
                {conectado === false && (
                  <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-2 text-center text-sm text-red-600">
                    No se pudo conectar al servidor. Verificá tu conexión e intentá de nuevo.
                  </div>
                )}

                {mensajes.length === 0 && (
                  <>
                    <div className="flex items-end gap-2 max-w-[92%]">
                      <div className="w-[29px] h-[29px] rounded-full border border-[#d4e9f8] bg-white flex items-center justify-center overflow-hidden flex-none">
                        <Image src="/profutbollogo.png" alt="" width={26} height={26} className="w-[85%] h-[85%] object-contain" />
                      </div>
                      <div className="px-3.5 py-3 rounded-[17px] rounded-bl-[6px] bg-white border border-[#d9ebf8] text-[#173f70] text-sm leading-relaxed shadow-[0_4px_14px_rgba(4,49,104,.05)]">
                        {conectado === null
                          ? 'Verificando conexión…'
                          : fechaConfirmada
                            ? '¡Hola! Estoy aquí para ayudarte a reservar tu cancha. ¿Qué cancha preferís?'
                            : 'Elegí una fecha arriba y te muestro los horarios disponibles.'}
                        <span className="block mt-1 text-[10px] opacity-60 text-right">
                          {new Date().toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit', hour12: false })}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 pl-9">
                      <button
                        onClick={() => enviar('Hola', true)}
                        disabled={cargando || !fechaConfirmada}
                        className="min-h-11 rounded-full border border-[#bddff7] bg-white text-[#0d76e8] px-3 py-1.5 text-xs font-black hover:bg-[#f7fcff] disabled:opacity-40 transition-colors"
                      >
                        Empezar a reservar
                      </button>
                      <Link
                        href="/torneos"
                        className="min-h-11 inline-flex items-center rounded-full border border-[#bddff7] bg-white text-[#0d76e8] px-3 py-1.5 text-xs font-black hover:bg-[#f7fcff] transition-colors"
                      >
                        Ver torneos
                      </Link>
                    </div>
                  </>
                )}

                {mensajes.map(renderMensaje)}
                {cargando && (
                  <div className="ml-9 max-w-[92%] rounded-2xl bg-white/80 border border-[#d9ebf8] px-3.5 py-2.5 text-xs text-[#6b89ab] italic">
                    Escribiendo…
                  </div>
                )}
                <div ref={finRef} />
              </div>

              <form
                className="border-t border-[#dbeaf5] bg-white p-2.5"
                onSubmit={(e) => {
                  e.preventDefault();
                  enviar(escribiendo);
                  if (areaRef.current) areaRef.current.style.height = 'auto';
                }}
              >
                <div className="flex gap-2 items-end">
                  <textarea
                    ref={areaRef}
                    rows={1}
                    value={escribiendo}
                    onChange={(e) => {
                      setEscribiendo(e.target.value);
                      encogerTextarea(e);
                    }}
                    placeholder="Escribí tu mensaje…"
                    aria-label="Escribí tu mensaje"
                    className="flex-1 min-h-[44px] max-h-[130px] resize-none border-[1.5px] border-[#bddcf5] rounded-2xl px-3.5 py-2.5 text-sm text-[#173f70] outline-none bg-white focus:border-[#0d76e8] focus:shadow-[0_0_0_3px_rgba(13,118,232,.10)]"
                  />
                  <button
                    type="submit"
                    disabled={conectado === false || !escribiendo.trim() || cargando || !fechaConfirmada}
                    aria-label="Enviar mensaje"
                    className="w-[46px] h-[46px] flex-none rounded-2xl bg-[#d8b32d] text-[#06366d] font-black text-lg shadow-[0_6px_15px_rgba(194,215,0,.20)] disabled:opacity-50 hover:bg-[#d0a92a] transition-colors"
                  >
                    ➤
                  </button>
                </div>
                <div className="text-[10px] text-center text-[#8aa0ba] pt-2 pb-0.5 px-3">
                  Tus datos se usan únicamente para gestionar la reserva.
                </div>
              </form>
              </div>
            </div>
          </section>

          {/* Sidebar */}
          <aside className="bg-white border border-[#c9e6ff] rounded-3xl shadow-[0_10px_28px_rgba(3,70,130,.07)] overflow-hidden lg:sticky lg:top-[92px]" aria-label="Información rápida">
            <div className="px-4 py-4 border-b border-[#e0eef8]">
              <h3 className="m-0 text-base font-bold">Reserva simple y segura</h3>
              <p className="m-0 text-xs text-[#6b89ab]">Todo lo importante, en un solo lugar.</p>
            </div>
            {[
              { icon: '💬', t: 'Atención en línea', d: 'Rápida y segura' },
              { icon: '🛡', t: 'Tu reserva, garantizada', d: 'Sin complicaciones' },
              { icon: '◷', t: 'Horarios disponibles', d: 'Lun–Sáb · 2:00 p.m.–10:00 p.m.' },
              { icon: '📍', t: 'Te esperamos', d: 'C. de Chajón 4, Antigua Guatemala' },
            ].map((r) => (
              <div key={r.t} className="px-4 py-3.5 flex gap-3 border-b border-[#edf4fa]">
                <div className="w-[38px] h-[38px] rounded-xl bg-[#edf8ff] text-[#0d76e8] grid place-items-center flex-none">{r.icon}</div>
                <div>
                  <strong className="block text-xs mb-0.5">{r.t}</strong>
                  <span className="block text-[11px] text-[#6b89ab] leading-relaxed">{r.d}</span>
                </div>
              </div>
            ))}
          </aside>
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center py-5 px-4 text-xs text-[#7e9abb]">
        Pro Futbol Antigua — Reservá tu cancha en línea · 2026
      </footer>
    </div>
  );
}