'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FormatoTorneo, EstadoTorneo, TorneoDTO } from '@profutbol/shared-types';
import { ApiError, api } from '../../../lib/api-client';
import { hoyISO, hoyISOAnios } from '../../../lib/fechas';

const ETIQUETA_ESTADO: Record<EstadoTorneo, string> = {
  [EstadoTorneo.PROXIMO]: 'Próximo',
  [EstadoTorneo.INSCRIPCIONES_ABIERTAS]: 'Inscripciones abiertas',
  [EstadoTorneo.EN_CURSO]: 'En curso',
  [EstadoTorneo.FINALIZADO]: 'Finalizado',
  [EstadoTorneo.CANCELADO]: 'Cancelado',
};

export default function AdminTorneosPage() {
  const [torneos, setTorneos] = useState<TorneoDTO[]>([]);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);
  const [creado, setCreado] = useState(false);
  const [form, setForm] = useState({
    nombre: '',
    descripcion: '',
    formato: FormatoTorneo.LIGA,
    categoria: '',
    maxEquipos: 16,
    cuotaInscripcionQ: 0,
    fechaLimiteInscripcion: '',
  });

  useEffect(() => {
    api
      .listarTorneos()
      .then(setTorneos)
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  }, []);

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setCreado(false);
    try {
      await api.crearTorneo(form);
      const lista = await api.listarTorneos();
      setTorneos(lista);
      setCreado(true);
      setForm({
        nombre: '',
        descripcion: '',
        formato: FormatoTorneo.LIGA,
        categoria: '',
        maxEquipos: 16,
        cuotaInscripcionQ: 0,
        fechaLimiteInscripcion: '',
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : (err as Error).message);
    }
  }

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-bold mb-6">Torneos</h1>

        <form onSubmit={crear} className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 space-y-4 max-w-xl mb-8">
          <h2 className="font-semibold">Crear nuevo torneo</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1">
              <span className="block text-sm text-gray-700">Nombre del torneo *</span>
              <input
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                required
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="space-y-1">
              <span className="block text-sm text-gray-700">Formato</span>
              <select
                value={form.formato}
                onChange={(e) => setForm({ ...form, formato: e.target.value as FormatoTorneo })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                <option value={FormatoTorneo.LIGA}>Todos contra todos (Liga)</option>
                <option value={FormatoTorneo.ELIMINACION_DIRECTA}>Eliminación directa</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="block text-sm text-gray-700">Máx. equipos</span>
              <input
                value={form.maxEquipos}
                onChange={(e) => setForm({ ...form, maxEquipos: parseInt(e.target.value) })}
                type="number"
                min="2"
                max="64"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="space-y-1">
              <span className="block text-sm text-gray-700">Cuota inscripción (Q0 = gratis)</span>
              <input
                value={form.cuotaInscripcionQ}
                onChange={(e) => setForm({ ...form, cuotaInscripcionQ: parseFloat(e.target.value) || 0 })}
                type="number"
                min="0"
                step="1"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="space-y-1">
              <span className="block text-sm text-gray-700">Categoría (opcional)</span>
              <input
                value={form.categoria}
                onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="space-y-1">
              <span className="block text-sm text-gray-700">Fecha límite de inscripción</span>
              <input
                value={form.fechaLimiteInscripcion}
                onChange={(e) => setForm({ ...form, fechaLimiteInscripcion: e.target.value })}
                type="date"
                min={hoyISO()}
                max={hoyISOAnios(20)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </label>
          </div>
          <label className="space-y-1 block">
            <span className="text-sm text-gray-700">Descripción (opcional)</span>
            <textarea
              value={form.descripcion}
              onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
              rows={2}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <button type="submit" className="px-4 py-2 bg-navy text-white rounded-md text-sm font-semibold transition-transform active:scale-[0.98]">
            Crear torneo
          </button>
          {creado && <p className="text-green-700 text-sm">Torneo creado correctamente.</p>}
          {error && <p className="text-red-600 text-sm">{error}</p>}
        </form>

        <h2 className="font-semibold mb-3">Lista de torneos</h2>
        {cargando && <p className="text-gray-500">Cargando...</p>}
        {!cargando && torneos.length === 0 && <p className="text-gray-500">Aún no hay torneos.</p>}
        <ul className="space-y-3">
          {torneos.map((t) => (
            <li key={t.id} className="bg-white border border-gray-200 rounded-lg shadow-sm p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <Link href={`/admin/torneos/${t.id}`} className="font-semibold hover:underline">
                  {t.nombre}
                </Link>
                {t.descripcion && <p className="text-sm text-gray-600 mt-1">{t.descripcion}</p>}
                <p className="text-xs text-gray-500">{t.formato === FormatoTorneo.LIGA ? 'Todos contra todos' : 'Eliminación directa'} · {t.equiposInscritos}/{t.maxEquipos} equipos · Cuota Q{t.cuotaInscripcionQ}</p>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  t.estado === EstadoTorneo.INSCRIPCIONES_ABIERTAS ? 'bg-yellow-100 text-yellow-800' :
                  t.estado === EstadoTorneo.EN_CURSO ? 'bg-blue-100 text-blue-800' :
                  t.estado === EstadoTorneo.FINALIZADO ? 'bg-green-100 text-green-800' :
                  t.estado === EstadoTorneo.CANCELADO ? 'bg-red-100 text-red-700' :
                  'bg-gray-100 text-gray-600'
                }`}>
                  {ETIQUETA_ESTADO[t.estado]}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}