'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import type { MensajeSaliente } from '@profutbol/shared-types';

const SESSION_KEY = 'profutbol_chat_session';

type Mensaje = { tipo: string; texto: string; opciones?: { id: string; titulo: string }[]; gateway?: string; reservaId?: string; montoQ?: number };

function urlWs(): string {
  const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  return `${base.replace(/^http/, 'ws')}/chat`;
}

export default function ChatWidget() {
  const [abierto, setAbierto] = useState(false);
  const [conectado, setConectado] = useState(false);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [escribiendo, setEscribiendo] = useState('');
  const socketRef = useRef<Socket | null>(null);
  const finRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const socket = io(urlWs(), {
      auth: { sessionId: localStorage.getItem(SESSION_KEY) || undefined },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30000,
    });
    socketRef.current = socket;

    socket.on('connect', () => setConectado(true));
    socket.on('disconnect', () => setConectado(false));

    socket.on('chat:session', ({ sessionId: id }) => {
      localStorage.setItem(SESSION_KEY, id);
    });

    socket.on('chat:respuesta', ({ mensajes: lista }: { mensajes: MensajeSaliente[] }) => {
      setMensajes((prev) => [...prev, ...normalizar(lista)]);
    });

    socket.on('chat:error', ({ mensaje }: { mensaje: string }) => {
      setMensajes((prev) => [...prev, { tipo: 'texto', texto: mensaje }]);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensajes]);

  const enviar = useCallback((texto: string) => {
    const t = texto.trim();
    if (!t || !socketRef.current) return;
    socketRef.current.emit('chat:message', { texto: t });
    setMensajes((prev) => [...prev, { tipo: 'texto', texto: t, opciones: undefined }]);
  }, []);

  const enviarOpcion = useCallback(
    (o: { id: string; titulo: string }) => enviar(o.id),
    [enviar],
  );

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
        setMensajes((prev) => [...prev, { tipo: 'texto', texto: 'No se pudo iniciar el pago. Intenta de nuevo.' }]);
      }
    } catch {
      setMensajes((prev) => [...prev, { tipo: 'texto', texto: 'No se pudo iniciar el pago. Intenta de nuevo.' }]);
    }
  }, []);

  const renderMensaje = (m: Mensaje, i: number) => (
    <div key={i} className={`mb-2 max-w-[85%] rounded-2xl px-3 py-2 text-sm ${m.tipo === 'texto' && !m.opciones && !m.gateway ? 'self-end bg-blue-600 text-white' : 'self-start bg-gray-100 text-gray-900'}`}>
      <div className="whitespace-pre-wrap break-words">{m.texto}</div>

      {m.opciones && (
        <div className="mt-2 flex flex-wrap gap-2">
          {m.opciones.map((o) => (
            <button
              key={o.id}
              onClick={() => enviarOpcion(o)}
              className="rounded-full border border-blue-600 px-3 py-1 text-xs text-blue-700 hover:bg-blue-600 hover:text-white"
            >
              {o.titulo}
            </button>
          ))}
        </div>
      )}

      {m.gateway && m.reservaId && (
        <button
          onClick={() => pagar(m)}
          className="mt-2 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700"
        >
          Pagar ahora (Q{m.montoQ})
        </button>
      )}
    </div>
  );

  return (
    <>
      {!abierto && (
        <button
          onClick={() => setAbierto(true)}
          aria-label="Abrir chat"
          className="fixed bottom-6 right-6 z-[9999] flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700"
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </button>
      )}

      {abierto && (
        <div className="fixed bottom-6 right-6 z-[9999] flex h-[500px] w-[370px] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between bg-blue-600 px-4 py-3 text-white">
            <div>
              <strong className="text-sm">Pro Futbol Antigua</strong>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-xs">
                <span className={`h-2 w-2 rounded-full ${conectado ? 'bg-green-400' : 'bg-amber-400'}`} />
                {conectado ? 'Conectado' : 'Conectando...'}
              </span>
              <button onClick={() => setAbierto(false)} aria-label="Cerrar chat" className="rounded p-1 hover:bg-blue-700">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3" role="log" aria-live="polite">
            {mensajes.length === 0 && (
              <p className="p-6 text-center text-sm text-gray-500">
                ¡Hola! ¿En qué cancha quieres jugar?
              </p>
            )}
            {mensajes.map(renderMensaje)}
            <div ref={finRef} />
          </div>

          <form
            className="flex gap-2 border-t border-gray-200 p-3"
            onSubmit={(e) => { e.preventDefault(); enviar(escribiendo); setEscribiendo(''); }}
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
              disabled={!conectado || !escribiendo}
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
