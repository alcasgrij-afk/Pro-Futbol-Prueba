'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ArbitroDTO, ConceptoPagoDTO } from '@profutbol/shared-types';
import { api, ApiError } from '../lib/api-client';

/**
 * Catalogos de los cobros manuales: arbitros y conceptos de pago. Es donde el
 * admin renombra los placeholders ("Otro 1/2") sin necesidad de un deploy —
 * los recibos ya emitidos conservan el nombre con el que se cobraron
 * (Pago.conceptoSnapshot). No hay borrado: se desactiva, porque los pagos
 * historicos referencian estos registros.
 *
 * Escribir requiere rol ADMIN (lo exige el backend); recepcion ve el listado.
 */
export default function CatalogosCobroTab() {
  const [arbitros, setArbitros] = useState<ArbitroDTO[] | null>(null);
  const [conceptos, setConceptos] = useState<ConceptoPagoDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nombreArbitro, setNombreArbitro] = useState('');
  const [telefonoArbitro, setTelefonoArbitro] = useState('');
  const [nombreConcepto, setNombreConcepto] = useState('');
  const [editando, setEditando] = useState<{ tipo: 'arbitro' | 'concepto'; id: string; nombre: string } | null>(null);

  const cargar = useCallback(() => {
    api
      .listarArbitros()
      .then(setArbitros)
      .catch(() => setArbitros([]));
    api
      .listarConceptosPago()
      .then(setConceptos)
      .catch(() => setConceptos([]));
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function ejecutar(accion: () => Promise<unknown>) {
    setError(null);
    try {
      await accion();
      setEditando(null);
      cargar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar el cambio.');
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-bold text-navy">Catálogos de cobro</h1>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <section className="space-y-2">
        <h2 className="text-sm font-bold text-navy">Árbitros</h2>
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            placeholder="Nombre del árbitro"
            value={nombreArbitro}
            onChange={(e) => setNombreArbitro(e.target.value)}
            className="min-h-11 flex-1 min-w-[180px] rounded-md border border-gray-400 px-3 text-sm"
          />
          <input
            type="tel"
            inputMode="numeric"
            placeholder="Teléfono (opcional)"
            value={telefonoArbitro}
            onChange={(e) => setTelefonoArbitro(e.target.value.replace(/\D/g, '').slice(0, 8))}
            className="min-h-11 w-40 rounded-md border border-gray-400 px-3 text-sm"
          />
          <button
            onClick={() =>
              ejecutar(async () => {
                await api.crearArbitro({
                  nombre: nombreArbitro.trim(),
                  ...(telefonoArbitro.trim() ? { telefono: telefonoArbitro.trim() } : {}),
                });
                setNombreArbitro('');
                setTelefonoArbitro('');
              })
            }
            disabled={nombreArbitro.trim().length < 2}
            className="min-h-11 px-4 bg-navy text-white rounded-md text-sm font-semibold disabled:opacity-50"
          >
            Agregar
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 divide-y divide-gray-100">
          {arbitros === null ? (
            <p className="px-4 py-3 text-sm text-gray-500">Cargando...</p>
          ) : arbitros.length === 0 ? (
            <p className="px-4 py-3 text-sm text-gray-500">Sin árbitros registrados.</p>
          ) : (
            arbitros.map((a) => (
              <div key={a.id} className="flex items-center gap-2 px-4 py-2 text-sm">
                {editando?.tipo === 'arbitro' && editando.id === a.id ? (
                  <>
                    <input
                      type="text"
                      value={editando.nombre}
                      onChange={(e) => setEditando({ ...editando, nombre: e.target.value })}
                      className="min-h-9 flex-1 rounded-md border border-gray-400 px-2 text-sm"
                    />
                    <button
                      onClick={() => ejecutar(() => api.actualizarArbitro(a.id, { nombre: editando.nombre.trim() }))}
                      className="min-h-9 px-3 bg-navy text-white rounded-md text-xs font-semibold"
                    >
                      Guardar
                    </button>
                    <button onClick={() => setEditando(null)} className="min-h-9 px-3 text-xs text-gray-600">
                      Cancelar
                    </button>
                  </>
                ) : (
                  <>
                    <span className={`flex-1 ${a.activo ? '' : 'text-gray-400 line-through'}`}>
                      {a.nombre}
                      {a.telefono ? <span className="text-gray-500"> · {a.telefono}</span> : null}
                    </span>
                    <button
                      onClick={() => setEditando({ tipo: 'arbitro', id: a.id, nombre: a.nombre })}
                      className="min-h-9 px-3 text-xs font-semibold text-navy hover:underline"
                    >
                      Renombrar
                    </button>
                    <button
                      onClick={() => ejecutar(() => api.actualizarArbitro(a.id, { activo: !a.activo }))}
                      className="min-h-9 px-3 text-xs font-semibold text-gray-600 hover:underline"
                    >
                      {a.activo ? 'Desactivar' : 'Activar'}
                    </button>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-bold text-navy">Conceptos de cobro</h2>
        <p className="text-xs text-gray-500">
          Renombrar un concepto no cambia los recibos ya emitidos: cada pago guarda el nombre con el que se cobró.
        </p>
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            placeholder="Nuevo concepto"
            value={nombreConcepto}
            onChange={(e) => setNombreConcepto(e.target.value)}
            className="min-h-11 flex-1 min-w-[180px] rounded-md border border-gray-400 px-3 text-sm"
          />
          <button
            onClick={() =>
              ejecutar(async () => {
                await api.crearConceptoPago({ nombre: nombreConcepto.trim() });
                setNombreConcepto('');
              })
            }
            disabled={nombreConcepto.trim().length < 2}
            className="min-h-11 px-4 bg-navy text-white rounded-md text-sm font-semibold disabled:opacity-50"
          >
            Agregar
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 divide-y divide-gray-100">
          {conceptos === null ? (
            <p className="px-4 py-3 text-sm text-gray-500">Cargando...</p>
          ) : conceptos.length === 0 ? (
            <p className="px-4 py-3 text-sm text-gray-500">Sin conceptos registrados.</p>
          ) : (
            conceptos.map((c) => (
              <div key={c.id} className="flex items-center gap-2 px-4 py-2 text-sm">
                {editando?.tipo === 'concepto' && editando.id === c.id ? (
                  <>
                    <input
                      type="text"
                      value={editando.nombre}
                      onChange={(e) => setEditando({ ...editando, nombre: e.target.value })}
                      className="min-h-9 flex-1 rounded-md border border-gray-400 px-2 text-sm"
                    />
                    <button
                      onClick={() =>
                        ejecutar(() => api.actualizarConceptoPago(c.id, { nombre: editando.nombre.trim() }))
                      }
                      className="min-h-9 px-3 bg-navy text-white rounded-md text-xs font-semibold"
                    >
                      Guardar
                    </button>
                    <button onClick={() => setEditando(null)} className="min-h-9 px-3 text-xs text-gray-600">
                      Cancelar
                    </button>
                  </>
                ) : (
                  <>
                    <span className={`flex-1 ${c.activo ? '' : 'text-gray-400 line-through'}`}>{c.nombre}</span>
                    <button
                      onClick={() => setEditando({ tipo: 'concepto', id: c.id, nombre: c.nombre })}
                      className="min-h-9 px-3 text-xs font-semibold text-navy hover:underline"
                    >
                      Renombrar
                    </button>
                    <button
                      onClick={() => ejecutar(() => api.actualizarConceptoPago(c.id, { activo: !c.activo }))}
                      className="min-h-9 px-3 text-xs font-semibold text-gray-600 hover:underline"
                    >
                      {c.activo ? 'Desactivar' : 'Activar'}
                    </button>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
