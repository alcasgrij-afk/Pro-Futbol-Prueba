'use client';

import { useEffect, useMemo, useState } from 'react';
import { GastoCategoria, type GastoDTO, type ResumenGastosDTO } from '@profutbol/shared-types';
import { api, ApiError, type PagoLedgerItem } from '../../../lib/api-client';
import { aISO, hoyISO } from '../../../lib/fechas';
import ReciboImprimible from '../../../components/ReciboImprimible';

const ETIQUETA_GATEWAY: Record<string, string> = {
  EFECTIVO: 'Efectivo',
  TARJETA: 'Tarjeta',
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

const ETIQUETA_GASTO_CATEGORIA: Record<GastoCategoria, string> = {
  [GastoCategoria.MANTENIMIENTO]: 'Mantenimiento',
  [GastoCategoria.SUMINISTROS]: 'Suministros',
  [GastoCategoria.SERVICIOS]: 'Servicios',
  [GastoCategoria.NOMINA]: 'Nomina',
  [GastoCategoria.OTROS]: 'Otros',
};

export default function PagosPage() {
  const [tab, setTab] = useState<'pagos' | 'gastos'>('pagos');

  return (
    <div className="space-y-4">
      <div className="flex gap-1 bg-white border border-gray-300 rounded-md p-1 w-fit print:hidden">
        {(['pagos', 'gastos'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`min-h-9 px-4 text-sm font-semibold rounded ${tab === t ? 'bg-navy text-white' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            {t === 'pagos' ? 'Pagos' : 'Gastos'}
          </button>
        ))}
      </div>
      {tab === 'pagos' ? <PagosTab /> : <GastosTab />}
    </div>
  );
}

function PagosTab() {
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

function inicioDeSemana(): string {
  const d = new Date();
  const diff = (d.getDay() + 6) % 7; // lunes = 0
  d.setDate(d.getDate() - diff);
  return aISO(d);
}

function inicioDeMes(): string {
  const d = new Date();
  return aISO(new Date(d.getFullYear(), d.getMonth(), 1));
}

function GastosTab() {
  const [desde, setDesde] = useState(hoyISO());
  const [hasta, setHasta] = useState(hoyISO());
  const [gastos, setGastos] = useState<GastoDTO[] | null>(null);
  const [resumen, setResumen] = useState<ResumenGastosDTO | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mostrarRecibo, setMostrarRecibo] = useState(false);
  const [exportando, setExportando] = useState<string | null>(null);

  const [form, setForm] = useState({ categoria: GastoCategoria.OTROS as GastoCategoria, montoQ: '', descripcion: '', fecha: hoyISO() });
  const [errorForm, setErrorForm] = useState<string | null>(null);

  async function cargar() {
    setCargando(true);
    setError(null);
    try {
      const [listado, resumenGastos] = await Promise.all([
        api.listarGastos({ desde, hasta }),
        api.resumenGastos(desde, hasta),
      ]);
      setGastos(listado);
      setResumen(resumenGastos);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudieron cargar los gastos.');
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
  }, [desde, hasta]);

  async function agregarGasto() {
    if (!form.montoQ || Number(form.montoQ) <= 0) {
      setErrorForm('El monto debe ser mayor a 0.');
      return;
    }
    setErrorForm(null);
    try {
      await api.crearGasto({
        categoria: form.categoria,
        montoQ: Number(form.montoQ),
        fecha: form.fecha,
        ...(form.descripcion.trim() ? { descripcion: form.descripcion.trim() } : {}),
      });
      setForm({ categoria: GastoCategoria.OTROS, montoQ: '', descripcion: '', fecha: hoyISO() });
      await cargar();
    } catch (err) {
      setErrorForm(err instanceof ApiError ? err.message : 'No se pudo agregar el gasto.');
    }
  }

  async function eliminarGasto(id: string) {
    try {
      await api.eliminarGasto(id);
      await cargar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo eliminar el gasto.');
    }
  }

  async function exportar(formato: 'excel' | 'pdf') {
    setExportando(formato);
    try {
      const ext = formato === 'excel' ? 'xlsx' : 'pdf';
      await api.descargarExportacion(`/gastos/exportar?desde=${desde}&hasta=${hasta}&formato=${formato}`, `Reporte de Gastos ${hoyISO()}.${ext}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo generar el archivo.');
    } finally {
      setExportando(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <h1 className="text-lg font-bold text-navy">Gastos</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1">
            <button onClick={() => { setDesde(hoyISO()); setHasta(hoyISO()); }} className="min-h-9 px-3 text-xs font-semibold rounded-md border border-gray-300 text-gray-600 hover:bg-gray-100">Hoy</button>
            <button onClick={() => { setDesde(inicioDeSemana()); setHasta(hoyISO()); }} className="min-h-9 px-3 text-xs font-semibold rounded-md border border-gray-300 text-gray-600 hover:bg-gray-100">Esta semana</button>
            <button onClick={() => { setDesde(inicioDeMes()); setHasta(hoyISO()); }} className="min-h-9 px-3 text-xs font-semibold rounded-md border border-gray-300 text-gray-600 hover:bg-gray-100">Este mes</button>
          </div>
          <input type="date" aria-label="Desde" value={desde} onChange={(e) => setDesde(e.target.value)} className="min-h-11 rounded-md border border-gray-500 px-3 text-sm" />
          <span className="text-sm text-gray-500">a</span>
          <input type="date" aria-label="Hasta" value={hasta} onChange={(e) => setHasta(e.target.value)} className="min-h-11 rounded-md border border-gray-500 px-3 text-sm" />
          <button
            onClick={() => setMostrarRecibo(true)}
            disabled={!gastos || gastos.length === 0}
            className="min-h-11 px-4 bg-navy text-white rounded-md text-sm font-semibold disabled:opacity-50"
          >
            Imprimir reporte
          </button>
          <button onClick={() => exportar('excel')} disabled={exportando !== null} className="min-h-11 px-3 bg-white border border-gray-300 rounded-md text-sm font-semibold disabled:opacity-50">
            {exportando === 'excel' ? 'Generando...' : 'Excel'}
          </button>
          <button onClick={() => exportar('pdf')} disabled={exportando !== null} className="min-h-11 px-3 bg-white border border-gray-300 rounded-md text-sm font-semibold disabled:opacity-50">
            {exportando === 'pdf' ? 'Generando...' : 'PDF'}
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-600 print:hidden">{error}</p>}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 space-y-3 print:hidden">
        <h2 className="text-sm font-bold text-navy">Agregar gasto</h2>
        <div className="flex flex-wrap gap-2 items-end">
          <select
            value={form.categoria}
            onChange={(e) => setForm({ ...form, categoria: e.target.value as GastoCategoria })}
            className="min-h-10 rounded-md border border-gray-400 px-2 text-sm bg-white"
          >
            {Object.values(GastoCategoria).map((c) => (
              <option key={c} value={c}>{ETIQUETA_GASTO_CATEGORIA[c]}</option>
            ))}
          </select>
          <input
            type="number"
            placeholder="Monto Q"
            value={form.montoQ}
            onChange={(e) => setForm({ ...form, montoQ: e.target.value })}
            className="min-h-10 w-28 rounded-md border border-gray-400 px-2 text-sm"
          />
          <input
            type="text"
            placeholder="Descripcion (opcional)"
            value={form.descripcion}
            onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
            className="min-h-10 flex-1 min-w-[160px] rounded-md border border-gray-400 px-2 text-sm"
          />
          <input
            type="date"
            value={form.fecha}
            onChange={(e) => setForm({ ...form, fecha: e.target.value })}
            className="min-h-10 rounded-md border border-gray-400 px-2 text-sm"
          />
          <button onClick={agregarGasto} className="min-h-10 px-3 bg-navy text-white rounded-md text-sm font-semibold">
            Agregar gasto
          </button>
        </div>
        {errorForm && <p className="text-xs text-red-600">{errorForm}</p>}
      </div>

      {cargando || !gastos ? (
        <p className="text-sm text-gray-500 print:hidden">Cargando...</p>
      ) : gastos.length === 0 ? (
        <p className="text-sm text-gray-500 print:hidden">No hay gastos en este rango de fechas.</p>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-x-auto print:hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-gray-200">
                <th className="px-4 py-2 font-semibold">Fecha</th>
                <th className="px-4 py-2 font-semibold">Categoria</th>
                <th className="px-4 py-2 font-semibold">Descripcion</th>
                <th className="px-4 py-2 font-semibold text-right">Monto</th>
                <th className="px-4 py-2 font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {gastos.map((g) => (
                <tr key={g.id} className="border-b border-gray-100 last:border-b-0">
                  <td className="px-4 py-2 whitespace-nowrap text-gray-600">{g.fecha.slice(0, 10)}</td>
                  <td className="px-4 py-2">{ETIQUETA_GASTO_CATEGORIA[g.categoria]}</td>
                  <td className="px-4 py-2 text-gray-500 truncate max-w-[220px]">{g.descripcion ?? '—'}</td>
                  <td className="px-4 py-2 text-right font-semibold">Q{g.montoQ.toLocaleString('es-GT', { minimumFractionDigits: 2 })}</td>
                  <td className="px-4 py-2 text-right">
                    <button onClick={() => eliminarGasto(g.id)} className="text-xs font-medium text-red-600 hover:underline">Eliminar</button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3} className="px-4 py-2 text-right font-bold text-navy">Total</td>
                <td className="px-4 py-2 text-right font-bold text-navy">Q{(resumen?.totalQ ?? 0).toLocaleString('es-GT', { minimumFractionDigits: 2 })}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {resumen && resumen.porCategoria.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 flex flex-wrap gap-4 print:hidden">
          {resumen.porCategoria.map((c) => (
            <div key={c.categoria} className="text-sm">
              <p className="text-xs text-gray-500">{ETIQUETA_GASTO_CATEGORIA[c.categoria]}</p>
              <p className="font-bold text-navy">Q{c.totalQ.toLocaleString('es-GT', { minimumFractionDigits: 2 })} <span className="text-xs text-gray-400">({c.cantidad})</span></p>
            </div>
          ))}
        </div>
      )}

      {mostrarRecibo && gastos && (
        <>
          <ReciboImprimible
            titulo="Reporte de gastos"
            subtitulo={desde === hasta ? desde : `${desde} a ${hasta}`}
            lineas={gastos.map((g) => ({
              label: ETIQUETA_GASTO_CATEGORIA[g.categoria],
              detalle: g.descripcion ?? '',
              valor: `Q${g.montoQ}`,
            }))}
            totalLabel="Total gastado"
            totalQ={resumen?.totalQ ?? 0}
          />
          <div className="print:hidden fixed bottom-4 right-4 flex gap-2 z-50">
            <button onClick={() => imprimirConNombre(`Reporte de Gastos ${hoyISO()}`)} className="min-h-11 px-4 bg-navy text-white rounded-md text-sm font-semibold shadow-lg">
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

// El navegador sugiere document.title como nombre por defecto al "Guardar como PDF"
// desde el dialogo de impresion; se restaura al cerrar para no afectar la pestana.
function imprimirConNombre(nombre: string) {
  const original = document.title;
  document.title = nombre;
  const restaurar = () => {
    document.title = original;
    window.removeEventListener('afterprint', restaurar);
  };
  window.addEventListener('afterprint', restaurar);
  window.print();
}
