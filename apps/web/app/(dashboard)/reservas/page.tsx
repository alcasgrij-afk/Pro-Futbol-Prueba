'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { EstadoReserva, FormaPago, ReservaDTO } from '@profutbol/shared-types';
import { api, ApiError } from '../../../lib/api-client';

// --- Etiquetas de estado (GT) ---
const ETIQUETAS_ESTADO: Record<string, { texto: string; clase: string }> = {
  [EstadoReserva.PENDIENTE_PAGO]: { texto: 'Pendiente de pago', clase: 'bg-yellow-100 text-yellow-800' },
  [EstadoReserva.PENDIENTE_SEDE]: { texto: 'Pendiente en sede', clase: 'bg-blue-100 text-blue-800' },
  [EstadoReserva.CONFIRMADA]: { texto: 'Confirmada', clase: 'bg-green-100 text-green-800' },
  [EstadoReserva.LIBERADA]: { texto: 'Liberada (timeout)', clase: 'bg-gray-100 text-gray-600' },
  [EstadoReserva.CANCELADA]: { texto: 'Cancelada', clase: 'bg-red-100 text-red-700' },
};

// Formas de pago
const ETIQUETAS_FORMA: Record<string, string> = {
  [FormaPago.ANTICIPADO_EN_LINEA]: 'En linea',
  [FormaPago.EN_SEDE]: 'En sede',
};

function hoyISO(): string {
  return new Date().toISOString().slice(0, 10);
}

// --- Tarjetas de resumen ---
function StatCard({ titulo, valor, clase }: { titulo: string; valor: number | string; clase?: string }) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 min-w-[130px]">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{titulo}</p>
      <p className={`mt-1 text-2xl font-bold ${clase ?? 'text-navy'}`}>{valor}</p>
    </div>
  );
}

// --- Filtro de estados ---
const FILTROS: { key: string; etiqueta: string }[] = [
  { key: 'TODAS', etiqueta: 'Todas' },
  { key: EstadoReserva.PENDIENTE_PAGO, etiqueta: 'Pend. pago' },
  { key: EstadoReserva.PENDIENTE_SEDE, etiqueta: 'Pend. sede' },
  { key: EstadoReserva.CONFIRMADA, etiqueta: 'Confirmadas' },
  { key: EstadoReserva.LIBERADA, etiqueta: 'Liberadas' },
  { key: EstadoReserva.CANCELADA, etiqueta: 'Canceladas' },
];

// --- Modal de confirmacion inline ---
function ConfirmarModal({
  titulo,
  mensaje,
  onConfirmar,
  onCancelar,
  cargando,
}: {
  titulo: string;
  mensaje: string;
  onConfirmar: () => void;
  onCancelar: () => void;
  cargando: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4 space-y-3">
        <h2 className="text-base font-bold text-navy">{titulo}</h2>
        <p className="text-sm text-gray-600">{mensaje}</p>
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onCancelar}
            disabled={cargando}
            className="px-3 py-1.5 text-sm font-medium text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirmar}
            disabled={cargando}
            className="px-3 py-1.5 text-sm font-medium text-white bg-navy rounded-md hover:bg-navy/90 disabled:opacity-50 flex items-center gap-2"
          >
            {cargando && (
              <span className="inline-block h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Pagina principal ---
export default function ReservasPage() {
  const [fecha, setFecha] = useState(hoyISO());
  const [reservas, setReservas] = useState<ReservaDTO[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtro activo (client-side)
  const [filtroEstado, setFiltroEstado] = useState('TODAS');

  // Estado del modal de confirmar / cancelar
  const [modal, setModal] = useState<{
    tipo: 'confirmar' | 'cancelar';
    reserva: ReservaDTO;
  } | null>(null);
  const [accionCargando, setAccionCargando] = useState(false);

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

  // --- Estadisticas (derivadas del listado completo del dia) ---
  const stats = useMemo(() => {
    let pendientesPago = 0;
    let pendientesSede = 0;
    let confirmadas = 0;
    let liberadas = 0;
    let canceladas = 0;
    let montoTotal = 0;

    for (const r of reservas) {
      switch (r.estado) {
        case EstadoReserva.PENDIENTE_PAGO: pendientesPago++; break;
        case EstadoReserva.PENDIENTE_SEDE: pendientesSede++; break;
        case EstadoReserva.CONFIRMADA: confirmadas++; montoTotal += Number(r.precioTotalQ); break;
        case EstadoReserva.LIBERADA: liberadas++; break;
        case EstadoReserva.CANCELADA: canceladas++; break;
      }
    }
    return { pendientesPago, pendientesSede, confirmadas, liberadas, canceladas, montoTotal, total: reservas.length };
  }, [reservas]);

  // --- Reservas filtradas (client-side) ---
  const reservasFiltradas = useMemo(() => {
    if (filtroEstado === 'TODAS') return reservas;
    return reservas.filter((r) => r.estado === filtroEstado);
  }, [reservas, filtroEstado]);

  // --- Acciones: Confirmar / Cancelar ---
  async function ejecutarAccion() {
    if (!modal) return;
    setAccionCargando(true);
    try {
      if (modal.tipo === 'confirmar') {
        await api.confirmarReserva(modal.reserva.id);
      } else {
        await api.cancelarReserva(modal.reserva.id);
      }
      setModal(null);
      await cargar();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Ocurrio un error. Intenta de nuevo.');
    } finally {
      setAccionCargando(false);
    }
  }

  const formatQ = (v: number) => `Q${v.toLocaleString('es-GT', { minimumFractionDigits: 0 })}`;

  return (
    <div className="space-y-6">
      {/* --- Encabezado y selector de fecha --- */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-navy">Reservas del dia</h1>
        <input
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
        />
      </div>

      {/* --- Tarjetas de resumen --- */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <StatCard titulo="Total" valor={stats.total} />
        <StatCard titulo="Pend. sede" valor={stats.pendientesSede} clase="text-blue-700" />
        <StatCard titulo="Pend. pago" valor={stats.pendientesPago} clase="text-yellow-700" />
        <StatCard titulo="Confirmadas" valor={stats.confirmadas} clase="text-green-700" />
        <StatCard titulo="Monto del dia" valor={formatQ(stats.montoTotal)} clase="text-navy" />
      </div>

      {/* --- Filtros de estado --- */}
      <div className="flex flex-wrap gap-2">
        {FILTROS.map((f) => {
          const activo = filtroEstado === f.key;
          const count =
            f.key === 'TODAS'
              ? reservas.length
              : reservas.filter((r) => r.estado === f.key).length;
          return (
            <button
              key={f.key}
              onClick={() => setFiltroEstado(f.key)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition ${
                activo
                  ? 'bg-navy text-white border-navy'
                  : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-100'
              }`}
            >
              {f.etiqueta}
              <span className="ml-1.5 opacity-70">{count}</span>
            </button>
          );
        })}
      </div>

      {/* --- Error --- */}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* --- Tabla de reservas --- */}
      {cargando ? (
        <p className="text-sm text-gray-500">Cargando reservas...</p>
      ) : reservasFiltradas.length === 0 ? (
        <p className="text-sm text-gray-500">
          No hay reservas {filtroEstado !== 'TODAS' ? `con estado "${ETIQUETAS_ESTADO[filtroEstado]?.texto ?? filtroEstado}"` : ''} para esta fecha.
        </p>
      ) : (
        <div className="overflow-x-auto bg-white rounded-lg shadow-sm">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b text-xs uppercase tracking-wide">
                <th className="px-4 py-2">Horario</th>
                <th className="px-4 py-2">Cancha</th>
                <th className="px-4 py-2">Cliente</th>
                <th className="px-4 py-2">Pago</th>
                <th className="px-4 py-2">Monto</th>
                <th className="px-4 py-2">Estado</th>
                <th className="px-4 py-2">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {reservasFiltradas.map((r) => {
                const etiqueta = ETIQUETAS_ESTADO[r.estado] ?? { texto: r.estado, clase: 'bg-gray-100' };
                const pendiente =
                  r.estado === EstadoReserva.PENDIENTE_PAGO || r.estado === EstadoReserva.PENDIENTE_SEDE;

                return (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-2 font-medium whitespace-nowrap">
                      {r.horaInicio} – {r.horaFin}
                    </td>
                    <td className="px-4 py-2">{r.cancha?.nombre ?? '—'}</td>
                    <td className="px-4 py-2">
                      <div className="font-medium">{r.cliente?.nombre ?? '—'}</div>
                      <div className="text-xs text-gray-400">{r.cliente?.telefono}</div>
                    </td>
                    <td className="px-4 py-2">
                      <span className="text-xs text-gray-500">{ETIQUETAS_FORMA[r.formaPago] ?? r.formaPago}</span>
                    </td>
                    <td className="px-4 py-2 font-medium whitespace-nowrap">Q{r.precioTotalQ}</td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${etiqueta.clase}`}>
                        {etiqueta.texto}
                      </span>
                    </td>
                    <td className="px-4 py-2 space-x-2 whitespace-nowrap">
                      {pendiente && (
                        <>
                          <button
                            onClick={() => setModal({ tipo: 'confirmar', reserva: r })}
                            className="text-xs font-semibold text-white bg-navy rounded px-2.5 py-1 hover:bg-navy/80 transition"
                          >
                            Confirmar
                          </button>
                          <button
                            onClick={() => setModal({ tipo: 'cancelar', reserva: r })}
                            className="text-xs font-semibold text-red-600 border border-red-300 rounded px-2.5 py-1 hover:bg-red-50 transition"
                          >
                            Cancelar
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* --- Modal de confirmacion / cancelacion --- */}
      {modal && (
        <ConfirmarModal
          titulo={modal.tipo === 'confirmar' ? 'Confirmar reserva' : 'Cancelar reserva'}
          mensaje={
            modal.tipo === 'confirmar'
              ? `Vas a confirmar la reserva de ${modal.reserva.cliente?.nombre ?? 'este cliente'} en ${modal.reserva.cancha?.nombre ?? 'la cancha'}${
                  modal.reserva.horaInicio ? ` a las ${modal.reserva.horaInicio}` : ''
                }.`
              : `Vas a cancelar la reserva de ${modal.reserva.cliente?.nombre ?? 'este cliente'} en ${modal.reserva.cancha?.nombre ?? 'la cancha'}${
                  modal.reserva.horaInicio ? ` a las ${modal.reserva.horaInicio}` : ''
                }. Esta accion no se puede deshacer.`
          }
          onConfirmar={ejecutarAccion}
          onCancelar={() => setModal(null)}
          cargando={accionCargando}
        />
      )}
    </div>
  );
}
