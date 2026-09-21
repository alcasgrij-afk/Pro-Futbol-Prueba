'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { MensajeSaliente } from '@profutbol/shared-types';
import WeekDatePicker, { type SlotElegido } from '../../components/WeekDatePicker';

// Cuanto dura el resaltado (una sola vez) del boton "Reservar Ahora"
// despues de elegir un horario en el picker.
const RESALTE_DURACION_MS = 2600;

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
  // Quien lo "dijo": antes se inferia de tipo==='texto' sin opciones/gateway,
  // lo que clasificaba como "usuario" cualquier respuesta simple del bot
  // (ej. el pedido de contacto) y la pintaba como burbuja azul del cliente.
  origen: 'bot' | 'usuario';
  // Version con formato (negritas/subrayado) para mensajes armados en el
  // cliente (ej. la confirmacion de cancha/fecha/hora); si falta se usa texto.
  contenido?: ReactNode;
  opciones?: { id: string; titulo: string }[];
  gateway?: string;
  reservaId?: string;
  montoQ?: number;
};

function normalizar(lista: MensajeSaliente[]): Mensaje[] {
  return lista.map((m) => ({
    tipo: m.tipo,
    texto: m.texto,
    origen: 'bot',
    opciones: m.tipo === 'lista' || m.tipo === 'botones' ? (m as { opciones: { id: string; titulo: string }[] }).opciones : undefined,
    gateway: m.tipo === 'pago' ? (m as { gateway: string }).gateway : undefined,
    reservaId: m.tipo === 'pago' ? (m as { reservaId: string }).reservaId : undefined,
    montoQ: m.tipo === 'pago' ? (m as { montoQ: number }).montoQ : undefined,
  }));
}

function formatoMMSS(segundos: number): string {
  const m = Math.floor(segundos / 60)
    .toString()
    .padStart(2, '0');
  const s = (segundos % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
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
  // Cancha+horario elegidos directamente en el picker (auto-selecciona el
  // horario de la reserva sin volver a preguntarlo en el chat).
  const [slotSeleccionado, setSlotSeleccionado] = useState<SlotElegido | null>(null);
  // El boton "Reservar Ahora" se resalta una sola vez al elegir horario.
  const [resaltarInicio, setResaltarInicio] = useState(false);
  // true tras presionar "Reservar Ahora": oculta el selector de horarios
  // (el horario ya quedo elegido arriba, no hace falta seguir mostrandolo).
  const [chatIniciado, setChatIniciado] = useState(false);
  // El server (Vercel, UTC) y el navegador (hora local de GT) nunca coinciden
  // en la hora actual: renderizar new Date() directamente en el mensaje
  // inicial rompia la hidratacion (React error #418) en cada carga. Se
  // calcula solo en el cliente, despues del mount.
  const [horaInicial, setHoraInicial] = useState('');
  // Campos del formulario inline de contacto (nombre + telefono), en vez de
  // que el usuario tenga que escribir "Nombre, Telefono" a mano en la caja.
  const [contactoNombre, setContactoNombre] = useState('');
  const [contactoTelefono, setContactoTelefono] = useState('');
  // Cuenta regresiva de 15 min para pagar: arranca al tocar "Pagar ahora",
  // no al mostrarse el mensaje (ver comentario en `pagar`).
  const [pagoIniciado, setPagoIniciado] = useState<{ reservaId: string; inicioMs: number } | null>(null);
  const [ahoraMs, setAhoraMs] = useState(() => Date.now());
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const finRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pagoIniciado) return;
    const id = setInterval(() => setAhoraMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [pagoIniciado]);

  const restanteSeg = pagoIniciado ? Math.max(0, 900 - Math.floor((ahoraMs - pagoIniciado.inicioMs) / 1000)) : null;

  useEffect(() => {
    setHoraInicial(new Date().toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit', hour12: false }));
  }, []);

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
    // Sin preventScroll, enfocar el textarea (mas abajo en la pagina) hace
    // que el navegador salte directo al chat en vez de mostrar el hero.
    window.scrollTo(0, 0);
    verificar();
    areaRef.current?.focus({ preventScroll: true });
  }, [verificar]);

  useEffect(() => {
    // No auto-scrollear en el mount inicial (mensajes=[]): eso empujaria la
    // pagina entera hacia el chat y taparia el hero "Reserva tu cancha".
    if (mensajes.length === 0) return;
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
  // mostrarRespuesta=false se usa solo al auto-enviar cancha+hora ya elegidas
  // en las casillas: el bot responde con la lista de "horarios disponibles"
  // para esa cancha, que seria redundante (el horario ya se eligio arriba) —
  // se sigue enviando (mantiene el estado de la conversacion en el backend),
  // solo no se muestra esa respuesta puntual en el chat.
  const enviar = useCallback(async (texto: string, skipMsg = false, mostrarRespuesta = true): Promise<MensajeSaliente[] | null> => {
    const t = texto.trim();
    if (!t || cargando) return null;

    if (!skipMsg) setMensajes((prev) => [...prev, { tipo: 'texto', texto: t, origen: 'usuario' }]);
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
      if (mostrarRespuesta) setMensajes((prev) => [...prev, ...normalizar(data.mensajes)]);
      return data.mensajes;
    } catch {
      setMensajes((prev) => [...prev, { tipo: 'texto', texto: 'Ocurrió un error. Intentá de nuevo.', origen: 'bot' }]);
      return null;
    } finally {
      setCargando(false);
      // No reenfocar aca: en movil, reabrir el teclado en cada respuesta
      // rompia el scroll de la pagina durante la conversacion. La atencion
      // ahora va al mensaje del bot (ver renderMensaje), no a la caja.
    }
  }, [cargando, fecha]);

  const enviarOpcion = useCallback((o: { id: string; titulo: string }) => enviar(o.id), [enviar]);

  // --- Pago (mismo que ChatWidget) ---
  // La cuenta regresiva arranca al enviar el contacto (ahi el backend crea la
  // reserva y el hold real de 15 min empieza a correr), no aca: si arrancara
  // recien al tocar "Pagar ahora" el timer mostrado se desincroniza del limite
  // real del servidor por el tiempo que el usuario tarde en llegar hasta aca.
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
      else setMensajes((prev) => [...prev, { tipo: 'texto', texto: 'No se pudo iniciar el pago. Intentá de nuevo.', origen: 'bot' }]);
    } catch {
      setMensajes((prev) => [...prev, { tipo: 'texto', texto: 'No se pudo iniciar el pago. Intentá de nuevo.', origen: 'bot' }]);
    }
  }, []);

  // Solo scrollea al chat: no enfoca el textarea aca (eso disparaba el
  // scroll-into-view nativo del navegador al foco, que terminaba tapando el
  // boton "Reservar Ahora" con el input de mensaje mas abajo).
  const focusChat = useCallback(() => {
    document.getElementById('chatArea')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const elegirSlot = useCallback((slot: SlotElegido) => {
    setFecha(slot.fecha);
    setFechaConfirmada(true);
    setSlotSeleccionado(slot);
    // Llevar al usuario al chat ya activo, en vez de dejarlo parado en el
    // selector de horario sin saber que el siguiente paso es mas abajo.
    focusChat();
  }, [focusChat]);

  useEffect(() => {
    if (!slotSeleccionado) return;
    setResaltarInicio(true);
    const t = setTimeout(() => setResaltarInicio(false), RESALTE_DURACION_MS);
    return () => clearTimeout(t);
  }, [slotSeleccionado]);

  // Arranca la conversacion mandando cancha+horario ya elegidos en el picker
  // como dos mensajes silenciosos (el bot los reconoce como texto libre) para
  // llegar directo a la confirmacion de precio, sin volver a preguntar.
  // El boton que dispara esto esta disabled mientras !fechaConfirmada, y
  // fechaConfirmada solo se pone en true junto con slotSeleccionado (ver
  // elegirSlot), asi que si llegamos aca siempre hay un slot elegido.
  const comenzarChat = useCallback(async () => {
    if (cargando || !slotSeleccionado) return;
    setChatIniciado(true);
    // Arranca siempre de cero: si quedaba una sessionId vieja en localStorage
    // (ej. se volvio a esta pagina despues de completar un pago anterior sin
    // pasar por "Cambiar horario"), reusarla mezclaba el estado de esa
    // conversacion terminada con la nueva y el bot volvia a INICIO ("Que
    // cancha deseas reservar?") en vez de ir directo a la confirmacion.
    localStorage.removeItem(SESSION_KEY);
    setPagoIniciado(null);

    const fechaLarga = new Date(`${slotSeleccionado.fecha}T12:00:00`).toLocaleDateString('es-GT', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
    // Reemplaza el historial (no lo extiende): junto con la sessionId nueva,
    // esto asegura que "Reservar Ahora" siempre es un reinicio limpio.
    setMensajes([
      {
        tipo: 'texto',
        origen: 'bot',
        texto: `¡Perfecto! Elegiste ${slotSeleccionado.canchaNombre} el ${fechaLarga} a las ${slotSeleccionado.horaInicio}.`,
        contenido: (
          <>
            ¡Perfecto! Elegiste <strong className="font-black">{slotSeleccionado.canchaNombre}</strong> el{' '}
            <strong className="font-black underline">{fechaLarga}</strong> a las{' '}
            <strong className="font-black underline">{slotSeleccionado.horaInicio}</strong>.
          </>
        ),
      },
    ]);
    await enviar(slotSeleccionado.canchaNombre, true, false);
    await enviar(slotSeleccionado.horaInicio, true);
  }, [cargando, slotSeleccionado, enviar]);

  // Vuelve a habilitar el selector de horarios de arriba para elegir uno
  // nuevo: resetea todo al estado inicial (incluida fechaConfirmada, que
  // antes quedaba en true y dejaba la caja de texto habilitada sin haber
  // elegido nada) para que el flujo vuelva a empezar en "elegi fecha/hora".
  const cambiarHorario = useCallback(() => {
    setSlotSeleccionado(null);
    setChatIniciado(false);
    setFechaConfirmada(false);
    setMensajes([]);
    setPagoIniciado(null);
    localStorage.removeItem(SESSION_KEY);
  }, []);

  function encogerTextarea(e: { currentTarget: HTMLTextAreaElement }) {
    const el = e.currentTarget;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 130) + 'px';
  }

  function enviarDesdeCaja() {
    enviar(escribiendo);
    if (areaRef.current) areaRef.current.style.height = 'auto';
  }

  async function enviarContacto() {
    const nombre = contactoNombre.trim();
    if (!nombre || contactoTelefono.length !== 8) return;
    setContactoNombre('');
    setContactoTelefono('');
    // La cuenta regresiva arranca aca (no al tocar "Pagar ahora" despues):
    // enviar el contacto es lo que hace que el backend cree la reserva y
    // empiece a correr el hold real de 15 min (ver reservas.service.ts,
    // expiraEn), asi que este es el momento que realmente coincide con el
    // limite del servidor.
    const respuesta = await enviar(`${nombre}, ${contactoTelefono}`);
    const mensajePago = respuesta?.find((m) => m.tipo === 'pago') as { reservaId: string } | undefined;
    if (mensajePago) setPagoIniciado({ reservaId: mensajePago.reservaId, inicioMs: Date.now() });
  }

  const renderMensaje = (m: Mensaje, i: number, esUltimo: boolean) => {
    const esUsuario = m.origen === 'usuario';
    // El ultimo mensaje del bot se resalta para que el usuario note que hay
    // algo que responder, en vez de resaltar la caja de texto en cada turno.
    const resaltado = !esUsuario && esUltimo;
    const tiempo = new Date().toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit', hour12: false });

    // El aviso "Tenes 15 minutos..." siempre llega justo despues del mensaje
    // de tipo 'pago' (ver chat.service.ts, crearReserva): se detecta por
    // posicion para reemplazar el texto fijo por la cuenta regresiva real
    // una vez que el usuario toco "Pagar ahora" para esa reserva puntual.
    const anterior = mensajes[i - 1];
    const esAvisoDePago = m.tipo === 'texto' && anterior?.tipo === 'pago' && pagoIniciado?.reservaId === anterior.reservaId;
    const cuerpo = esAvisoDePago
      ? typeof restanteSeg === 'number' && restanteSeg > 0
        ? `Tenés ${formatoMMSS(restanteSeg)} para completar el pago o el horario se libera.`
        : 'El tiempo para completar el pago expiró.'
      : (m.contenido ?? m.texto);

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
          className={`px-3.5 py-3 rounded-[17px] text-sm leading-relaxed transition-colors ${
            esUsuario
              ? 'rounded-br-[6px] bg-[#073b82] border border-[#073b82] text-white shadow-[0_4px_14px_rgba(4,49,104,.05)]'
              : resaltado
                ? 'rounded-bl-[6px] bg-[#eaf4ff] border-2 border-[#0d76e8]/50 text-[#173f70] shadow-[0_4px_18px_rgba(13,118,232,.18)]'
                : 'rounded-bl-[6px] bg-white border border-[#d9ebf8] text-[#173f70] shadow-[0_4px_14px_rgba(4,49,104,.05)]'
          }`}
        >
          <div className="whitespace-pre-wrap break-words">{cuerpo}</div>

          {m.tipo === 'pedir_contacto' && esUltimo && (
            <div className="flex flex-col gap-2 pt-2.5">
              <input
                type="text"
                value={contactoNombre}
                onChange={(e) => setContactoNombre(e.target.value)}
                disabled={cargando}
                placeholder="Tu nombre"
                aria-label="Tu nombre"
                className="min-h-11 rounded-xl border border-[#bddff7] bg-white px-3 py-2 text-sm text-[#173f70] outline-none focus:border-[#0d76e8] disabled:opacity-50"
              />
              <input
                type="tel"
                inputMode="numeric"
                // El estado guarda solo los 8 digitos (lo que se manda al bot);
                // el guion es puramente de presentacion, insertado al mostrar.
                value={contactoTelefono.length > 4 ? `${contactoTelefono.slice(0, 4)}-${contactoTelefono.slice(4)}` : contactoTelefono}
                onChange={(e) => setContactoTelefono(e.target.value.replace(/\D/g, '').slice(0, 8))}
                disabled={cargando}
                placeholder="XXXX-XXXX"
                aria-label="Tu teléfono, 8 dígitos"
                maxLength={9}
                className="min-h-11 rounded-xl border border-[#bddff7] bg-white px-3 py-2 text-sm text-[#173f70] outline-none focus:border-[#0d76e8] disabled:opacity-50"
              />
              <button
                type="button"
                onClick={enviarContacto}
                disabled={cargando || !contactoNombre.trim() || contactoTelefono.length !== 8}
                className="min-h-11 rounded-full bg-[#0d76e8] text-white px-3 py-1.5 text-xs font-black hover:bg-[#0b66c4] disabled:opacity-40 transition-colors"
              >
                Enviar contacto
              </button>
            </div>
          )}

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
    <div className="min-h-screen bg-gradient-to-b from-[#f7fbff] to-[#edf7ff] text-[#173f70]">
      <a href="#chatArea" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-white focus:text-[#173f70] focus:px-3 focus:py-2 rounded">
        Saltar al chat de reservas
      </a>

      {/* Top bar */}
      <header className="sticky top-0 z-50 bg-white/97 backdrop-blur-md border-b border-[rgba(10,80,145,.09)]">
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

          <div className="relative mt-7">
          <div className="flex justify-start sm:justify-center items-center gap-2.5 overflow-x-auto flex-nowrap sm:flex-wrap pb-0.5 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
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
          {/* Hint de que hay mas pasos scrolleando: en movil la fila se corta
              a mitad de palabra sin avisar que sigue. */}
          <div className="pointer-events-none absolute right-0 top-0 bottom-0.5 w-10 bg-gradient-to-l from-[#032c65] to-transparent sm:hidden" aria-hidden />
          </div>

          {/* Selector semanal: elige fecha+cancha+horario de una vez. Se oculta
              tras arrancar el chat: el horario ya quedo elegido arriba. */}
          {!chatIniciado && (
            <WeekDatePicker
              value={fecha}
              confirmed={fechaConfirmada}
              selectedSlot={slotSeleccionado ? { canchaId: slotSeleccionado.canchaId, horaInicio: slotSeleccionado.horaInicio } : null}
              onSelectSlot={elegirSlot}
              locked={!!slotSeleccionado}
            />
          )}
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
              {slotSeleccionado && (
                <button
                  onClick={cambiarHorario}
                  className="flex-none min-h-11 rounded-full border border-[#bddff7] bg-white text-[#0d76e8] px-3 py-1.5 text-xs font-black hover:bg-[#f7fcff] transition-colors"
                >
                  Cambiar horario
                </button>
              )}
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
              <div className={`flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3 ${!fechaConfirmada ? 'opacity-40' : ''}`} role="log" aria-live="polite">
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
                        {conectado === null ? (
                          'Verificando conexión…'
                        ) : !fechaConfirmada ? (
                          'Elegí una fecha arriba y te muestro los horarios disponibles.'
                        ) : slotSeleccionado ? (
                          <>
                            ¡Perfecto! Elegiste <strong className="font-black">{slotSeleccionado.canchaNombre}</strong> el{' '}
                            <strong className="font-black underline">
                              {new Date(`${slotSeleccionado.fecha}T12:00:00`).toLocaleDateString('es-GT', {
                                weekday: 'long',
                                day: 'numeric',
                                month: 'long',
                              })}
                            </strong>{' '}
                            a las <strong className="font-black underline">{slotSeleccionado.horaInicio}</strong>. Click en{' '}
                            <span className="font-black text-[#0d76e8]">&quot;Reservar Ahora&quot;</span> para confirmar.
                          </>
                        ) : (
                          '¡Hola! Estoy aquí para ayudarte a reservar tu cancha. ¿Qué cancha preferís?'
                        )}
                        <span className="block mt-1 text-[10px] opacity-60 text-right">{horaInicial}</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 pl-9">
                      <button
                        onClick={comenzarChat}
                        disabled={cargando || !fechaConfirmada}
                        className={`min-h-11 rounded-full border border-[#bddff7] bg-white text-[#0d76e8] px-3 py-1.5 text-xs font-black hover:bg-[#f7fcff] disabled:opacity-40 transition-all ${
                          resaltarInicio ? 'ring-2 ring-[#d8b32d] shadow-[0_0_0_5px_rgba(216,179,45,.25)] scale-105' : ''
                        }`}
                      >
                        Reservar Ahora
                      </button>
                    </div>
                  </>
                )}

                {mensajes.map((m, i) => renderMensaje(m, i, i === mensajes.length - 1))}
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
                  enviarDesdeCaja();
                }}
              >
                <div className="flex gap-2 items-end">
                  <textarea
                    ref={areaRef}
                    rows={1}
                    value={escribiendo}
                    disabled={!fechaConfirmada}
                    onChange={(e) => {
                      setEscribiendo(e.target.value);
                      encogerTextarea(e);
                    }}
                    onKeyDown={(e) => {
                      // Enter envia; Shift+Enter sigue insertando salto de linea.
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        enviarDesdeCaja();
                      }
                    }}
                    placeholder="Escribí tu mensaje…"
                    aria-label="Escribí tu mensaje"
                    className="flex-1 min-h-[44px] max-h-[130px] resize-none border-[1.5px] border-[#bddcf5] rounded-2xl px-3.5 py-2.5 text-sm text-[#173f70] outline-none bg-white focus:border-[#0d76e8] disabled:opacity-60"
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
          </section>

          {/* Sidebar */}
          <aside className="bg-white border border-[#c9e6ff] rounded-3xl shadow-[0_10px_28px_rgba(3,70,130,.07)] overflow-hidden lg:sticky lg:top-[92px]" aria-label="Información rápida">
            <div className="px-4 py-4 border-b border-[#e0eef8]">
              <h3 className="m-0 text-base font-bold">Reserva simple y segura</h3>
              <p className="m-0 text-xs text-[#6b89ab]">Todo lo importante, en un solo lugar.</p>
            </div>
            {[
              // Iconos SVG (no emoji) para que combinen con el resto de la
              // pagina (header, stepper, WeekDatePicker) en vez de detonar
              // como el unico elemento con iconografia distinta.
              { icon: <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />, t: 'Atención en línea', d: 'Rápida y segura' },
              { icon: <><path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5z" /><path d="m9 12 2 2 4-4" /></>, t: 'Tu reserva, garantizada', d: 'Sin complicaciones' },
              { icon: <><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></>, t: 'Horarios disponibles', d: 'Lun–Sáb · 2:00 p.m.–10:00 p.m.' },
              { icon: <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0ZM12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />, t: 'Te esperamos', d: 'C. de Chajón 4, Antigua Guatemala' },
            ].map((r) => (
              <div key={r.t} className="px-4 py-3.5 flex gap-3 border-b border-[#edf4fa]">
                <div className="w-[38px] h-[38px] rounded-xl bg-[#edf8ff] text-[#0d76e8] grid place-items-center flex-none">
                  <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    {r.icon}
                  </svg>
                </div>
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