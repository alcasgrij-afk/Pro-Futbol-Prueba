'use client';

import { Fragment, useEffect, useState } from 'react';
import { hoyISODias } from '../lib/fechas';

type Cancha = { id: string; nombre: string };
type Bloque = { horaInicio: string; horaFin: string; disponible: boolean };
type InfoDia = { bloques: Bloque[] } | 'error' | undefined;
// mapa[fechaISO][canchaId]
type Mapa = Record<string, Record<string, InfoDia>>;

const DIAS_VISIBLES = 3;
// El glow llamativo solo corre una vez al montar, no queda parpadeando
// mientras el usuario decide (era demasiado insistente).
const GLOW_DURACION_MS = 2600;

function corto(nombre: string): string {
  const m = nombre.match(/Futbol\s*(\d+)/i);
  return m ? `F${m[1]}` : nombre.slice(0, 2).toUpperCase();
}

/**
 * Selector de fecha: 3 dias desde hoy, con el detalle hora por hora (no solo
 * un resumen del dia) de F5 y F7. Reemplaza el <input type="date"> nativo
 * para que el usuario vea disponibilidad real antes de elegir, en vez de
 * adivinar y chocar con un horario ocupado recien en el chat.
 */
export default function WeekDatePicker({
  value,
  confirmed,
  onSelect,
}: {
  value: string;
  confirmed: boolean;
  onSelect: (fechaISO: string) => void;
}) {
  const [canchas, setCanchas] = useState<Cancha[] | null>(null);
  const [mapa, setMapa] = useState<Mapa>({});
  const [glowActivo, setGlowActivo] = useState(true);

  const dias = Array.from({ length: DIAS_VISIBLES }, (_, i) => hoyISODias(i));

  useEffect(() => {
    const t = setTimeout(() => setGlowActivo(false), GLOW_DURACION_MS);
    return () => clearTimeout(t);
  }, []);

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

  return (
    <div className="relative mx-auto mt-6 w-full max-w-[760px]">
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
        <p className="text-[#cde8ff] text-[11px] sm:text-xs mb-4">
          Horarios por hora de los próximos 3 días · F5 y F7
        </p>

        <div className="flex flex-col gap-2.5">
          {dias.map((fechaISO) => {
            const d = new Date(fechaISO + 'T00:00:00');
            const esHoy = fechaISO === hoyISODias(0);
            const seleccionado = confirmed && value === fechaISO;
            const cargando = canchas === null;
            // Regla de horas: usamos el primer set de bloques que aparezca (misma grilla para F5/F7).
            const bloquesRef = (canchas ?? [])
              .map((c) => mapa[fechaISO]?.[c.id])
              .find((info): info is { bloques: Bloque[] } => !!info && info !== 'error');
            const nCols = bloquesRef?.bloques.length ?? 0;

            return (
              <button
                key={fechaISO}
                type="button"
                onClick={() => onSelect(fechaISO)}
                aria-pressed={seleccionado}
                className={`text-left rounded-2xl border px-3 py-3 transition-all ${
                  seleccionado
                    ? 'bg-[#d8b32d] border-[#d8b32d] text-[#07345d] shadow-[0_6px_16px_rgba(216,179,45,.35)]'
                    : 'bg-white/8 border-white/20 text-white hover:bg-white/15 hover:border-white/35'
                }`}
              >
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-sm font-black capitalize">
                    {d.toLocaleDateString('es-GT', { weekday: 'long', day: 'numeric', month: 'short' })}
                  </span>
                  {esHoy && (
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${seleccionado ? 'bg-[#07345d]/15' : 'bg-[#d8b32d] text-[#07345d]'}`}>
                      Hoy
                    </span>
                  )}
                </div>

                {cargando ? (
                  <div className="h-16 rounded-lg bg-white/10 motion-safe:animate-pulse" aria-hidden />
                ) : bloquesRef ? (
                  <div
                    className="grid gap-x-[3px] gap-y-1.5 items-center"
                    style={{ gridTemplateColumns: `28px repeat(${nCols}, 1fr)` }}
                  >
                    {/* Regla de horas: una sola fila, alineada con las columnas de F5/F7 abajo */}
                    <span />
                    {bloquesRef.bloques.map((b) => (
                      <span
                        key={`h-${b.horaInicio}`}
                        className={`text-center text-[8px] font-bold ${seleccionado ? 'opacity-60' : 'opacity-50'}`}
                      >
                        {b.horaInicio.split(':')[0]}
                      </span>
                    ))}

                    {(canchas ?? []).map((c) => {
                      const info = mapa[fechaISO]?.[c.id];
                      return (
                        <Fragment key={c.id}>
                          <span className={`text-[10px] font-black ${seleccionado ? 'opacity-70' : 'opacity-60'}`}>
                            {corto(c.nombre)}
                          </span>
                          {info === 'error' || !info
                            ? Array.from({ length: nCols }, (_, i) => <span key={`e-${c.id}-${i}`} />)
                            : info.bloques.map((b) => (
                                <span
                                  key={`${c.id}-${b.horaInicio}`}
                                  title={`${b.horaInicio}–${b.horaFin}: ${b.disponible ? 'Disponible' : 'No disponible'}`}
                                  className={`aspect-square rounded-[4px] ${b.disponible ? 'bg-emerald-500' : 'bg-red'}`}
                                />
                              ))}
                        </Fragment>
                      );
                    })}
                  </div>
                ) : (
                  <span className="text-[10px] italic opacity-60">Sin datos de disponibilidad.</span>
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex items-center justify-center gap-4 text-[10px] text-[#cde8ff]">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" /> Disponible
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red" /> No disponible
          </span>
        </div>
      </div>
    </div>
  );
}
