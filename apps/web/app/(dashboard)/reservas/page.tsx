'use client';

import { useEffect, useState, useCallback } from 'react';
import { EstadoReserva, ReservaDTO } from '@profutbol/shared-types';
import { api, ApiError } from '../../../lib/api-client';

const ETIQUETAS_ESTADO: Record<string, { texto: string; clase: string }> = {
  [EstadoReserva.PENDIENTE_PAGO]: { texto: 'Pendiente de pago', clase: 'bg-yellow-100 text-yellow-800' },
  [EstadoReserva.PENDIENTE_SEDE]: { texto: 'Pendiente en sede', clase: 'bg-blue-100 text-blue-800' },
  [EstadoReserva.CONFIRMADA]: { texto: 'Confirmada', clase: 'bg-green-100 text-green-800' },
  [EstadoReserva.LIBERADA]: { texto: 'Liberada (timeout)', clase: 'bg-gray-100 text-gray-600' },
  [EstadoReserva.CANCELADA]: { texto: 'Cancelada', clase: 'bg-red-100 text-red-700' },
};

function hoyISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function ReservasPage() {
  const [fecha, setFecha] = useState(hoyISO());
  const [reservas, setReservas] = useState<ReservaDTO[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accionEnCurso, setAccionEnCurso] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const datos = await api.listarReservas({ fecha });
      setReservas(datos);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudieron cargar las reservas.');
    } finally {
      setCargando(false);
    }
  }, [fecha]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function confirmar(id: string) {
    setAccionEnCurso(id);
    try {
      await api.confirmarReserva(id);
      await cargar();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'No se pudo confirmar la reserva.');
    } finally {
      setAccionEnCurso(null);
    }
  }

  async function cancelar(id: string) {
    if (!confirm('Seguro que queres cancelar esta reserva?')) return;
    setAccionEnCurso(id);
    try {
      await api.cancelarReserva(id);
      await cargar();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'No se pudo cancelar la reserva.');
    } finally {
      setAccionEnCurso(null);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-bold text-navy">Reservas del dia</h1>
        <input
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
        />
      </div>

      {error && <p className="text-sm text-red mb-4">{error}</p>}

      {cargando ? (
        <p className="text-sm text-gray-500">Cargando...</p>
      ) : reservas.length === 0 ? (
        <p className="text-sm text-gray-500">No hay reservas para esta fecha.</p>
      ) : (
        <div className="overflow-x-auto bg-white rounded-lg shadow-sm">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="px-4 py-2">Horario</th>
                <th className="px-4 py-2">Cancha</th>
                <th className="px-4 py-2">Cliente</th>
                <th className="px-4 py-2">Precio</th>
                <th className="px-4 py-2">Estado</th>
                <th className="px-4 py-2">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {reservas.map((r) => {
                const etiqueta = ETIQUETAS_ESTADO[r.estado] ?? { texto: r.estado, clase: 'bg-gray-100' };
                const pendiente =
                  r.estado === EstadoReserva.PENDIENTE_PAGO || r.estado === EstadoReserva.PENDIENTE_SEDE;

                return (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="px-4 py-2">
                      {r.horaInicio} - {r.horaFin}
                    </td>
                    <td className="px-4 py-2">{r.cancha?.nombre}</td>
                    <td className="px-4 py-2">
                      {r.cliente?.nombre}
                      <div className="text-xs text-gray-400">{r.cliente?.telefono}</div>
                    </td>
                    <td className="px-4 py-2">Q{r.precioTotalQ}</td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${etiqueta.clase}`}>
                        {etiqueta.texto}
                      </span>
                    </td>
                    <td className="px-4 py-2 space-x-2 whitespace-nowrap">
                      {pendiente && (
                        <button
                          disabled={accionEnCurso === r.id}
                          onClick={() => confirmar(r.id)}
                          className="text-xs font-semibold text-white bg-navy rounded px-2 py-1 disabled:opacity-50"
                        >
                          Confirmar
                        </button>
                      )}
                      {pendiente && (
                        <button
                          disabled={accionEnCurso === r.id}
                          onClick={() => cancelar(r.id)}
                          className="text-xs font-semibold text-red border border-red rounded px-2 py-1 disabled:opacity-50"
                        >
                          Cancelar
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
