'use client';

import { useEffect, useState } from 'react';
import { AcademiaMensualidadDTO, GatewayPago } from '@profutbol/shared-types';
import { ApiError, api, type PagoDetalle } from '../../../../lib/api-client';
import Skeleton from '../../../../components/Skeleton';
import ReciboImprimible from '../../../../components/ReciboImprimible';

export default function MensualidadesPage() {
  const ahora = new Date();
  const [mes, setMes] = useState(ahora.getMonth() + 1);
  const [anio, setAnio] = useState(ahora.getFullYear());
  const [lista, setLista] = useState<AcademiaMensualidadDTO[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cobroModal, setCobroModal] = useState<AcademiaMensualidadDTO | null>(null);
  const [recibo, setRecibo] = useState<PagoDetalle | null>(null);

  function cargar() {
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
  }

  useEffect(cargar, [mes, anio]);

  useEffect(() => {
    if (recibo) window.print();
  }, [recibo]);

  return (
    <>
    <div className="space-y-6 print:hidden">
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
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {lista.map((m) => (
                <tr key={m.id} className="border-t border-gray-100">
                  <td className="px-4 py-2 font-medium">{m.alumno ? `${m.alumno.nombres} ${m.alumno.apellidos}` : '—'}</td>
                  <td className="px-4 py-2">{m.mes}/{m.anio}</td>
                  <td className="px-4 py-2">Q{m.montoQ}</td>
                  <td className="px-4 py-2">
                    {m.pagada ? (
                      <span className="px-2 py-1 rounded text-xs bg-green-100 text-green-800">Pagada</span>
                    ) : (
                      <span className="px-2 py-1 rounded text-xs bg-yellow-100 text-yellow-800">Pendiente</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {!m.pagada && (
                      <button onClick={() => setCobroModal(m)} className="text-xs font-semibold text-navy bg-blue-50 border border-blue-200 rounded px-2 py-1 hover:bg-blue-100 transition active:scale-[0.98]">
                        Cobrar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>

    {cobroModal && (
      <CobrarMensualidadModal
        mensualidad={cobroModal}
        onClose={() => setCobroModal(null)}
        onCobrado={(detalle) => {
          setCobroModal(null);
          setRecibo(detalle);
          cargar();
        }}
      />
    )}

    {recibo && (
      <>
        <ReciboImprimible
          titulo="Recibo de cobro — Mensualidad academia"
          subtitulo={recibo.descripcion ?? undefined}
          metodoPago={recibo.gateway === GatewayPago.TARJETA ? `Tarjeta · autorización ${recibo.codigoAutorizacion ?? ''}` : 'Efectivo'}
          numeroRecibo={recibo.numeroRecibo}
          lineas={[{ label: 'Mensualidad academia', valor: `Q${recibo.montoQ}` }]}
          totalQ={recibo.montoQ}
        />
        <div className="print:hidden fixed bottom-4 right-4 flex gap-2 z-50">
          <button onClick={() => window.print()} className="min-h-11 px-4 bg-navy text-white rounded-md text-sm font-semibold shadow-lg">
            Imprimir recibo
          </button>
          <button onClick={() => setRecibo(null)} className="min-h-11 px-4 bg-white border border-gray-300 rounded-md text-sm font-semibold shadow-lg">
            Cerrar
          </button>
        </div>
      </>
    )}
    </>
  );
}

function CobrarMensualidadModal({
  mensualidad,
  onClose,
  onCobrado,
}: {
  mensualidad: AcademiaMensualidadDTO;
  onClose: () => void;
  onCobrado: (detalle: PagoDetalle) => void;
}) {
  const [metodoPago, setMetodoPago] = useState<GatewayPago.EFECTIVO | GatewayPago.TARJETA>(GatewayPago.EFECTIVO);
  const [codigoAutorizacion, setCodigoAutorizacion] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cobrar() {
    if (metodoPago === GatewayPago.TARJETA && !/^\d{6,12}$/.test(codigoAutorizacion)) {
      setError('El código POS debe tener entre 6 y 12 dígitos.');
      return;
    }
    setCargando(true);
    setError(null);
    try {
      const detalle = await api.cobrarMensualidadEnSede(mensualidad.id, {
        metodoPago,
        ...(metodoPago === GatewayPago.TARJETA ? { codigoAutorizacion } : {}),
      });
      onCobrado(detalle);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cobrar la mensualidad.');
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4 space-y-3" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-base font-bold text-navy">Cobrar mensualidad</h2>
        <p className="text-sm text-gray-600">
          {mensualidad.alumno ? `${mensualidad.alumno.nombres} ${mensualidad.alumno.apellidos}` : 'Alumno'} · {mensualidad.mes}/{mensualidad.anio} · Q{mensualidad.montoQ}
        </p>

        <label className="block text-xs font-medium text-gray-600">
          Metodo de pago
          <div className="mt-1 flex gap-1 bg-gray-50 border border-gray-300 rounded-md p-1">
            {([GatewayPago.EFECTIVO, GatewayPago.TARJETA] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMetodoPago(m)}
                className={`flex-1 min-h-9 text-xs font-semibold rounded ${metodoPago === m ? 'bg-navy text-white' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                {m === GatewayPago.EFECTIVO ? 'Efectivo' : 'Tarjeta'}
              </button>
            ))}
          </div>
        </label>

        {metodoPago === GatewayPago.TARJETA && (
          <label className="block text-xs font-medium text-gray-600">
            Código POS (autorización)
            <input
              type="text"
              inputMode="numeric"
              value={codigoAutorizacion}
              onChange={(e) => setCodigoAutorizacion(e.target.value.replace(/\D/g, '').slice(0, 12))}
              className="mt-1 w-full min-h-11 rounded-md border border-gray-400 px-3 text-sm"
            />
          </label>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} disabled={cargando} className="min-h-11 px-3 text-sm font-medium text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50">
            Cancelar
          </button>
          <button onClick={cobrar} disabled={cargando} className="min-h-11 px-3 text-sm font-medium text-white bg-navy rounded-md disabled:opacity-50">
            {cargando ? 'Cobrando...' : 'Cobrar'}
          </button>
        </div>
      </div>
    </div>
  );
}
