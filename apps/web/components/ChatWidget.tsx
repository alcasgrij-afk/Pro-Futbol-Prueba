'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import type { MensajeSaliente } from '@profutbol/shared-types';
import { hoyISODias, RESERVA_MAX_DIAS } from '../lib/fechas';

const SESSION_KEY = 'profutbol_chat_session';

// Fecha local (no UTC): toISOString() corre el "hoy" un dia hacia adelante
// cerca de medianoche GT, y el server rechazaria la fecha local del usuario.
function hoyISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

type Mensaje = { tipo: string; texto: string; opciones?: { id: string; titulo: string }[]; gateway?: string; reservaId?: string; montoQ?: number };

/**
 * Widget de chat. Antes usaba Socket.IO; ahora es HTTP puro (POST
 * /api/chat/mensajes). Ver PENDIENTES.md 10.1 para el porque del cambio.
 *
 * "Listo" = endpoint de health accesible. Reemplaza el antiguo `connect`
 * del socket con un fetch de verificacion al montar + reintentos.
 */
export default function ChatWidget() {
  const pathname = usePathname();

  const [abierto, setAbierto] = useState(false);
  const [conectado, setConectado] = useState<boolean | null>(null); // null = verificando
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [cargando, setCargando] = useState(false);
  const [escribiendo, setEscribiendo] = useState('');
  // Fecha para la cual se reserva; el date picker la envia con cada mensaje.
  const [fecha, setFecha] = useState(hoyISO());
  const finRef = useRef<HTMLDivElement>(null);
  const intervaloRef = useRef<ReturnType<typeof setInterval>>(null);

  // --- Readiness: GET /api/health al montar y cada 10s si falla ---
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
    intervaloRef.current = setInterval(verificar, 10_000);
    return () => clearInterval(intervaloRef.current ?? undefined);
  }, [verificar]);

  // --- Auto-scroll ---
  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }, [mensajes]);

  // --- Enviar mensaje ---
  const enviar = useCallback(async (texto: string) => {
    const t = texto.trim();
    if (!t || cargando) return;

    // Show user message immediately
    setMensajes((prev) => [...prev, { tipo: 'texto', texto: t, opciones: undefined }]);
    setEscribiendo('');
    setCargando(true);

    try {
      const sessionId = localStorage.getItem(SESSION_KEY) || undefined;
      const res = await fetch('/api/chat/mensajes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, texto: t, fecha }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.message ?? `Error ${res.status}`);
      }

      const data: { sessionId: string; mensajes: MensajeSaliente[] } = await res.json();
      localStorage.setItem(SESSION_KEY, data.sessionId);
      setMensajes((prev) => [...prev, ...normalizar(data.mensajes)]);
    } catch (error) {
      setMensajes((prev) => [...prev, { tipo: 'texto', texto: 'Ocurrió un error. Intentá de nuevo.' }]);
    } finally {
      setCargando(false);
    }
  }, [cargando, fecha]);

  const enviarOpcion = useCallback(
    (o: { id: string; titulo: string }) => enviar(o.id),
    [enviar],
  );

  // --- Pago: ya es HTTP, no cambia ---
  const pagar = useCallback(async (m: Mensaje) => {
    if (!m.gateway || !m.reservaId) return;
    try {
      const res = await fetch(`/api/payments/${m.gateway.toLowerCase()}/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referenciaTipo: 'RESERVA',
          referenciaId: m.reservaId,
          monto: m.montoQ,
        }),
      });
      const data = await res.json();
      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
      } else {
        setMensajes((prev) => [...prev, { tipo: 'texto', texto: 'No se pudo iniciar el pago. Intentá de nuevo.' }]);
      }
    } catch {
      setMensajes((prev) => [...prev, { tipo: 'texto', texto: 'No se pudo iniciar el pago. Intentá de nuevo.' }]);
    }
  }, []);

  // /reservar ya tiene su propio chat incrustado; no duplicar el flotante.
  if (pathname === '/reservar') return null;

  const renderMensaje = (m: Mensaje, i: number) => (
    <div key={i} className={`mb-2 max-w-[85%] rounded-2xl px-3 py-2 text-sm ${m.tipo === 'texto' && !m.opciones && !m.gateway ? 'self-end bg-blue-600 text-white' : 'self-start bg-gray-100 text-gray-900'}`}>
      <div className="whitespace-pre-wrap break-words">{m.texto}</div>

      {m.opciones && (
        <div className="mt-2 flex flex-wrap gap-2">
          {m.opciones.map((o) => (
            <button
              key={o.id}
              disabled={cargando}
              onClick={() => enviarOpcion(o)}
              className="rounded-full border border-blue-600 px-3 py-1 text-xs text-blue-700 hover:bg-blue-600 hover:text-white disabled:opacity-40 min-h-11"
            >
              {o.titulo}
            </button>
          ))}
        </div>
      )}

      {m.gateway && m.reservaId && (
        <button
          onClick={() => pagar(m)}
          className="mt-2 rounded-lg bg-green-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-600"
        >
          Pagar ahora (Q{m.montoQ})
        </button>
      )}
    </div>
  );

  const textoBotonEstado = conectado === null
    ? 'Verificando…'
    : conectado
      ? 'Conectado · Listo para ayudarte'
      : 'Sin conexión';

  return (
    <>
      {!abierto && (
        <button
          onClick={() => setAbierto(true)}
          aria-label="Abrir chat"
          className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700 active:scale-95 transition-transform"
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </button>
      )}

      {abierto && (
        <div className="fixed bottom-6 right-6 z-50 flex h-[500px] max-h-[calc(100dvh-3rem)] w-[min(370px,calc(100vw-3rem))] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between bg-blue-600 px-4 py-3 text-white">
            <div>
              <strong className="text-sm">Pro Futbol Antigua</strong>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-xs">
                <span className={`h-2 w-2 rounded-full ${
                  conectado === null
                    ? 'bg-amber-400 animate-pulse motion-reduce:animate-none'
                    : conectado
                      ? 'bg-green-400'
                      : 'bg-red-400'
                }`} />
                {textoBotonEstado}
              </span>
              <button onClick={() => setAbierto(false)} aria-label="Cerrar chat" className="rounded p-3 hover:bg-blue-700">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>

          <label className="flex items-center justify-between gap-2 border-b border-gray-200 px-3 py-2 text-xs text-gray-500">
            <span>Reservar para el</span>
            <input
              type="date"
              value={fecha}
              min={hoyISO()}
              max={hoyISODias(RESERVA_MAX_DIAS)}
              onChange={(e) => setFecha(e.target.value)}
              aria-label="Fecha de la reserva"
              suppressHydrationWarning
              className="min-h-11 rounded border border-gray-500 px-2 text-xs outline-none focus:border-blue-500"
            />
          </label>

          <div className="flex-1 overflow-y-auto p-3" role="log" aria-live="polite">
            {mensajes.length === 0 && (
              <p className="p-6 text-center text-sm text-gray-500">
                ¡Hola! ¿En qué cancha quieres jugar? Escribí &ldquo;Hola&rdquo; para empezar.
              </p>
            )}
            {mensajes.map(renderMensaje)}
            {cargando && (
              <div className="mb-2 self-start rounded-2xl bg-gray-100 px-3 py-2 text-xs text-gray-400 italic">
                Escribiendo…
              </div>
            )}
            <div ref={finRef} />
          </div>

          <form
            className="flex gap-2 border-t border-gray-200 p-3"
            onSubmit={(e) => { e.preventDefault(); enviar(escribiendo); }}
          >
            <input
              value={escribiendo}
              onChange={(e) => setEscribiendo(e.target.value)}
              placeholder="Escribe tu mensaje..."
              aria-label="Tu mensaje"
              className="flex-1 rounded-full border border-gray-300 px-4 py-2 text-sm outline-none focus:border-blue-500"
            />
            <button
              type="submit"
              disabled={conectado === false || !escribiendo.trim() || cargando}
              aria-label="Enviar"
              className="rounded-full bg-blue-600 px-4 py-2 text-white disabled:opacity-40"
            >
              Enviar
            </button>
          </form>
        </div>
      )}
    </>
  );
}

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