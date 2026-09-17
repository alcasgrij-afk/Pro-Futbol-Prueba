'use client';

import { useEffect, useState } from 'react';
import { AlumnoDTO, AsistenciaDTO } from '@profutbol/shared-types';
import { ApiError, api } from '../../../../lib/api-client';
import { hoyISOAnios } from '../../../../lib/fechas';

function fechaLocalISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export default function AsistenciaPage() {
  const [fecha, setFecha] = useState(fechaLocalISO());
  const [alumnos, setAlumnos] = useState<AlumnoDTO[]>([]);
  const [estado, setEstado] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  function cargar() {
    setCargando(true);
    Promise.all([api.listarAlumnos({ activo: true }), api.listarAsistenciaPorFecha(fecha)])
      .then(([al, as]) => {
        setAlumnos(al);
        const mapa: Record<string, boolean> = {};
        as.forEach((r) => (mapa[r.alumnoId] = r.presente));
        setEstado(mapa);
      })
      .catch(() => setAlumnos([]))
      .finally(() => setCargando(false));
  }

  useEffect(cargar, [fecha]);

  async function marcar(alumnoId: string, presente: boolean) {
    setError(null);
    setEstado((prev) => ({ ...prev, [alumnoId]: presente }));
    try {
      await api.marcarAsistencia({ alumnoId, fecha, presente });
    } catch (err) {
      // rollback del cambio optimista
      setEstado((prev) => ({ ...prev, [alumnoId]: !presente }));
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar la asistencia.');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Academia · Asistencia</h1>
        <input
          type="date"
          aria-label="Fecha de asistencia"
          value={fecha}
          min={hoyISOAnios(-60)}
          max={hoyISOAnios(20)}
          onChange={(e) => setFecha(e.target.value)}
          suppressHydrationWarning
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}
      {cargando ? (
        <p className="text-gray-500">Cargando...</p>
      ) : alumnos.length === 0 ? (
        <p className="text-gray-500">No hay alumnos activos para marcar asistencia.</p>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-left">
                <th className="px-4 py-2">Alumno</th>
                <th className="px-4 py-2">Categoría</th>
                <th className="px-4 py-2 text-right">Presente / Ausente</th>
              </tr>
            </thead>
            <tbody>
              {alumnos.map((a) => (
                <tr key={a.id} className="border-t border-gray-100">
                  <td className="px-4 py-2 font-medium">{a.nombre}</td>
                  <td className="px-4 py-2 text-gray-600">{a.categoria}</td>
                  <td className="px-4 py-2">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => marcar(a.id, true)}
                        aria-pressed={estado[a.id] === true}
                        className={`px-3 py-1.5 rounded-md text-xs font-semibold transition active:scale-[0.98] ${
                          estado[a.id] === true ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        Presente
                      </button>
                      <button
                        onClick={() => marcar(a.id, false)}
                        aria-pressed={estado[a.id] === false}
                        className={`px-3 py-1.5 rounded-md text-xs font-semibold transition active:scale-[0.98] ${
                          estado[a.id] === false ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        Ausente
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
