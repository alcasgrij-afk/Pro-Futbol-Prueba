'use client';

import { useEffect, useState } from 'react';
import { hoyISODias } from '../lib/fechas';

type Cancha = { id: string; nombre: string };
type InfoDia = { libres: number; total: number } | 'error' | undefined;
// disponibilidad[fechaISO][canchaId]
type Mapa = Record<string, Record<string, InfoDia>>;

const DIAS_VISIBLES = 7;

function corto(nombre: string): string {
  const m = nombre.match(/Futbol\s*(\d+)/i);
  return m ? `F${m[1]}` : nombre.slice(0, 2).toUpperCase();
}

/**
 * Selector semanal de fecha: 7 dias desde hoy, con un punto verde/rojo por
 * cancha indicando si queda algun horario libre ese dia. Reemplaza el
 * <input type="date"> nativo para que el usuario vea disponibilidad real
 * antes de elegir, en vez de adivinar y chocar con un dia sin cupo en el chat.
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

  const dias = Array.from({ length: DIAS_VISIBLES }, (_, i) => hoyISODias(i));

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const res = await fetch('/api/canchas', { cache: 'no-store' });
        const lista: Cancha[] = await res.json();
        if (cancelado) return;
        setCanchas(lista);

        const resultados = await Promise.allSettled(
          lista.flatMap((c) =>
            dias.map(async (fecha) => {
              const r = await fetch(`/api/canchas/${c.id}/disponibilidad?fecha=${fecha}`, { cache: 'no-store' });
              if (!r.ok) throw new Error('no ok');
              const data: { bloques: { disponible: boolean }[] } = await r.json();
              const libres = data.bloques.filter((b) => b.disponible).length;
              return { canchaId: c.id, fecha, libres, total: data.bloques.length };
            }),
          ),
        );

        if (cancelado) return;
        const nuevo: Mapa = {};
        for (const r of resultados) {
          if (r.status === 'fulfilled') {
            const { canchaId, fecha, libres, total } = r.value;
            nuevo[fecha] = { ...nuevo[fecha], [canchaId]: { libres, total } };
          }
        }
        // Marcar como error las combinaciones que fallaron (no se pudo consultar).
        let idx = 0;
        for (const c of lista) {
          for (const fecha of dias) {
            if (resultados[idx].status === 'rejected') {
              nuevo[fecha] = { ...nuevo[fecha], [c.id]: 'error' };
            }
            idx++;
          }
        }
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
      {!confirmed && (
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
          Cupos de los próximos 7 días · F5 y F7
        </p>

        <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
          {dias.map((fechaISO) => {
            const d = new Date(fechaISO + 'T00:00:00');
            const esHoy = fechaISO === hoyISODias(0);
            const seleccionado = confirmed && value === fechaISO;
            return (
              <button
                key={fechaISO}
                type="button"
                onClick={() => onSelect(fechaISO)}
                aria-pressed={seleccionado}
                className={`min-h-11 flex flex-col items-center gap-1 rounded-2xl border px-1.5 py-2.5 transition-all ${
                  seleccionado
                    ? 'bg-[#d8b32d] border-[#d8b32d] text-[#07345d] shadow-[0_6px_16px_rgba(216,179,45,.35)]'
                    : 'bg-white/8 border-white/20 text-white hover:bg-white/15 hover:border-white/35'
                }`}
              >
                <span className={`text-[9px] font-bold uppercase tracking-wide ${seleccionado ? 'opacity-70' : 'text-[#cde8ff]'}`}>
                  {d.toLocaleDateString('es-GT', { weekday: 'short' })}
                </span>
                <span className="text-lg font-black leading-none">{d.getDate()}</span>
                {esHoy && !seleccionado && <span className="text-[8px] font-bold text-[#d8b32d]">Hoy</span>}

                <div className="mt-1 flex items-center gap-1.5">
                  {(canchas ?? []).map((c) => {
                    const info = mapa[fechaISO]?.[c.id];
                    const cargando = canchas === null || info === undefined;
                    const libre = info && info !== 'error' ? info.libres > 0 : null;
                    return (
                      <span key={c.id} className="flex flex-col items-center gap-0.5" title={`${corto(c.nombre)}: ${
                        cargando ? 'cargando…' : info === 'error' ? 'sin datos' : libre ? `${(info as { libres: number }).libres} horarios libres` : 'sin cupo'
                      }`}>
                        <span
                          className={`w-2 h-2 rounded-full ${
                            cargando
                              ? `${seleccionado ? 'bg-[#07345d]/30' : 'bg-white/30'} motion-safe:animate-pulse`
                              : info === 'error'
                                ? 'bg-gray-400'
                                : libre
                                  ? 'bg-emerald-500'
                                  : 'bg-red-500'
                          }`}
                        />
                        <span className={`text-[7px] font-bold ${seleccionado ? 'opacity-60' : 'opacity-50'}`}>{corto(c.nombre)}</span>
                      </span>
                    );
                  })}
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex items-center justify-center gap-4 text-[10px] text-[#cde8ff]">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" /> Disponible
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500" /> Sin cupo
          </span>
        </div>
      </div>
    </div>
  );
}
