'use client';

import { useEffect, useState, use } from 'react';
import { FormatoTorneo, EstadoTorneo, EquipoDTO, PartidoDTO, PosicionDTO } from '@profutbol/shared-types';
import { Trophy, WarningCircle } from '@phosphor-icons/react';
import { ApiError, api, BracketResultado } from '../../../../lib/api-client';

export default function AdminTorneoDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [torneo, setTorneo] = useState<any>(null);
  const [equipos, setEquipos] = useState<EquipoDTO[]>([]);
  const [partidos, setPartidos] = useState<PartidoDTO[]>([]);
  const [tabla, setTabla] = useState<PosicionDTO[]>([]);
  const [error, setError] = useState('');
  const [resultados, setResultados] = useState<Record<string, { golesLocal: string; golesVisitante: string }>>({});
  const [penales, setPenales] = useState<Record<string, string>>({});
  const [pendientePenales, setPendientePenales] = useState<string | null>(null);
  const [campeon, setCampeon] = useState<string | null>(null);

  /** Campeon derivado de los partidos: el unico partido jugado de la ronda mas alta. */
  function campeonDe(lista: PartidoDTO[], formato?: string): string | null {
    if (formato !== FormatoTorneo.ELIMINACION_DIRECTA || lista.length === 0) return null;
    const maxRonda = Math.max(...lista.map((p) => p.ronda ?? 0));
    const final = lista.find((p) => p.ronda === maxRonda) ?? null;
    if (!final || !final.jugado) return null;
    if (final.golesLocal! > final.golesVisitante!) return final.localNombre ?? null;
    if (final.golesVisitante! > final.golesLocal!) return final.visitanteNombre ?? null;
    return final.penalesGanadorNombre ?? null;
  }

  /** Refresca partidos/tabla/campeon de un solo tirón. */
  async function refrescar() {
    const t = await api.obtenerTorneo(id);
    setPartidos(t.partidos);
    setTabla(t.tabla);
    setCampeon(campeonDe(t.partidos, t.formato));
  }

  /** Apunta al partido que el backend dice que necesita penales (scroll + resaltado). */
  function apuntarPenales(bracket: BracketResultado) {
    if (bracket.tipo !== 'penalesPendientes' || !bracket.partidoId) return;
    setPendientePenales(bracket.partidoId);
    requestAnimationFrame(() => document.getElementById(bracket.partidoId!)?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' }));
  }

  useEffect(() => {
    api
      .obtenerTorneo(id)
      .then(async (t) => {
        setTorneo(t);
        const [eq, pa, ta] = await Promise.all([
          api.listarEquiposDeTorneo(id),
          api.obtenerTorneo(id).then((tt) => tt.partidos),
          api.obtenerTorneo(id).then((tt) => tt.tabla),
        ]);
        setEquipos(eq);
        setPartidos(pa);
        setTabla(ta);
        setCampeon(campeonDe(pa, t.formato));
      })
      .catch((e) => setError(e.message));
  }, [id]);

  async function generarFixture() {
    try {
      await api.generarFixture(id);
      await refrescar();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : (e as Error).message);
    }
  }

  async function capturarResultado(partidoId: string) {
    const r = resultados[partidoId];
    if (!r) return;
    const esElim = torneo.formato === FormatoTorneo.ELIMINACION_DIRECTA;
    const bajo = { golesLocal: parseInt(r.golesLocal), golesVisitante: parseInt(r.golesVisitante) };
    // Empate en eliminacion directa -> enviamos tambien el ganador por penales elegido
    // (si el admin no eligio, el backend responde penalesPendientes y apuntamos al partido).
    const penalesGanadorId = esElim && bajo.golesLocal === bajo.golesVisitante ? (penales[partidoId] || undefined) : undefined;
    try {
      const res = await api.capturarResultado(id, { partidoId, ...bajo, penalesGanadorId });
      await refrescar();
      setResultados({});
      apuntarPenales(res.bracket);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : (e as Error).message);
    }
  }

  /** Guarda solo el ganador por penales de un partido ya jugado (empate definido en la ronda). */
  async function guardarPenales(partidoId: string) {
    if (!penales[partidoId]) return;
    try {
      const res = await api.capturarResultado(id, { partidoId, penalesGanadorId: penales[partidoId] });
      await refrescar();
      setPendientePenales(null);
      apuntarPenales(res.bracket);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : (e as Error).message);
    }
  }

  async function cambiarEstado(estado: EstadoTorneo) {
    try {
      const t = await api.cambiarEstadoTorneo(id, estado);
      setTorneo(t);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : (e as Error).message);
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

  if (error) return <div className="p-8 text-red-600">{error}</div>;
  if (!torneo) return <div className="p-8 text-gray-500">Cargando...</div>;

  const esElim = torneo.formato === FormatoTorneo.ELIMINACION_DIRECTA;

  // Selector de "ganador por penales": aparece cuando hay empate (jugado o en la entrada).
  const selectPenales = (p: PartidoDTO) => (
    <select
      value={penales[p.id] ?? ''}
      onChange={(e) => setPenales({ ...penales, [p.id]: e.target.value })}
      className="rounded-md border border-gray-300 px-2 py-1 text-xs"
    >
      <option value="">Penales →</option>
      {p.localId && <option value={p.localId}>{p.localNombre}</option>}
      {p.visitanteId && <option value={p.visitanteId}>{p.visitanteNombre}</option>}
    </select>
  );

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{torneo.nombre}</h1>
          <p className="text-gray-500">{torneo.formato === FormatoTorneo.LIGA ? 'Todos contra todos' : 'Eliminación directa'} · {equipos.length}/{torneo.maxEquipos} equipos · Cuota Q{torneo.cuotaInscripcionQ}</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={torneo.estado}
            onChange={(e) => cambiarEstado(e.target.value as EstadoTorneo)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value={EstadoTorneo.PROXIMO}>Próximo</option>
            <option value={EstadoTorneo.INSCRIPCIONES_ABIERTAS}>Inscripciones abiertas</option>
            <option value={EstadoTorneo.EN_CURSO}>En curso</option>
            <option value={EstadoTorneo.FINALIZADO}>Finalizado</option>
            <option value={EstadoTorneo.CANCELADO}>Cancelado</option>
          </select>
        </div>
      </div>

      {campeon && (
        <div className="bg-yellow-400 text-navy rounded-lg p-3 font-semibold flex items-center gap-2">
          <Trophy size={18} weight="fill" className="shrink-0" aria-hidden />
          Campeón: {campeon}
        </div>
      )}
      {pendientePenales && esElim && (
        <div className="bg-amber-50 border border-amber-300 text-amber-800 rounded-lg p-3 text-sm flex items-center gap-2">
          <WarningCircle size={18} weight="fill" className="shrink-0" aria-hidden />
          Partido empatado: definí el ganador por penales para avanzar el bracket.
        </div>
      )}

      <section className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
        <h2 className="font-semibold mb-4">Equipos inscritos</h2>
        {equipos.length === 0 ? (
          <p className="text-gray-500 text-sm">Aún no hay equipos inscritos.</p>
        ) : (
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-left">
                <th className="py-2">Equipo</th>
                <th>Capitán</th>
                <th>Teléfono</th>
                <th className="text-center">Cuota</th>
              </tr>
            </thead>
            <tbody>
              {equipos.map((e) => (
                <tr key={e.id} className="border-t border-gray-100">
                  <td className="py-2">{e.nombre}</td>
                  <td className="py-2">{e.capitanNombre ?? '—'}</td>
                  <td className="py-2">{e.capitanTelefono ?? '—'}</td>
                  <td className="py-2 text-center">
                    {e.cuotaPagada ? (
                      <span className="px-2 py-1 rounded text-xs bg-green-100 text-green-800">Pagada</span>
                    ) : (
                      <span className="px-2 py-1 rounded text-xs bg-yellow-100 text-yellow-800">Pendiente</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </section>

      <section className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Fixture</h2>
          <button onClick={generarFixture} disabled={partidos.length > 0} className="px-3 py-1 text-sm bg-navy text-white rounded-md transition-transform active:scale-[0.98] disabled:opacity-50">
            Generar fixture
          </button>
        </div>
        {partidos.length === 0 ? (
          <p className="text-gray-500 text-sm">Aún no se ha generado el fixture.</p>
        ) : (
          Object.entries(agrupados).map(([jornada, lista]) => (
            <div key={jornada} className="mb-4">
              <h3 className="text-sm font-medium text-gray-600 mb-2">{jornada}</h3>
              <div className="space-y-1">
                {lista.map((p) => {
                  const v = resultados[p.id];
                  const entradaEmpate = esElim && !p.jugado && !!v && v.golesLocal !== '' && v.golesVisitante !== '' && v.golesLocal === v.golesVisitante;
                  const empateJugado = esElim && p.jugado && p.golesLocal === p.golesVisitante;
                  return (
                    <div
                      key={p.id}
                      id={p.id}
                      className={`bg-gray-50 border rounded px-3 py-2 text-sm flex flex-col sm:flex-row sm:items-center gap-2 ${
                        pendientePenales === p.id ? 'border-amber-400 ring-1 ring-amber-400/60' : 'border-gray-200'
                      }`}
                    >
                      <span className="flex-1">{p.localNombre ?? '—'} vs {p.visitanteNombre ?? '—'}</span>
                      <span className="flex-1 text-center">
                        {!p.jugado ? 'Por jugar' : `${p.golesLocal} - ${p.golesVisitante}${empateJugado ? ' (empate)' : ''}`}
                      </span>
                      {empateJugado && (
                        <span className="flex items-center gap-2">
                          {selectPenales(p)}
                          <button
                            onClick={() => guardarPenales(p.id)}
                            disabled={!penales[p.id]}
                            className="px-2 py-1 text-xs rounded transition-transform active:scale-[0.98] disabled:opacity-40 bg-amber-500 text-navy"
                          >
                            Guardar penales
                          </button>
                        </span>
                      )}
                      {!p.jugado && (
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            placeholder="GL"
                            value={resultados[p.id]?.golesLocal ?? ''}
                            onChange={(e) => setResultados({ ...resultados, [p.id]: { ...resultados[p.id], golesLocal: e.target.value } })}
                            className="w-16 rounded-md border border-gray-300 px-2 py-1 text-sm"
                          />
                          <span>-</span>
                          <input
                            type="number"
                            min="0"
                            placeholder="GV"
                            value={resultados[p.id]?.golesVisitante ?? ''}
                            onChange={(e) => setResultados({ ...resultados, [p.id]: { ...resultados[p.id], golesVisitante: e.target.value } })}
                            className="w-16 rounded-md border border-gray-300 px-2 py-1 text-sm"
                          />
                          {entradaEmpate && selectPenales(p)}
                          <button onClick={() => capturarResultado(p.id)} className="px-2 py-1 text-xs bg-navy text-white rounded-md transition-transform active:scale-[0.98]">Guardar</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </section>

      {tabla.length > 0 && torneo.formato === FormatoTorneo.LIGA && (
        <section className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
          <h2 className="font-semibold mb-4">Tabla de posiciones</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-left">
                  <th className="py-1">#</th>
                  <th>Equipo</th>
                  <th>J</th><th>G</th><th>E</th><th>P</th><th>GF</th><th>GC</th><th>Dif</th><th>Pts</th>
                </tr>
              </thead>
              <tbody>
                {tabla.map((r, i) => (
                  <tr key={r.equipoId} className="border-t border-gray-100">
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
    </div>
  );
}