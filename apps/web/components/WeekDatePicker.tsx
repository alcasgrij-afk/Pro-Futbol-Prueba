'use client';

import { Fragment, useEffect, useState } from 'react';
import { hoyISODias } from '../lib/fechas';

type Cancha = { id: string; nombre: string };
type Bloque = { horaInicio: string; horaFin: string; disponible: boolean };
type InfoDia = { bloques: Bloque[] } | 'error' | undefined;
// mapa[fechaISO][canchaId]
type Mapa = Record<string, Record<string, InfoDia>>;
export type SlotElegido = { fecha: string; canchaId: string; canchaNombre: string; horaInicio: string; horaFin: string };

const DIAS_VISIBLES = 3;
// El glow llamativo solo corre una vez al montar, no queda parpadeando
// mientras el usuario decide (era demasiado insistente).
const GLOW_DURACION_MS = 2600;
// Cuanto dura el "flash" gris al tocar un horario no disponible.
const FLASH_DURACION_MS = 350;
// Cuanto queda visible el aviso "Horario No Disponible".
const AVISO_DURACION_MS = 2000;

function corto(nombre: string): string {
  const m = nombre.match(/Futbol\s*(\d+)/i);
  return m ? `F${m[1]}` : nombre.slice(0, 2).toUpperCase();
}

/**
 * Selector de fecha y horario: 3 dias desde hoy, hora por hora, para F5 y F7.
 * Cada casilla disponible es un boton que selecciona esa cancha+hora+fecha de
 * una sola vez (reemplaza tener que volver a elegir horario en el chat). Las
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
  // Una vez elegido un horario, el resto de las casillas se deshabilita
  // (visualmente y al click) para que el usuario se enfoque en esa unica
  // opcion; se desbloquea desde afuera con el boton "Cambiar horario".
  locked?: boolean;
}) {
  const [canchas, setCanchas] = useState<Cancha[] | null>(null);
  const [mapa, setMapa] = useState<Mapa>({});
  const [glowActivo, setGlowActivo] = useState(true);
  const [flashKey, setFlashKey] = useState<string | null>(null);
  const [aviso, setAviso] = useState(false);

  const dias = Array.from({ length: DIAS_VISIBLES }, (_, i) => hoyISODias(i));

  useEffect(() => {
    const t = setTimeout(() => setGlowActivo(false), GLOW_DURACION_MS);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(false), AVISO_DURACION_MS);
    return () => clearTimeout(t);
  }, [aviso]);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const res = await fetch('/api/canchas', { cache: 'no-store' });
        const lista: Cancha[] = await res.json();
        if (cancelado) return;
        setCanchas(lista);

        const combinaciones = lista.flatMap((c) => dias.map((fecha) => ({ c, fecha })));
        const resultados = await Promise.allSettled(
          combinaciones.map(async ({ c, fecha }) => {
            const r = await fetch(`/api/canchas/${c.id}/disponibilidad?fecha=${fecha}`, { cache: 'no-store' });
            if (!r.ok) throw new Error('no ok');
            const data: { bloques: Bloque[] } = await r.json();
            return { canchaId: c.id, fecha, bloques: data.bloques };
          }),
        );

        if (cancelado) return;
        const nuevo: Mapa = {};
        resultados.forEach((r, i) => {
          const { c, fecha } = combinaciones[i];
          nuevo[fecha] = {
            ...nuevo[fecha],
            [c.id]: r.status === 'fulfilled' ? { bloques: r.value.bloques } : 'error',
          };
        });
        setMapa(nuevo);
      } catch {
        if (!cancelado) setCanchas([]);
      }
    })();
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function tocarNoDisponible(key: string) {
    setFlashKey(key);
    setAviso(true);
    setTimeout(() => setFlashKey((k) => (k === key ? null : k)), FLASH_DURACION_MS);
  }

  return (
    <div className="relative mx-auto mt-6 w-full max-w-[760px]">
      {aviso && (
        <div
          role="status"
          aria-live="assertive"
          className="pointer-events-none absolute left-1/2 top-1 z-40 -translate-x-1/2 whitespace-nowrap rounded-full bg-red text-white text-xs font-black px-4 py-2 shadow-[0_10px_24px_rgba(0,0,0,.35)]"
        >
          Horario No Disponible
        </div>
      )}
      {!confirmed && glowActivo && (
        <div
          aria-hidden
          className="absolute -inset-1.5 rounded-[28px] bg-[#d8b32d]/45 blur-xl motion-safe:animate-pulse"
        />
      )}
      <div
        className={`relative rounded-3xl border-2 bg-white/10 backdrop-blur-sm px-4 py-5 sm:px-6 transition-colors ${
          confirmed ? 'border-white/25' : 'border-[#d8b32d] shadow-[0_20px_45px_rgba(0,0,0,0.28)]'
        }`}
      >
        <div className="flex items-center justify-center gap-2 mb-1">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d8b32d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M16 2v4M8 2v4M3 10h18" />
          </svg>
          <h2 className="text-white font-black text-base sm:text-lg">Elegí tu fecha</h2>
        </div>
        <p className="text-[#cde8ff] text-[11px] sm:text-xs mb-0.5">
          Horarios por hora de los próximos 3 días · F5 y F7
        </p>
        <p className="text-[#9fc9ee] text-[10px] mb-4">Tocá un horario disponible para elegirlo.</p>

        <div className="flex flex-col gap-2.5">
          {dias.map((fechaISO) => {
            const d = new Date(fechaISO + 'T00:00:00');
            const esHoy = fechaISO === hoyISODias(0);
            const cargando = canchas === null;
            const diaActivo = confirmed && !!selectedSlot && value === fechaISO;
            // Regla de horas: usamos el primer set de bloques que aparezca (misma grilla para F5/F7).
            const bloquesRef = (canchas ?? [])
              .map((c) => mapa[fechaISO]?.[c.id])
              .find((info): info is { bloques: Bloque[] } => !!info && info !== 'error');
            const nCols = bloquesRef?.bloques.length ?? 0;

            return (
              <div
                key={fechaISO}
                className={`rounded-2xl border px-3 py-3 transition-colors ${
                  diaActivo ? 'bg-white/14 border-[#d8b32d]' : 'bg-white/8 border-white/20'
                }`}
              >
                <div className="flex items-baseline gap-2 mb-2.5">
                  <span className="text-sm font-black capitalize text-white">
                    {d.toLocaleDateString('es-GT', { weekday: 'long', day: 'numeric', month: 'short' })}
                  </span>
                  {esHoy && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#d8b32d] text-[#07345d]">
                      Hoy
                    </span>
                  )}
                </div>

                {cargando ? (
                  <div className="h-16 rounded-lg bg-white/10 motion-safe:animate-pulse" aria-hidden />
                ) : bloquesRef ? (
                  <div className="overflow-x-auto pb-0.5 [scrollbar-width:thin]">
                    <div
                      className="grid gap-x-[3px] gap-y-2 items-center"
                      style={{
                        gridTemplateColumns: `28px repeat(${nCols}, minmax(40px, 1fr))`,
                        minWidth: `${28 + nCols * 40}px`,
                      }}
                    >
                      {/* Regla de horas: una sola fila, alineada con las columnas de F5/F7 abajo.
                          Primera columna (Hora / F5 / F7) fija: en movil la grilla scrollea
                          horizontalmente para que cada casilla de hora sea tocable (min 40px). */}
                      <span className="sticky left-0 z-10 bg-[#0a2f5c]/80 rounded text-[10px] font-black text-white/70">Hora</span>
                      {bloquesRef.bloques.map((b) => (
                        <span key={`h-${b.horaInicio}`} className="text-center text-[10px] font-bold text-white/60">
                          {b.horaInicio.split(':')[0]}
                        </span>
                      ))}

                      {(canchas ?? []).map((c) => {
                        const info = mapa[fechaISO]?.[c.id];
                        return (
                          <Fragment key={c.id}>
                            <span className="sticky left-0 z-10 bg-[#0a2f5c]/80 rounded text-[10px] font-black text-white/70">
                              {corto(c.nombre)}
                            </span>
                          {info === 'error' || !info
                            ? Array.from({ length: nCols }, (_, i) => <span key={`e-${c.id}-${i}`} />)
                            : info.bloques.map((b) => {
                                const key = `${fechaISO}-${c.id}-${b.horaInicio}`;
                                if (!b.disponible) {
                                  return (
                                    <button
                                      key={key}
                                      type="button"
                                      aria-disabled="true"
                                      disabled={locked}
                                      title={`${b.horaInicio}–${b.horaFin}: No disponible`}
                                      onClick={locked ? undefined : () => tocarNoDisponible(key)}
                                      className={`aspect-square rounded-[5px] border-0 p-0 transition-colors duration-300 ${
                                        flashKey === key ? 'bg-gray-400' : 'bg-red'
                                      } ${locked ? 'opacity-30 cursor-not-allowed' : ''}`}
                                    />
                                  );
                                }
                                const esElegido =
                                  diaActivo && selectedSlot?.canchaId === c.id && selectedSlot.horaInicio === b.horaInicio;
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
                                              fecha: fechaISO,
                                              canchaId: c.id,
                                              canchaNombre: c.nombre,
                                              horaInicio: b.horaInicio,
                                              horaFin: b.horaFin,
                                            })
                                    }
                                    className={`aspect-square rounded-[5px] border-0 p-0 transition-all ${
                                      locked && !esElegido ? 'opacity-30 cursor-not-allowed' : 'hover:brightness-110'
                                    } ${
                                      esElegido ? 'relative z-10 scale-110 bg-[#d8b32d] shadow-[0_0_0_2px_#ffffff]' : 'bg-emerald-500'
                                    }`}
                                  />
                                );
                              })}
                          </Fragment>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <span className="text-[10px] italic opacity-60">Sin datos de disponibilidad.</span>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex items-center justify-center gap-5 text-xs text-[#cde8ff]">
          <span className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 rounded-full bg-emerald-500" /> Disponible
          </span>
          <span className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 rounded-full bg-red" /> No disponible
          </span>
        </div>
      </div>
    </div>
  );
}
