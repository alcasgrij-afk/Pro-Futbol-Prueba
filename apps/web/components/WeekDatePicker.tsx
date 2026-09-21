'use client';

import { useEffect, useState } from 'react';
import { TipoCancha, type CanchaDTO } from '@profutbol/shared-types';
import { hoyISODias } from '../lib/fechas';

type Bloque = { horaInicio: string; horaFin: string; disponible: boolean };
type InfoCancha = { bloques: Bloque[] } | 'error' | undefined;
export type SlotElegido = { fecha: string; canchaId: string; canchaNombre: string; horaInicio: string; horaFin: string };

// Ventana de navegacion del selector de fecha: se puede pasear hasta 90 dias
// hacia adelante (las flechas del date-nav corren esta ventana de a 1 dia),
// mostrando 3 tarjetas de fecha a la vez.
const DIAS_VISIBLES = 3;
const DIAS_MAX = 90;
// El glow llamativo solo corre una vez al montar, no queda parpadeando
// mientras el usuario decide (era demasiado insistente).
const GLOW_DURACION_MS = 2600;
// Cuanto dura el "flash" al tocar un horario no disponible.
const FLASH_DURACION_MS = 350;
// Cuanto queda visible el aviso "Horario No Disponible".
const AVISO_DURACION_MS = 2000;

function corto(nombre: string): string {
  const m = nombre.match(/Futbol\s*(\d+)/i);
  return m ? `F${m[1]}` : nombre.slice(0, 2).toUpperCase();
}

// Bajada de linea corta por tipo de cancha (mismo tono que las tarjetas de
// precios del landing: dato real -- capacidad -- no una frase inventada).
function blurbDe(tipo: TipoCancha): string {
  return tipo === TipoCancha.FUTBOL_7 ? 'Más espacio, más juego.' : 'Fútbol rápido, más diversión.';
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}

// Offset en dias (puede ser negativo) entre hoy y una fecha ISO, en hora local.
function diasDesdeHoy(fechaISO: string): number {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const objetivo = new Date(`${fechaISO}T00:00:00`);
  return Math.round((objetivo.getTime() - hoy.getTime()) / 86400000);
}

function CheckIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="#123a22" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m5 12 5 5 9-9" />
    </svg>
  );
}

function ClockIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  );
}

/**
 * Selector de fecha y horario: date-nav paginable (hasta 90 dias) + una
 * seccion por cancha con su grilla de horas para la fecha activa. Cada
 * casilla disponible es un boton que selecciona esa cancha+hora+fecha de una
 * sola vez (reemplaza tener que volver a elegir horario en el chat). Las
 * casillas no disponibles no son seleccionables: al tocarlas solo muestran un
 * aviso, nunca disparan una reserva.
 */
export default function WeekDatePicker({
  value,
  confirmed,
  selectedSlot,
  onSelectSlot,
  locked = false,
}: {
  value: string;
  confirmed: boolean;
  selectedSlot: { canchaId: string; horaInicio: string } | null;
  onSelectSlot: (slot: SlotElegido) => void;
  // Una vez elegido un horario, el resto de las casillas y la navegacion de
  // fecha se deshabilitan para que el usuario se enfoque en esa unica opcion;
  // se desbloquea desde afuera con el boton "Cambiar horario".
  locked?: boolean;
}) {
  const [canchas, setCanchas] = useState<CanchaDTO[] | null>(null);
  const [porCancha, setPorCancha] = useState<Record<string, InfoCancha>>({});
  const [glowActivo, setGlowActivo] = useState(true);
  const [flashKey, setFlashKey] = useState<string | null>(null);
  const [aviso, setAviso] = useState(false);
  // Offset en dias desde hoy de la fecha que se esta mostrando (activo) y del
  // primer date-card visible en la tira de 3 (ventana). Un solo estado para
  // los dos: actualizarlos por separado con setState(valorViejo + delta) se
  // pierde si dos clicks del mismo arrow caen en el mismo tick (React 18
  // batchea ambos contra el mismo "valorViejo" todavia no re-renderizado).
  const [nav, setNav] = useState({ activo: 0, ventana: 0 });
  const { activo: indiceActivo, ventana: ventanaInicio } = nav;

  const fechaActiva = hoyISODias(indiceActivo);
  const diaActivoConfirmado = confirmed && !!selectedSlot && value === fechaActiva;

  useEffect(() => {
    const t = setTimeout(() => setGlowActivo(false), GLOW_DURACION_MS);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(false), AVISO_DURACION_MS);
    return () => clearTimeout(t);
  }, [aviso]);

  // Una vez bloqueado (ya se eligio horario), la fecha activa queda fija en
  // la que confirmo el padre, y la ventana se ajusta para que quede visible.
  useEffect(() => {
    if (!locked) return;
    const offset = diasDesdeHoy(value);
    setNav((n) => ({
      activo: offset,
      ventana: clamp(offset < n.ventana ? offset : offset > n.ventana + DIAS_VISIBLES - 1 ? offset - DIAS_VISIBLES + 1 : n.ventana, 0, DIAS_MAX - DIAS_VISIBLES),
    }));
  }, [locked, value]);

  useEffect(() => {
    let cancelado = false;
    fetch('/api/canchas', { cache: 'no-store' })
      .then((r) => r.json())
      .then((lista: CanchaDTO[]) => {
        if (!cancelado) setCanchas(lista);
      })
      .catch(() => {
        if (!cancelado) setCanchas([]);
      });
    return () => {
      cancelado = true;
    };
  }, []);

  // Una sola request por la fecha activa (todas las canchas juntas): solo se
  // muestra un dia a la vez, asi que no hace falta prefetchear los 90.
  useEffect(() => {
    let cancelado = false;
    setPorCancha({});
    fetch(`/api/canchas/disponibilidad?fecha=${fechaActiva}`, { cache: 'no-store' })
      .then((r) => {
        if (!r.ok) throw new Error('no ok');
        return r.json();
      })
      .then((data: { canchaId: string; bloques: Bloque[] }[]) => {
        if (cancelado) return;
        const nuevo: Record<string, InfoCancha> = {};
        for (const { canchaId, bloques } of data) nuevo[canchaId] = { bloques };
        setPorCancha(nuevo);
      })
      .catch(() => {
        if (!cancelado && canchas) {
          setPorCancha(Object.fromEntries(canchas.map((c) => [c.id, 'error' as const])));
        }
      });
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fechaActiva]);

  function tocarNoDisponible(key: string) {
    setFlashKey(key);
    setAviso(true);
    setTimeout(() => setFlashKey((k) => (k === key ? null : k)), FLASH_DURACION_MS);
  }

  function paginar(delta: number) {
    if (locked) return;
    setNav((n) => {
      const ventana = clamp(n.ventana + delta, 0, DIAS_MAX - DIAS_VISIBLES);
      return { activo: ventana, ventana };
    });
  }

  function elegirFecha(offset: number) {
    if (locked) return;
    setNav((n) => ({ ...n, activo: offset }));
  }

  const puedeRetroceder = !locked && ventanaInicio > 0;
  const puedeAvanzar = !locked && ventanaInicio < DIAS_MAX - DIAS_VISIBLES;
  const tarjetas = Array.from({ length: DIAS_VISIBLES }, (_, i) => ventanaInicio + i);

  const seleccionCancha = selectedSlot ? canchas?.find((c) => c.id === selectedSlot.canchaId) : undefined;
  const textoSeleccion =
    diaActivoConfirmado && seleccionCancha && selectedSlot
      ? `${seleccionCancha.nombre} · ${new Date(`${fechaActiva}T12:00:00`).toLocaleDateString('es-GT', { weekday: 'long', day: 'numeric', month: 'long' })} · ${selectedSlot.horaInicio}`
      : 'Ningún horario seleccionado';

  return (
    <div className="relative mx-auto mt-6 w-full max-w-[820px]">
      {aviso && (
        <div
          role="status"
          aria-live="assertive"
          className="pointer-events-none absolute left-1/2 top-1 z-40 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#ff765f] text-[#3a1206] text-xs font-black px-4 py-2 shadow-[0_10px_24px_rgba(0,0,0,.35)]"
        >
          Horario No Disponible
        </div>
      )}
      {!confirmed && glowActivo && (
        <div aria-hidden className="absolute -inset-1.5 rounded-[28px] bg-[#0b8ff5]/40 blur-xl motion-safe:animate-pulse" />
      )}
      <div
        className={`relative rounded-3xl border bg-gradient-to-b from-[#06254c]/85 to-[#041d3c]/92 backdrop-blur-md px-4 py-5 sm:px-6 transition-colors ${
          confirmed ? 'border-white/15' : 'border-[#26c2ff]/60 shadow-[0_20px_45px_rgba(0,0,0,0.28)]'
        }`}
      >
        <div className="flex items-center justify-center gap-2 mb-1">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#18b8ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M16 2v4M8 2v4M3 10h18" />
          </svg>
          <h2 className="text-white font-black text-base sm:text-lg">Elegí tu fecha</h2>
        </div>
        <p className="text-[#a9c9e8] text-[10px] sm:text-xs mb-4">Elegí el día y después el horario en cada cancha.</p>

        {/* Date-nav: flechas + 3 tarjetas de fecha, paginable hasta 90 dias.
            En movil las tarjetas tienen ancho fijo y la fila scrollea (en vez
            de comprimirse hasta truncar "Lun, 2..." ilegible); desde sm+ se
            reparten en una grilla fija de 5 columnas. */}
        <div className="flex sm:grid sm:grid-cols-[44px_repeat(3,minmax(0,1fr))_44px] gap-2 mb-4 overflow-x-auto sm:overflow-visible [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <button
            type="button"
            aria-label="Fecha anterior"
            disabled={!puedeRetroceder}
            onClick={() => paginar(-1)}
            className="flex-none w-9 sm:w-auto rounded-2xl border border-[#3fb4ff]/35 bg-[#082b58]/70 text-white grid place-items-center text-lg disabled:opacity-30 disabled:cursor-not-allowed hover:not-disabled:bg-[#0d3a78]/80 transition-colors"
          >
            ‹
          </button>
          {tarjetas.map((offset) => {
            const fechaISO = hoyISODias(offset);
            const d = new Date(`${fechaISO}T00:00:00`);
            const activa = offset === indiceActivo;
            return (
              <button
                key={offset}
                type="button"
                disabled={locked && !activa}
                onClick={() => elegirFecha(offset)}
                className={`flex-none w-[132px] sm:w-auto sm:min-w-0 rounded-2xl border px-2 py-2 text-left transition-colors ${
                  activa
                    ? 'bg-gradient-to-br from-[#0a83ee] to-[#1677e3] border-[#19d0ff] shadow-[0_10px_28px_rgba(8,143,245,.28)]'
                    : 'bg-[#082b58]/70 border-[#3fb4ff]/25 hover:bg-[#0d3a78]/70'
                } ${locked && !activa ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                <div className="text-white font-black text-[13px] sm:text-sm capitalize truncate">
                  {d.toLocaleDateString('es-GT', { weekday: 'short', day: 'numeric', month: 'short' })}
                </div>
                {offset === 0 && (
                  <span className="inline-flex mt-1 text-[9px] font-black px-1.5 py-0.5 rounded-full bg-[#18b8ff] text-[#032951]">Hoy</span>
                )}
              </button>
            );
          })}
          <button
            type="button"
            aria-label="Fecha siguiente"
            disabled={!puedeAvanzar}
            onClick={() => paginar(1)}
            className="flex-none w-9 sm:w-auto rounded-2xl border border-[#3fb4ff]/35 bg-[#082b58]/70 text-white grid place-items-center text-lg disabled:opacity-30 disabled:cursor-not-allowed hover:not-disabled:bg-[#0d3a78]/80 transition-colors"
          >
            ›
          </button>
        </div>

        {/* Una seccion por cancha, con la grilla de horas de la fecha activa. */}
        <div className="flex flex-col gap-3">
          {canchas === null ? (
            <div className="h-28 rounded-2xl bg-white/10 motion-safe:animate-pulse" aria-hidden />
          ) : (
            canchas.map((c) => {
              const info = porCancha[c.id];
              return (
                <div
                  key={c.id}
                  className="rounded-[20px] border border-[#26c2ff]/30 bg-gradient-to-b from-[#06254c]/75 to-[#041d3c]/85 px-3.5 py-3.5"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full border-[3px] border-[#24d6d1] bg-[#031f42]/70 text-white grid place-items-center font-black text-[11px] flex-none">
                      {corto(c.nombre)}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-white font-black text-sm truncate">{c.nombre}</h3>
                      <p className="text-[#a9c9e8] text-[11px] truncate">{blurbDe(c.tipo)}</p>
                    </div>
                  </div>

                  {!info ? (
                    <div className="h-14 rounded-lg bg-white/10 motion-safe:animate-pulse" aria-hidden />
                  ) : info === 'error' ? (
                    <span className="text-[10px] italic opacity-60 text-white">Sin datos de disponibilidad.</span>
                  ) : (
                    <div className="overflow-x-auto pb-0.5 [scrollbar-width:thin]">
                      <div
                        className="grid gap-x-[3px] gap-y-1.5 items-center"
                        style={{
                          gridTemplateColumns: `28px repeat(${info.bloques.length}, minmax(40px, 1fr))`,
                          minWidth: `${28 + info.bloques.length * 40}px`,
                        }}
                      >
                        <span className="sticky left-0 z-10 bg-[#0a2f5c]/80 rounded text-[10px] font-black text-white/70">Hora</span>
                        {info.bloques.map((b) => (
                          <span key={`h-${b.horaInicio}`} className="text-center text-[10px] font-bold text-white/60">
                            {b.horaInicio.split(':')[0]}
                          </span>
                        ))}
                        <span aria-hidden className="sticky left-0" />
                        {info.bloques.map((b) => {
                            const key = `${fechaActiva}-${c.id}-${b.horaInicio}`;
                            if (!b.disponible) {
                              return (
                                <button
                                  key={key}
                                  type="button"
                                  aria-disabled="true"
                                  disabled={locked}
                                  title={`${b.horaInicio}–${b.horaFin}: No disponible`}
                                  onClick={locked ? undefined : () => tocarNoDisponible(key)}
                                  className={`aspect-square rounded-[9px] border-0 p-0 transition-colors duration-300 ${
                                    flashKey === key ? 'bg-gray-400' : 'bg-[#ff765f]'
                                  } ${locked ? 'opacity-30 cursor-not-allowed' : ''}`}
                                />
                              );
                            }
                            const esElegido = diaActivoConfirmado && selectedSlot?.canchaId === c.id && selectedSlot.horaInicio === b.horaInicio;
                            return (
                              <button
                                key={key}
                                type="button"
                                aria-pressed={esElegido}
                                disabled={locked}
                                title={`${b.horaInicio}–${b.horaFin}: Disponible`}
                                onClick={
                                  locked
                                    ? undefined
                                    : () =>
                                        onSelectSlot({
                                          fecha: fechaActiva,
                                          canchaId: c.id,
                                          canchaNombre: c.nombre,
                                          horaInicio: b.horaInicio,
                                          horaFin: b.horaFin,
                                        })
                                }
                                className={`relative aspect-square rounded-[9px] border-0 p-0 transition-all ${
                                  locked && !esElegido ? 'opacity-30 cursor-not-allowed' : 'hover:brightness-110 hover:-translate-y-0.5'
                                } ${esElegido ? 'z-10 scale-110 bg-[#b6f15c] shadow-[inset_0_0_0_3px_rgba(182,241,92,.4)]' : 'bg-[#24d6d1]'}`}
                              >
                                {esElegido && (
                                  <span className="absolute inset-0 grid place-items-center">
                                    <CheckIcon />
                                  </span>
                                )}
                              </button>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[#b5d2eb]">
          <span className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 rounded-[5px] bg-[#24d6d1]" /> Disponible
          </span>
          <span className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 rounded-[5px] bg-[#ff765f]" /> No disponible
          </span>
          <span className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 rounded-[5px] bg-[#b6f15c]" /> Seleccionado
          </span>
          <span className="flex items-center gap-1.5 sm:ml-auto sm:pl-4 sm:border-l sm:border-white/10">
            <ClockIcon className="w-3.5 h-3.5" /> Lun–Sáb · 2:00 p.m.–10:00 p.m.
          </span>
        </div>

        <div className="mt-3.5 pt-3 border-t border-[#3fb4ff]/20 text-xs text-[#b4d0e9]">
          Selección: <strong className="text-white">{textoSeleccion}</strong>
        </div>
      </div>
    </div>
  );
}
