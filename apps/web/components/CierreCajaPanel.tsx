'use client';

import { useCallback, useEffect, useState } from 'react';
import { WhatsappLogo } from '@phosphor-icons/react';
import { GastoCategoria, type ReporteCierreDTO } from '@profutbol/shared-types';
import { api, ApiError } from '../lib/api-client';
import { hoyISO, rangoMes, rangoSemana } from '../lib/fechas';
import { compartirArchivo } from '../lib/compartir';

/**
 * Cierre de caja del dia (y de la semana y del mes: es el mismo reporte con
 * otro rango). Junta lo cobrado, los gastos y la venta de tienda, y se puede
 * exportar a Excel/PDF o compartir por WhatsApp/correo desde el dispositivo.
 */

type Modo = 'dia' | 'semana' | 'mes';

const ETIQUETA_MODO: Record<Modo, string> = { dia: 'Día', semana: 'Semana', mes: 'Mes' };

const ETIQUETA_GASTO: Record<string, string> = {
  [GastoCategoria.MANTENIMIENTO]: 'Mantenimiento',
  [GastoCategoria.SUMINISTROS]: 'Suministros',
  [GastoCategoria.SERVICIOS]: 'Servicios',
  [GastoCategoria.NOMINA]: 'Nomina',
  [GastoCategoria.OTROS]: 'Otros',
};

const ETIQUETA_METODO: Record<string, string> = {
  EFECTIVO: 'Efectivo',
  TARJETA: 'Tarjeta',
  BAC: 'BAC',
  NEONET: 'Neonet',
  SIMULADO: 'Simulado',
};

function quetzales(monto: number): string {
  return `Q${monto.toLocaleString('es-GT', { minimumFractionDigits: 2 })}`;
}

function rangoDe(modo: Modo, fecha: string): { desde: string; hasta: string } {
  if (modo === 'semana') return rangoSemana(fecha);
  if (modo === 'mes') return rangoMes(fecha);
  return { desde: fecha, hasta: fecha };
}

export default function CierreCajaPanel() {
  const [modo, setModo] = useState<Modo>('dia');
  const [fecha, setFecha] = useState(hoyISO());
  const [cierre, setCierre] = useState<ReporteCierreDTO | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const { desde, hasta } = rangoDe(modo, fecha);

  const cargar = useCallback(() => {
    setCargando(true);
    setError(null);
    api
      .reporteCierre(desde, hasta)
      .then(setCierre)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo cargar el cierre.'))
      .finally(() => setCargando(false));
  }, [desde, hasta]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const nombreBase = desde === hasta ? `Cierre de caja ${desde}` : `Cierre de caja ${desde} a ${hasta}`;

  async function exportar(formato: 'excel' | 'pdf') {
    setOcupado(formato);
    setError(null);
    try {
      await api.descargarExportacion(
        `/reportes/cierre/exportar?desde=${desde}&hasta=${hasta}&formato=${formato}`,
        `${nombreBase}.${formato === 'excel' ? 'xlsx' : 'pdf'}`,
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo generar el archivo.');
    } finally {
      setOcupado(null);
    }
  }

  async function compartir() {
    setOcupado('compartir');
    setError(null);
    setAviso(null);
    try {
      const blob = await api.obtenerExportacion(`/reportes/cierre/exportar?desde=${desde}&hasta=${hasta}&formato=pdf`);
      const texto = cierre
        ? `${nombreBase}\nIngresos: ${quetzales(cierre.ingresos.totalQ)}\nGastos: ${quetzales(cierre.gastos.totalQ)}\nNeto: ${quetzales(cierre.netoQ)}`
        : nombreBase;
      const via = await compartirArchivo(blob, `${nombreBase}.pdf`, texto);
      if (via === 'descarga') {
        setAviso('Este dispositivo no permite adjuntar directo: se descargó el PDF y se abrió WhatsApp para adjuntarlo.');
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo compartir el reporte.');
    } finally {
      setOcupado(null);
    }
  }

  return (
    <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-navy">Cierre de caja</h2>
          <p className="text-xs text-gray-500">
            {desde === hasta ? desde : `${desde} a ${hasta}`} · pagos, gastos y tienda
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 bg-gray-50 border border-gray-300 rounded-md p-1">
            {(['dia', 'semana', 'mes'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setModo(m)}
                className={`min-h-9 px-3 text-xs font-semibold rounded ${modo === m ? 'bg-navy text-white' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                {ETIQUETA_MODO[m]}
              </button>
            ))}
          </div>
          <input
            type="date"
            aria-label="Fecha del cierre"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            suppressHydrationWarning
            className="min-h-11 rounded-md border border-gray-500 px-3 text-sm"
          />
          <button
            onClick={() => exportar('excel')}
            disabled={!!ocupado}
            className="min-h-11 px-3 text-xs font-semibold rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {ocupado === 'excel' ? '...' : 'Excel'}
          </button>
          <button
            onClick={() => exportar('pdf')}
            disabled={!!ocupado}
            className="min-h-11 px-3 text-xs font-semibold rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {ocupado === 'pdf' ? '...' : 'PDF'}
          </button>
          <button
            onClick={compartir}
            disabled={!!ocupado}
            className="min-h-11 px-4 flex items-center gap-1.5 text-xs font-bold rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
          >
            <WhatsappLogo size={16} weight="fill" />
            {ocupado === 'compartir' ? 'Preparando...' : 'Compartir'}
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {aviso && <p className="text-xs text-amber-700 bg-amber-50 border border-amber-300 rounded-md p-2">{aviso}</p>}

      {cargando || !cierre ? (
        <p className="text-sm text-gray-500">Cargando cierre...</p>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-md border border-gray-200 p-3">
              <p className="text-xs text-gray-500">Ingresos</p>
              <p className="text-lg font-bold text-green-700">{quetzales(cierre.ingresos.totalQ)}</p>
              <p className="text-[11px] text-gray-500">{cierre.ingresos.cantidad} pagos</p>
            </div>
            <div className="rounded-md border border-gray-200 p-3">
              <p className="text-xs text-gray-500">Gastos</p>
              <p className="text-lg font-bold text-red-700">{quetzales(cierre.gastos.totalQ)}</p>
            </div>
            <div className="rounded-md border border-gray-200 p-3">
              <p className="text-xs text-gray-500">Tienda</p>
              <p className="text-lg font-bold text-navy">{quetzales(cierre.ventas.totalQ)}</p>
              <p className="text-[11px] text-gray-500">{cierre.ventas.cantidad} ventas · ya en ingresos</p>
            </div>
            <div className="rounded-md border-2 border-navy p-3">
              <p className="text-xs text-gray-500">Neto</p>
              <p className="text-lg font-bold text-navy">{quetzales(cierre.netoQ)}</p>
              <p className="text-[11px] text-gray-500">ingresos − gastos</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <h3 className="text-xs font-bold text-gray-600 mb-1">Ingresos por categoría</h3>
              {cierre.ingresos.porCategoria.length === 0 ? (
                <p className="text-xs text-gray-400">Sin cobros en el período.</p>
              ) : (
                <ul className="text-sm divide-y divide-gray-100">
                  {cierre.ingresos.porCategoria.map((c) => (
                    <li key={c.tipoReferencia} className="flex justify-between py-1">
                      <span className="text-gray-600">
                        {c.etiqueta} <span className="text-xs text-gray-400">({c.cantidad})</span>
                      </span>
                      <span className="font-semibold">{quetzales(c.totalQ)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h3 className="text-xs font-bold text-gray-600 mb-1">Por método de pago</h3>
              {cierre.ingresos.porMetodo.length === 0 ? (
                <p className="text-xs text-gray-400">Sin cobros en el período.</p>
              ) : (
                <ul className="text-sm divide-y divide-gray-100">
                  {cierre.ingresos.porMetodo.map((m) => (
                    <li key={m.gateway} className="flex justify-between py-1">
                      <span className="text-gray-600">
                        {ETIQUETA_METODO[m.gateway] ?? m.gateway}{' '}
                        <span className="text-xs text-gray-400">({m.cantidad})</span>
                      </span>
                      <span className="font-semibold">{quetzales(m.totalQ)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h3 className="text-xs font-bold text-gray-600 mb-1">Gastos por categoría</h3>
              {cierre.gastos.porCategoria.length === 0 ? (
                <p className="text-xs text-gray-400">Sin gastos en el período.</p>
              ) : (
                <ul className="text-sm divide-y divide-gray-100">
                  {cierre.gastos.porCategoria.map((g) => (
                    <li key={g.categoria} className="flex justify-between py-1">
                      <span className="text-gray-600">
                        {ETIQUETA_GASTO[g.categoria] ?? g.categoria}{' '}
                        <span className="text-xs text-gray-400">({g.cantidad})</span>
                      </span>
                      <span className="font-semibold text-red-700">{quetzales(g.totalQ)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {cierre.ventas.porProducto.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-gray-600 mb-1">Tienda — productos vendidos</h3>
              <ul className="text-sm grid gap-x-6 md:grid-cols-2">
                {cierre.ventas.porProducto.map((p) => (
                  <li key={p.nombre} className="flex justify-between py-1 border-b border-gray-100">
                    <span className="text-gray-600">
                      {p.cantidad}x {p.nombre}
                    </span>
                    <span className="font-semibold">{quetzales(p.totalQ)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}
