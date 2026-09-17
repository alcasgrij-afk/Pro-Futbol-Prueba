'use client';

import { useEffect, useState } from 'react';
import { ReporteIngresosDTO, ReporteMorosidadDTO, ReporteOcupacionDTO } from '@profutbol/shared-types';
import { api, ApiError } from '../../../lib/api-client';
import { hoyISOAnios } from '../../../lib/fechas';

// Fecha local GT (no UTC): toISOString().slice(0,10) corre "hoy" un dia adelante
// entre las 18:00 y 23:59 (UTC-6) y el rango terminaria en manana (vacio).
function aISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function primerDiaDelMes(): string {
  const d = new Date();
  return aISO(new Date(d.getFullYear(), d.getMonth(), 1));
}
function hoyISO(): string {
  return aISO(new Date());
}

export default function ReportesPage() {
  const [desde, setDesde] = useState(primerDiaDelMes());
  const [hasta, setHasta] = useState(hoyISO());
  const [ingresos, setIngresos] = useState<ReporteIngresosDTO | null>(null);
  const [ocupacion, setOcupacion] = useState<ReporteOcupacionDTO | null>(null);
  const [morosidad, setMorosidad] = useState<ReporteMorosidadDTO | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportando, setExportando] = useState<string | null>(null);

  useEffect(() => {
    setCargando(true);
    setError(null);
    Promise.all([api.reporteIngresos(desde, hasta), api.reporteOcupacion(desde, hasta), api.reporteMorosidad(7)])
      .then(([i, o, m]) => {
        setIngresos(i);
        setOcupacion(o);
        setMorosidad(m);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudieron cargar los reportes.'))
      .finally(() => setCargando(false));
  }, [desde, hasta]);

  async function exportar(tipo: 'ingresos' | 'morosidad', formato: 'excel' | 'pdf') {
    const clave = `${tipo}-${formato}`;
    setExportando(clave);
    try {
      if (tipo === 'ingresos') {
        const ext = formato === 'excel' ? 'xlsx' : 'pdf';
        await api.descargarExportacion(
          `/reportes/ingresos/exportar?desde=${desde}&hasta=${hasta}&formato=${formato}`,
          `ingresos_${desde}_a_${hasta}.${ext}`,
        );
      } else {
        const ext = formato === 'excel' ? 'xlsx' : 'pdf';
        await api.descargarExportacion(`/reportes/morosidad/exportar?formato=${formato}`, `morosidad.${ext}`);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo generar el archivo.');
    } finally {
      setExportando(null);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-lg font-bold text-navy">Reportes</h1>
        <div className="flex items-center gap-2 text-sm">
          <input type="date" aria-label="Desde" value={desde} min={hoyISOAnios(-60)} max={hoyISOAnios(20)} onChange={(e) => setDesde(e.target.value)} suppressHydrationWarning className="rounded-md border border-gray-300 px-2 py-1.5" />
          <span className="text-gray-600">a</span>
          <input type="date" aria-label="Hasta" value={hasta} min={hoyISOAnios(-60)} max={hoyISOAnios(20)} onChange={(e) => setHasta(e.target.value)} suppressHydrationWarning className="rounded-md border border-gray-300 px-2 py-1.5" />
        </div>
      </div>

      {error && <p className="text-sm text-red mb-4">{error}</p>}

      {cargando ? (
        <p className="text-sm text-gray-500">Cargando...</p>
      ) : (
        <div className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-sm font-semibold text-gray-500">Ingresos del periodo</h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => exportar('ingresos', 'excel')}
                    disabled={exportando === 'ingresos-excel'}
                    className="text-xs font-semibold text-navy border border-navy rounded px-2 py-1 disabled:opacity-50 min-h-11"
                  >
                    {exportando === 'ingresos-excel' ? '...' : 'Excel'}
                  </button>
                  <button
                    onClick={() => exportar('ingresos', 'pdf')}
                    disabled={exportando === 'ingresos-pdf'}
                    className="text-xs font-semibold text-red border border-red rounded px-2 py-1 disabled:opacity-50 min-h-11"
                  >
                    {exportando === 'ingresos-pdf' ? '...' : 'PDF'}
                  </button>
                </div>
              </div>
              <p className="text-3xl font-bold text-navy mb-1">Q{ingresos?.totalQ.toLocaleString('es-GT')}</p>
              <p className="text-xs text-gray-600 mb-4">{ingresos?.cantidadPagos} pagos confirmados</p>

              <div className="space-y-1 mb-4">
                {ingresos?.porModulo.map((m) => (
                  <div key={m.tipoReferencia} className="flex justify-between text-xs text-gray-600">
                    <span>{m.etiqueta}</span>
                    <span className="font-medium">
                      Q{m.totalQ} ({m.cantidad})
                    </span>
                  </div>
                ))}
                {ingresos?.porModulo.length === 0 && <p className="text-xs text-gray-600">Sin ingresos en este periodo.</p>}
              </div>

              <details>
                <summary className="text-xs text-gray-600 cursor-pointer">Ver desglose diario</summary>
                <div className="space-y-1 mt-2">
                  {ingresos?.porDia.map((d) => (
                    <div key={d.fecha} className="flex justify-between text-xs text-gray-600">
                      <span>{d.fecha}</span>
                      <span className="font-medium">Q{d.totalQ}</span>
                    </div>
                  ))}
                </div>
              </details>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-sm font-semibold text-gray-500 mb-4">Ocupacion por cancha</h2>
              <div className="space-y-4">
                {ocupacion?.porCancha.map((c) => (
                  <div key={c.canchaId}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium">{c.canchaNombre}</span>
                      <span className="text-gray-500">{c.porcentajeOcupacion}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div className="bg-navy h-2 rounded-full" style={{ width: `${c.porcentajeOcupacion}%` }} />
                    </div>
                    <p className="text-xs text-gray-600 mt-1">
                      {c.bloquesOcupados} de {c.bloquesTotales} bloques ocupados
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold text-gray-500">Morosidad (mas de 7 dias sin pagar)</h2>
                <p className="text-2xl font-bold text-red">Q{morosidad?.totalQ.toLocaleString('es-GT')}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => exportar('morosidad', 'excel')}
                  disabled={exportando === 'morosidad-excel'}
                  className="text-xs font-semibold text-navy border border-navy rounded px-2 py-1 disabled:opacity-50 min-h-11"
                >
                  {exportando === 'morosidad-excel' ? '...' : 'Excel'}
                </button>
                <button
                  onClick={() => exportar('morosidad', 'pdf')}
                  disabled={exportando === 'morosidad-pdf'}
                  className="text-xs font-semibold text-red border border-red rounded px-2 py-1 disabled:opacity-50 min-h-11"
                >
                  {exportando === 'morosidad-pdf' ? '...' : 'PDF'}
                </button>
              </div>
            </div>

            {morosidad?.detalle.length === 0 ? (
              <p className="text-sm text-gray-500">No hay pagos vencidos en este momento.</p>
            ) : (
              <div className="divide-y">
                {morosidad?.detalle.map((d) => (
                  <div key={d.pagoId} className="flex items-center justify-between py-2 text-sm">
                    <div>
                      <p className="font-medium">{d.descripcion}</p>
                      <p className="text-xs text-gray-600">{d.etiqueta}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">Q{d.montoQ}</p>
                      <p className="text-xs text-red">{d.diasVencido} dias vencido</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}