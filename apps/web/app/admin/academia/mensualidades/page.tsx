'use client';

import { useEffect, useState } from 'react';
import { AcademiaMensualidadDTO } from '@profutbol/shared-types';
import { ApiError, api } from '../../../../lib/api-client';
import Skeleton from '../../../../components/Skeleton';

export default function MensualidadesPage() {
  const ahora = new Date();
  const [mes, setMes] = useState(ahora.getMonth() + 1);
  const [anio, setAnio] = useState(ahora.getFullYear());
  const [lista, setLista] = useState<AcademiaMensualidadDTO[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCargando(true);
    setError(null);
    api
      .listarMensualidadesDelMes(mes, anio)
      .then(setLista)
      .catch((err) => {
        setLista([]);
        setError(err instanceof ApiError ? err.message : 'No se pudieron cargar las mensualidades.');
      })
      .finally(() => setCargando(false));
  }, [mes, anio]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Academia · Mensualidades</h1>
        <div className="flex items-center gap-2 text-sm">
          <select aria-label="Mes" value={mes} onChange={(e) => setMes(Number(e.target.value))} suppressHydrationWarning className="rounded-md border border-gray-300 px-3 py-2">
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>{new Intl.DateTimeFormat('es', { month: 'long' }).format(new Date(2024, m - 1, 1))}</option>
            ))}
          </select>
          <select aria-label="Año" value={anio} onChange={(e) => setAnio(Number(e.target.value))} suppressHydrationWarning className="rounded-md border border-gray-300 px-3 py-2">
            {[anio - 1, anio, anio + 1].map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      {cargando ? (
        <div className="border border-gray-200 rounded-lg overflow-x-auto" aria-busy="true">
          <table className="w-full text-sm">
            <tbody>
              {Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-t border-gray-100 first:border-0">
                  <td className="px-4 py-3"><Skeleton className="h-4 w-36" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-16" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-14" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-5 w-24 rounded-full" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : lista.length === 0 ? (
        <p className="text-gray-500">
          No hay mensualidades para {mes}/{anio}. El cobro se genera el día 1 de cada mes para los alumnos activos.
        </p>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-left">
                <th className="px-4 py-2">Alumno</th>
                <th className="px-4 py-2">Periodo</th>
                <th className="px-4 py-2">Monto</th>
                <th className="px-4 py-2">Estado</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((m) => (
                <tr key={m.id} className="border-t border-gray-100">
                  <td className="px-4 py-2 font-medium">{m.alumno?.nombre ?? '—'}</td>
                  <td className="px-4 py-2">{m.mes}/{m.anio}</td>
                  <td className="px-4 py-2">Q{m.montoQ}</td>
                  <td className="px-4 py-2">
                    {m.pagada ? (
                      <span className="px-2 py-1 rounded text-xs bg-green-100 text-green-800">Pagada</span>
                    ) : (
                      <span className="px-2 py-1 rounded text-xs bg-yellow-100 text-yellow-800">Pendiente</span>
                    )}
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
