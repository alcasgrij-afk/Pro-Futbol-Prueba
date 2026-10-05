'use client';

import { useEffect, useMemo, useState } from 'react';
import { api, ApiError, type PagoLedgerItem } from '../../../lib/api-client';
import { hoyISO } from '../../../lib/fechas';
import ReciboImprimible from '../../../components/ReciboImprimible';

const ETIQUETA_GATEWAY: Record<string, string> = {
  EFECTIVO: 'Efectivo',
  BAC: 'BAC',
  NEONET: 'Neonet',
  SIMULADO: 'Simulado',
};

const COLOR_ESTADO: Record<string, string> = {
  COMPLETADO: 'bg-green-100 text-green-800',
  PENDIENTE: 'bg-yellow-100 text-yellow-800',
  FALLIDO: 'bg-red-100 text-red-800',
  CANCELADO: 'bg-gray-100 text-gray-600',
};

export default function PagosPage() {
  const [desde, setDesde] = useState(hoyISO());
  const [hasta, setHasta] = useState(hoyISO());
  const [pagos, setPagos] = useState<PagoLedgerItem[] | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mostrarRecibo, setMostrarRecibo] = useState(false);

  useEffect(() => {
    setCargando(true);
    setError(null);
    api
      .listarPagos({ desde, hasta })
      .then(setPagos)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudieron cargar los pagos.'))
      .finally(() => setCargando(false));
  }, [desde, hasta]);

  const totalCompletadoQ = useMemo(
    () => (pagos ?? []).filter((p) => p.estado === 'COMPLETADO').reduce((acc, p) => acc + p.montoQ, 0),
    [pagos],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <h1 className="text-lg font-bold text-navy">Pagos</h1>
        <div className="flex items-center gap-2">
          <input type="date" aria-label="Desde" value={desde} onChange={(e) => setDesde(e.target.value)} className="min-h-11 rounded-md border border-gray-500 px-3 text-sm" />
          <span className="text-sm text-gray-500">a</span>
          <input type="date" aria-label="Hasta" value={hasta} onChange={(e) => setHasta(e.target.value)} className="min-h-11 rounded-md border border-gray-500 px-3 text-sm" />
          <button
            onClick={() => setMostrarRecibo(true)}
            disabled={!pagos || pagos.length === 0}
            className="min-h-11 px-4 bg-navy text-white rounded-md text-sm font-semibold disabled:opacity-50"
          >
            Imprimir reporte
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {cargando || !pagos ? (
        <p className="text-sm text-gray-500">Cargando...</p>
      ) : pagos.length === 0 ? (
        <p className="text-sm text-gray-500">No hay pagos en este rango de fechas.</p>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-x-auto print:hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-gray-200">
                <th className="px-4 py-2 font-semibold">Fecha</th>
                <th className="px-4 py-2 font-semibold">Modulo</th>
                <th className="px-4 py-2 font-semibold">Detalle</th>
                <th className="px-4 py-2 font-semibold">Metodo</th>
                <th className="px-4 py-2 font-semibold">Estado</th>
                <th className="px-4 py-2 font-semibold text-right">Monto</th>
              </tr>
            </thead>
            <tbody>
              {pagos.map((p) => (
                <tr key={p.paymentId} className="border-b border-gray-100 last:border-b-0">
                  <td className="px-4 py-2 whitespace-nowrap text-gray-600">{new Date(p.creadoEn).toLocaleString('es-GT', { dateStyle: 'short', timeStyle: 'short' })}</td>
                  <td className="px-4 py-2">{p.etiqueta}</td>
                  <td className="px-4 py-2 text-gray-500 truncate max-w-[220px]">{p.descripcion ?? '—'}</td>
                  <td className="px-4 py-2">{ETIQUETA_GATEWAY[p.gateway] ?? p.gateway}</td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${COLOR_ESTADO[p.estado] ?? 'bg-gray-100 text-gray-600'}`}>{p.estado}</span>
                  </td>
                  <td className="px-4 py-2 text-right font-semibold">Q{p.montoQ.toLocaleString('es-GT', { minimumFractionDigits: 2 })}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={5} className="px-4 py-2 text-right font-bold text-navy">Total cobrado</td>
                <td className="px-4 py-2 text-right font-bold text-navy">Q{totalCompletadoQ.toLocaleString('es-GT', { minimumFractionDigits: 2 })}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {mostrarRecibo && pagos && (
        <>
          <ReciboImprimible
            titulo="Reporte de pagos"
            subtitulo={desde === hasta ? desde : `${desde} a ${hasta}`}
            lineas={pagos.map((p) => ({
              label: p.etiqueta,
              detalle: `${p.descripcion ?? ''} · ${ETIQUETA_GATEWAY[p.gateway] ?? p.gateway} · ${p.estado}`,
              valor: `Q${p.montoQ}`,
            }))}
            totalLabel="Total cobrado"
            totalQ={totalCompletadoQ}
          />
          <div className="print:hidden fixed bottom-4 right-4 flex gap-2 z-50">
            <button onClick={() => window.print()} className="min-h-11 px-4 bg-navy text-white rounded-md text-sm font-semibold shadow-lg">
              Imprimir
            </button>
            <button onClick={() => setMostrarRecibo(false)} className="min-h-11 px-4 bg-white border border-gray-300 rounded-md text-sm font-semibold shadow-lg">
              Cerrar
            </button>
          </div>
        </>
      )}
    </div>
  );
}
