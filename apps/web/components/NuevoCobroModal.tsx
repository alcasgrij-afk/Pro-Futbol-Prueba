'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  GatewayPago,
  TipoPagoReferencia,
  type AcademiaMensualidadDTO,
  type ArbitroDTO,
  type ConceptoPagoDTO,
} from '@profutbol/shared-types';
import { api, ApiError, type PagoDetalle } from '../lib/api-client';

/**
 * Cobro en sede de todo lo que NO es una reserva (las reservas se cobran solo
 * desde Caja): mensualidad de academia, servicio de arbitraje y los conceptos
 * del catalogo editable.
 *
 * El flujo es a prueba de errores a proposito: se elige el concepto, se llena
 * lo minimo, y antes de cobrar se muestra una linea de resumen con lo que va a
 * quedar registrado. El boton no se habilita hasta que todo esta valido.
 */

type Concepto =
  | { kind: 'MENSUALIDAD' }
  | { kind: 'ARBITRO' }
  | { kind: 'MANUAL'; id: string; nombre: string };

const MESES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

function nombreAlumno(m: AcademiaMensualidadDTO): string {
  return `${m.alumno?.nombres ?? ''} ${m.alumno?.apellidos ?? ''}`.trim() || 'Alumno sin nombre';
}

export default function NuevoCobroModal({
  onClose,
  onCobrado,
}: {
  onClose: () => void;
  onCobrado: (detalle: PagoDetalle) => void;
}) {
  const [conceptos, setConceptos] = useState<ConceptoPagoDTO[]>([]);
  const [concepto, setConcepto] = useState<Concepto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cobrando, setCobrando] = useState(false);

  const [metodoPago, setMetodoPago] = useState<GatewayPago.EFECTIVO | GatewayPago.TARJETA>(GatewayPago.EFECTIVO);
  const [codigoAutorizacion, setCodigoAutorizacion] = useState('');

  // Monto y nota: arbitraje y conceptos manuales. En academia el monto lo fija
  // la mensualidad (no se edita a mano).
  const [monto, setMonto] = useState('');
  const [nota, setNota] = useState('');

  const hoy = new Date();
  const [mes, setMes] = useState(hoy.getMonth() + 1);
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [mensualidades, setMensualidades] = useState<AcademiaMensualidadDTO[] | null>(null);
  const [busquedaAlumno, setBusquedaAlumno] = useState('');
  const [mensualidadId, setMensualidadId] = useState('');

  const [arbitros, setArbitros] = useState<ArbitroDTO[] | null>(null);
  const [arbitroId, setArbitroId] = useState('');
  const [nuevoArbitro, setNuevoArbitro] = useState<{ nombre: string; telefono: string } | null>(null);

  useEffect(() => {
    api
      .listarConceptosPago(true)
      .then(setConceptos)
      .catch(() => setConceptos([]));
  }, []);

  // El selector de alumno solo existe cuando el concepto es academia; al
  // cambiar de concepto se limpia todo para que nunca quede una seleccion
  // "pegada" del concepto anterior.
  useEffect(() => {
    setError(null);
    setMonto('');
    setNota('');
    setMensualidadId('');
    setBusquedaAlumno('');
    setArbitroId('');
    setNuevoArbitro(null);

    if (concepto?.kind === 'MENSUALIDAD') {
      setMensualidades(null);
      api
        .listarMensualidadesDelMes(mes, anio)
        .then(setMensualidades)
        .catch(() => setError('No se pudieron cargar las mensualidades.'));
    }
    if (concepto?.kind === 'ARBITRO') {
      api
        .listarArbitros(true)
        .then(setArbitros)
        .catch(() => setArbitros([]));
    }
  }, [concepto, mes, anio]);

  const pendientes = useMemo(() => {
    const lista = (mensualidades ?? []).filter((m) => !m.pagada);
    const q = busquedaAlumno.trim().toLowerCase();
    return q ? lista.filter((m) => nombreAlumno(m).toLowerCase().includes(q)) : lista;
  }, [mensualidades, busquedaAlumno]);

  const mensualidadSeleccionada = useMemo(
    () => (mensualidades ?? []).find((m) => m.id === mensualidadId) ?? null,
    [mensualidades, mensualidadId],
  );

  const montoNumero = concepto?.kind === 'MENSUALIDAD' ? (mensualidadSeleccionada?.montoQ ?? 0) : Number(monto);

  const tarjetaValida = metodoPago !== GatewayPago.TARJETA || /^\d{6,12}$/.test(codigoAutorizacion);

  const referenciaLista =
    concepto?.kind === 'MENSUALIDAD'
      ? !!mensualidadSeleccionada
      : concepto?.kind === 'ARBITRO'
        ? !!arbitroId || !!nuevoArbitro?.nombre.trim()
        : concepto?.kind === 'MANUAL';

  const puedeCobrar = !!concepto && referenciaLista && montoNumero > 0 && tarjetaValida && !cobrando;

  const etiquetaConcepto =
    concepto?.kind === 'MENSUALIDAD'
      ? mensualidadSeleccionada
        ? `Mensualidad ${mensualidadSeleccionada.mes}/${mensualidadSeleccionada.anio} — ${nombreAlumno(mensualidadSeleccionada)}`
        : 'Mensualidad de academia'
      : concepto?.kind === 'ARBITRO'
        ? `Arbitraje — ${nuevoArbitro?.nombre.trim() || arbitros?.find((a) => a.id === arbitroId)?.nombre || ''}`
        : (concepto?.nombre ?? '');

  async function cobrar() {
    if (!concepto || !puedeCobrar) return;
    setCobrando(true);
    setError(null);
    try {
      const pos = metodoPago === GatewayPago.TARJETA ? { codigoAutorizacion } : {};

      if (concepto.kind === 'MENSUALIDAD') {
        const detalle = await api.cobrarMensualidadEnSede(mensualidadSeleccionada!.id, { metodoPago, ...pos });
        onCobrado(detalle);
        return;
      }

      let referenciaId = concepto.kind === 'ARBITRO' ? arbitroId : concepto.id;
      if (concepto.kind === 'ARBITRO' && nuevoArbitro?.nombre.trim()) {
        const creado = await api.crearArbitro({
          nombre: nuevoArbitro.nombre.trim(),
          ...(nuevoArbitro.telefono.trim() ? { telefono: nuevoArbitro.telefono.trim() } : {}),
        });
        referenciaId = creado.id;
      }

      const detalle = await api.cobrarManual({
        tipo: concepto.kind === 'ARBITRO' ? TipoPagoReferencia.ARBITRO : TipoPagoReferencia.MANUAL,
        referenciaId,
        montoQ: montoNumero,
        metodoPago,
        ...pos,
        ...(nota.trim() ? { nota: nota.trim() } : {}),
      });
      onCobrado(detalle);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo registrar el cobro.');
    } finally {
      setCobrando(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 py-6"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-navy">Nuevo cobro</h2>
          {concepto && (
            <button onClick={() => setConcepto(null)} className="text-xs font-semibold text-gray-500 hover:text-navy">
              Cambiar concepto
            </button>
          )}
        </div>

        {!concepto ? (
          <>
            <p className="text-xs text-gray-500">¿Qué se está cobrando?</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setConcepto({ kind: 'MENSUALIDAD' })}
                className="min-h-14 px-3 py-2 text-sm font-semibold rounded-lg border-2 border-orange-300 text-orange-800 bg-orange-50 hover:bg-orange-100"
              >
                Academia
                <span className="block text-[11px] font-normal opacity-80">mensualidad</span>
              </button>
              <button
                onClick={() => setConcepto({ kind: 'ARBITRO' })}
                className="min-h-14 px-3 py-2 text-sm font-semibold rounded-lg border-2 border-blue-300 text-blue-800 bg-blue-50 hover:bg-blue-100"
              >
                Árbitro
                <span className="block text-[11px] font-normal opacity-80">servicio de arbitraje</span>
              </button>
              {conceptos.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setConcepto({ kind: 'MANUAL', id: c.id, nombre: c.nombre })}
                  className="min-h-14 px-3 py-2 text-sm font-semibold rounded-lg border-2 border-gray-300 text-gray-700 bg-gray-50 hover:bg-gray-100"
                >
                  {c.nombre}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-gray-400">Las reservas de cancha se cobran desde Caja, no desde aquí.</p>
          </>
        ) : (
          <>
            {concepto.kind === 'MENSUALIDAD' && (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <label className="flex-1 block text-xs font-medium text-gray-600">
                    Mes
                    <select
                      value={mes}
                      onChange={(e) => setMes(Number(e.target.value))}
                      className="mt-1 w-full min-h-11 rounded-md border border-gray-400 px-2 text-sm bg-white"
                    >
                      {MESES.map((nombre, i) => (
                        <option key={nombre} value={i + 1}>
                          {nombre}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="w-24 block text-xs font-medium text-gray-600">
                    Año
                    <input
                      type="number"
                      value={anio}
                      onChange={(e) => setAnio(Number(e.target.value))}
                      className="mt-1 w-full min-h-11 rounded-md border border-gray-400 px-2 text-sm"
                    />
                  </label>
                </div>

                <label className="block text-xs font-medium text-gray-600">
                  Alumno
                  <input
                    type="text"
                    placeholder="Buscar por nombre..."
                    value={busquedaAlumno}
                    onChange={(e) => setBusquedaAlumno(e.target.value)}
                    className="mt-1 w-full min-h-11 rounded-md border border-gray-400 px-3 text-sm"
                  />
                </label>

                {mensualidades === null ? (
                  <p className="text-sm text-gray-500">Cargando mensualidades...</p>
                ) : pendientes.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    No hay mensualidades pendientes de {MESES[mes - 1]} {anio}
                    {busquedaAlumno.trim() ? ' para esa búsqueda' : ''}.
                  </p>
                ) : (
                  <div className="max-h-56 overflow-y-auto border border-gray-200 rounded-md divide-y divide-gray-100">
                    {pendientes.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => setMensualidadId(m.id)}
                        className={`w-full text-left px-3 py-2 text-sm ${mensualidadId === m.id ? 'bg-navy text-white' : 'hover:bg-gray-50'}`}
                      >
                        <span className="font-medium">{nombreAlumno(m)}</span>
                        <span
                          className={`block text-xs ${mensualidadId === m.id ? 'opacity-80' : 'text-gray-500'}`}
                        >
                          {m.mes}/{m.anio} · Q{m.montoQ}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {concepto.kind === 'ARBITRO' && (
              <div className="space-y-3">
                {!nuevoArbitro ? (
                  <>
                    <label className="block text-xs font-medium text-gray-600">
                      Árbitro
                      <select
                        value={arbitroId}
                        onChange={(e) => setArbitroId(e.target.value)}
                        className="mt-1 w-full min-h-11 rounded-md border border-gray-400 px-3 text-sm bg-white"
                      >
                        <option value="">Seleccionar...</option>
                        {(arbitros ?? []).map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.nombre}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      onClick={() => setNuevoArbitro({ nombre: '', telefono: '' })}
                      className="text-xs font-semibold text-navy hover:underline"
                    >
                      + Nuevo árbitro
                    </button>
                  </>
                ) : (
                  <div className="rounded-md border border-blue-200 bg-blue-50 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-blue-900">Nuevo árbitro</p>
                      <button onClick={() => setNuevoArbitro(null)} className="text-xs text-blue-700 hover:underline">
                        Usar uno existente
                      </button>
                    </div>
                    <input
                      type="text"
                      placeholder="Nombre"
                      value={nuevoArbitro.nombre}
                      onChange={(e) => setNuevoArbitro({ ...nuevoArbitro, nombre: e.target.value })}
                      className="w-full min-h-11 rounded-md border border-gray-400 px-3 text-sm"
                    />
                    <input
                      type="tel"
                      inputMode="numeric"
                      placeholder="Teléfono (opcional)"
                      value={nuevoArbitro.telefono}
                      onChange={(e) =>
                        setNuevoArbitro({ ...nuevoArbitro, telefono: e.target.value.replace(/\D/g, '').slice(0, 8) })
                      }
                      className="w-full min-h-11 rounded-md border border-gray-400 px-3 text-sm"
                    />
                  </div>
                )}
              </div>
            )}

            {concepto.kind !== 'MENSUALIDAD' ? (
              <>
                <label className="block text-xs font-medium text-gray-600">
                  Monto (Q)
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={monto}
                    onChange={(e) => setMonto(e.target.value)}
                    className="mt-1 w-full min-h-11 rounded-md border border-gray-400 px-3 text-sm"
                  />
                </label>
                <label className="block text-xs font-medium text-gray-600">
                  Nota (opcional)
                  <input
                    type="text"
                    maxLength={200}
                    placeholder="Ej. partido F7 18:00"
                    value={nota}
                    onChange={(e) => setNota(e.target.value)}
                    className="mt-1 w-full min-h-11 rounded-md border border-gray-400 px-3 text-sm"
                  />
                </label>
              </>
            ) : (
              mensualidadSeleccionada && (
                <p className="text-sm text-gray-700">
                  Monto de la mensualidad: <span className="font-bold">Q{mensualidadSeleccionada.montoQ}</span>
                </p>
              )
            )}

            <label className="block text-xs font-medium text-gray-600">
              Método de pago
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

            {/* Repaso explicito antes de cobrar: nada se registra sin que el
                personal vea exactamente que va a quedar cobrado. */}
            {puedeCobrar && (
              <div className="rounded-md border border-green-300 bg-green-50 p-3">
                <p className="text-sm text-green-900">
                  Vas a cobrar{' '}
                  <span className="font-bold">
                    Q{montoNumero.toLocaleString('es-GT', { minimumFractionDigits: 2 })}
                  </span>
                  {' · '}
                  {metodoPago === GatewayPago.EFECTIVO ? 'Efectivo' : 'Tarjeta'}
                  {' · '}
                  {etiquetaConcepto}
                </p>
                <p className="text-[11px] text-green-800 mt-1">
                  Al confirmar se imprime el recibo con su número de serie.
                </p>
              </div>
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={onClose}
                disabled={cobrando}
                className="min-h-11 px-3 text-sm font-medium text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={cobrar}
                disabled={!puedeCobrar}
                className="min-h-11 px-4 text-sm font-semibold text-white bg-navy rounded-md disabled:opacity-40"
              >
                {cobrando ? 'Cobrando...' : 'Cobrar e imprimir'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
