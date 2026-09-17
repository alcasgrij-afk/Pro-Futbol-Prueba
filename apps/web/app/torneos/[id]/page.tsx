'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { FormatoTorneo, EquipoDTO, PartidoDTO, PosicionDTO, TorneoDTO } from '@profutbol/shared-types';
import { ApiError, api } from '../../../lib/api-client';

export default function TorneoDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [torneo, setTorneo] = useState<TorneoDTO | null>(null);
  const [equipos, setEquipos] = useState<EquipoDTO[]>([]);
  const [partidos, setPartidos] = useState<PartidoDTO[]>([]);
  const [tabla, setTabla] = useState<PosicionDTO[]>([]);
  const [error, setError] = useState('');
  const [nombre, setNombre] = useState('');
  const [capitanNombre, setCapitanNombre] = useState('');
  const [capitanTelefono, setCapitanTelefono] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api
      .obtenerTorneo(id)
      .then((t) => {
        setTorneo(t);
        setEquipos(t.equipos);
        setPartidos(t.partidos);
        setTabla(t.tabla);
      })
      .catch((e) => setError(e.message));
  }, [id]);

  async function inscribir(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) return;
    try {
      const res = await api.inscribirEquipo(id, {
        nombre: nombre.trim(),
        capitanNombre: capitanNombre || undefined,
        capitanTelefono: capitanTelefono || undefined,
      });
      setMsg(res.redirectUrl ? 'Inscrito. Redirigiendo a pagar...' : 'Inscrito (cuota Q0).');
      if (res.redirectUrl) {
        window.location.href = res.redirectUrl;
        return;
      }
      const lista = await api.listarEquiposDeTorneo(id);
      setEquipos(lista);
      setNombre('');
      setCapitanNombre('');
      setCapitanTelefono('');
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : (err as Error).message);
    }
  }

  const agrupados = [...partidos].reduce(
    (acc, p) => {
      const k = `Jornada ${p.jornada === 0 ? (p.ronda ? `Ronda ${p.ronda}` : 'Ronda 1') : p.jornada}`;
      (acc[k] ??= []).push(p);
      return acc;
    },
    {} as Record<string, PartidoDTO[]>,
  );

  if (error) return <div className="min-h-screen bg-navy text-white p-8">{error}</div>;
  if (!torneo) return <div className="min-h-screen bg-navy text-white p-8">Cargando...</div>;

  return (
    <div className="min-h-screen bg-navy text-white">
      <header className="bg-navy border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <Link href="/torneos" className="text-sm underline underline-offset-2">Volver a torneos</Link>
        <span className="font-bold text-sm">Pro Futbol Antigua</span>
      </header>
      <main className="p-6 max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold">{torneo.nombre}</h1>
          {torneo.descripcion && <p className="text-white/70 mt-1">{torneo.descripcion}</p>}
          <p className="text-sm text-white/60 mt-1">Equipos {equipos.length}/{torneo.maxEquipos} · Cuota Q{torneo.cuotaInscripcionQ}</p>
        </div>

        <section>
          <h2 className="font-semibold mb-3">Equipos inscritos</h2>
          {equipos.length === 0 ? (
            <p className="text-white/60 text-sm">Aún no hay equipos inscritos.</p>
          ) : (
            <ul className="space-y-2">
              {equipos.map((e) => (
                <li key={e.id} className="bg-white/5 border border-white/10 rounded p-3 text-sm flex items-center justify-between">
                  <span>{e.nombre}</span>
                  {e.cuotaPagada && <span className="text-xs px-2 py-1 rounded bg-green-500/20 text-green-300">Cuota pagada</span>}
                </li>
              ))}
            </ul>
          )}
        </section>

        {torneo.estado === 'INSCRIPCIONES_ABIERTAS' && (
        <section className="bg-white/5 border border-white/10 rounded p-4">
          <h2 className="font-semibold mb-3">Inscribir mi equipo</h2>
          <form onSubmit={inscribir} className="space-y-3 max-w-md">
            <label className="space-y-1 block">
              <span className="text-sm text-white/80">Nombre del equipo *</span>
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} required className="w-full rounded bg-white border border-white/20 px-3 py-2 text-sm text-navy" />
            </label>
            <label className="space-y-1 block">
              <span className="text-sm text-white/80">Capitán (opcional)</span>
              <input value={capitanNombre} onChange={(e) => setCapitanNombre(e.target.value)} className="w-full rounded bg-white border border-white/20 px-3 py-2 text-sm text-navy" />
            </label>
            <label className="space-y-1 block">
              <span className="text-sm text-white/80">Teléfono (opcional)</span>
              <input value={capitanTelefono} onChange={(e) => setCapitanTelefono(e.target.value)} className="w-full rounded bg-white border border-white/20 px-3 py-2 text-sm text-navy" />
            </label>
            <button type="submit" className="px-4 py-2 bg-yellow-400 text-navy rounded text-sm font-semibold">Inscribir equipo</button>
            {msg && <p className="text-sm text-white/80">{msg}</p>}
          </form>
        </section>
        )}

        {partidos.length > 0 && (
          <section>
            <h2 className="font-semibold mb-3">Fixture</h2>
            {Object.entries(agrupados).map(([jornada, lista]) => (
              <div key={jornada} className="mb-4">
                <h3 className="text-sm text-white/70 mb-2">{jornada}</h3>
                <div className="space-y-1">
                  {lista.map((p) => (
                    <div key={p.id} className="bg-white/5 border border-white/10 rounded px-3 py-2 text-sm flex items-center justify-between">
                      <span>{p.localNombre ?? '—'} vs {p.visitanteNombre ?? '—'}</span>
                      <span>{p.jugado ? `${p.golesLocal} - ${p.golesVisitante}` : 'Por jugar'}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </section>
        )}

        {tabla.length > 0 && torneo.formato === FormatoTorneo.LIGA && (
          <section>
            <h2 className="font-semibold mb-3">Tabla de posiciones</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-white/60 text-left">
                    <th className="py-1">#</th>
                    <th>Equipo</th>
                    <th>J</th><th>G</th><th>E</th><th>P</th><th>GF</th><th>GC</th><th>Dif</th><th>Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {tabla.map((r, i) => (
                    <tr key={r.equipoId} className="border-t border-white/10">
                      <td className="py-1">{i + 1}</td>
                      <td>{r.nombre}</td>
                      <td>{r.jugados}</td><td>{r.ganados}</td><td>{r.empatados}</td><td>{r.perdidos}</td><td>{r.gf}</td><td>{r.gc}</td><td>{r.dif}</td><td className="font-bold">{r.puntos}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
