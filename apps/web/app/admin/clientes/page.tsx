'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ClienteListadoDTO } from '@profutbol/shared-types';
import { ApiError, api } from '../../../lib/api-client';
import ConfirmarModal from '../../../components/ConfirmarModal';
import Skeleton from '../../../components/Skeleton';

const FORM_VACIO = { nombre: '', telefono: '', email: '', dpi: '' };

export default function ClientesPage() {
  const [clientes, setClientes] = useState<ClienteListadoDTO[]>([]);
  const [cargando, setCargando] = useState(true);
  const [q, setQ] = useState('');
  const [mostrarInactivos, setMostrarInactivos] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editando, setEditando] = useState<ClienteListadoDTO | null>(null);
  const [form, setForm] = useState(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);

  const [desactivando, setDesactivando] = useState<ClienteListadoDTO | null>(null);
  const [quitandoVip, setQuitandoVip] = useState<ClienteListadoDTO | null>(null);
  const [accionCargando, setAccionCargando] = useState(false);
  const [vipCargando, setVipCargando] = useState<string | null>(null);

  const cargar = useCallback(() => {
    setCargando(true);
    setError(null);
    api
      .listarClientes({ q: q.trim() || undefined, activo: mostrarInactivos ? undefined : true })
      .then(setClientes)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudieron cargar los clientes.'))
      .finally(() => setCargando(false));
  }, [q, mostrarInactivos]);

  // Buscador con debounce: evita disparar una consulta por cada tecla.
  useEffect(() => {
    const t = setTimeout(cargar, 300);
    return () => clearTimeout(t);
  }, [cargar]);

  function iniciarEdicion(c: ClienteListadoDTO) {
    setEditando(c);
    setForm({ nombre: c.nombre, telefono: c.telefono, email: c.email ?? '', dpi: c.dpi ?? '' });
    setError(null);
  }

  function cancelarForm() {
    setEditando(null);
    setForm(FORM_VACIO);
    setError(null);
  }

  async function guardar() {
    if (!editando) return;
    setError(null);
    setGuardando(true);
    try {
      await api.actualizarCliente(editando.id, {
        nombre: form.nombre.trim(),
        telefono: form.telefono.trim(),
        email: form.email.trim() || undefined,
        dpi: form.dpi.trim() || undefined,
      });
      cancelarForm();
      cargar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo actualizar el cliente.');
    } finally {
      setGuardando(false);
    }
  }

  async function confirmarDesactivar() {
    if (!desactivando) return;
    setAccionCargando(true);
    try {
      await (desactivando.activo ? api.desactivarCliente(desactivando.id) : api.activarCliente(desactivando.id));
      setDesactivando(null);
      cargar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo actualizar el estado del cliente.');
      setDesactivando(null);
    } finally {
      setAccionCargando(false);
    }
  }

  async function toggleVip(c: ClienteListadoDTO) {
    setVipCargando(c.id);
    setError(null);
    try {
      if (c.esValorado) {
        await api.quitarValorado(c.id);
      } else {
        await api.otorgarValorado(c.id);
      }
      cargar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo actualizar el estatus VIP.');
    } finally {
      setVipCargando(null);
    }
  }

  async function confirmarQuitarVip() {
    if (!quitandoVip) return;
    setAccionCargando(true);
    try {
      await api.quitarValorado(quitandoVip.id);
      setQuitandoVip(null);
      cargar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo quitar el estatus VIP.');
      setQuitandoVip(null);
    } finally {
      setAccionCargando(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Clientes</h1>
        <div className="flex items-center gap-3 text-sm">
          <input
            type="text"
            placeholder="Buscar por nombre o teléfono..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="min-h-11 w-64 rounded-md border border-gray-400 px-3 text-sm"
          />
          <label className="flex items-center gap-2 text-gray-600 whitespace-nowrap">
            <input type="checkbox" checked={mostrarInactivos} onChange={(e) => setMostrarInactivos(e.target.checked)} />
            Mostrar inactivos
          </label>
        </div>
      </div>

      <p className="text-xs text-gray-500">
        La promoción &ldquo;6ta reserva gratis&rdquo; aplica a clientes marcados como VIP: cada 6ta reserva
        confirmada (contando desde que es VIP y hacia adelante en ciclos de 6) le toca gratis en Caja.
      </p>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      {editando && (
        <div className="max-w-md space-y-3 bg-white border border-gray-200 rounded-lg shadow-sm p-4">
          <h2 className="text-sm font-bold text-navy">Editar cliente</h2>
          <label className="block text-xs font-medium text-gray-600">
            Nombre
            <input
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              className="mt-1 w-full min-h-11 rounded-md border border-gray-400 px-3 text-sm"
            />
          </label>
          <label className="block text-xs font-medium text-gray-600">
            Teléfono
            <input
              value={form.telefono}
              onChange={(e) => setForm({ ...form, telefono: e.target.value })}
              className="mt-1 w-full min-h-11 rounded-md border border-gray-400 px-3 text-sm"
            />
          </label>
          <label className="block text-xs font-medium text-gray-600">
            Email (opcional)
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="mt-1 w-full min-h-11 rounded-md border border-gray-400 px-3 text-sm"
            />
          </label>
          <label className="block text-xs font-medium text-gray-600">
            DPI (opcional)
            <input
              value={form.dpi}
              onChange={(e) => setForm({ ...form, dpi: e.target.value })}
              className="mt-1 w-full min-h-11 rounded-md border border-gray-400 px-3 text-sm"
            />
          </label>
          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={guardar}
              disabled={guardando || !form.nombre.trim() || !form.telefono.trim()}
              className="min-h-11 px-4 bg-navy text-white rounded-md text-sm font-semibold disabled:opacity-50"
            >
              {guardando ? 'Guardando...' : 'Guardar cambios'}
            </button>
            <button
              onClick={cancelarForm}
              disabled={guardando}
              className="min-h-11 px-4 border border-gray-300 text-gray-700 rounded-md text-sm font-semibold hover:bg-gray-50 disabled:opacity-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {cargando ? (
        <div className="border border-gray-200 rounded-lg overflow-x-auto" aria-busy="true">
          <table className="w-full text-sm">
            <tbody>
              {Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-t border-gray-100 first:border-0">
                  <td className="px-4 py-3"><Skeleton className="h-4 w-36" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-28" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-5 w-16 rounded-full" /></td>
                  <td className="px-4 py-3 text-right"><Skeleton className="h-4 w-24 ml-auto" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : clientes.length === 0 ? (
        <p className="text-gray-500">No hay clientes que coincidan.</p>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-left">
                <th className="px-4 py-2">Nombre</th>
                <th className="px-4 py-2">Teléfono</th>
                <th className="px-4 py-2">Email</th>
                <th className="px-4 py-2">Reservas confirmadas</th>
                <th className="px-4 py-2">VIP</th>
                <th className="px-4 py-2">Estado</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {clientes.map((c) => (
                <tr key={c.id} className="border-t border-gray-100">
                  <td className="px-4 py-2 font-medium">{c.nombre}</td>
                  <td className="px-4 py-2">{c.telefono}</td>
                  <td className="px-4 py-2 text-gray-500">{c.email ?? '—'}</td>
                  <td className="px-4 py-2">{c.totalReservas}</td>
                  <td className="px-4 py-2">
                    {c.esValorado ? (
                      <div className="space-y-0.5">
                        <span className="text-xs font-semibold text-amber-800 bg-amber-100 rounded-full px-2 py-0.5">
                          VIP
                        </span>
                        {c.siguienteEsGratis && (
                          <div className="text-[11px] text-green-700 font-semibold">La próxima es gratis</div>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`text-xs rounded-full px-2 py-0.5 ${c.activo ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}`}
                    >
                      {c.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right space-x-2 whitespace-nowrap">
                    <button
                      onClick={() => iniciarEdicion(c)}
                      className="text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded px-2 py-1 hover:bg-blue-100"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => (c.esValorado ? setQuitandoVip(c) : toggleVip(c))}
                      disabled={vipCargando === c.id}
                      className="text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1 hover:bg-amber-100 disabled:opacity-50"
                    >
                      {vipCargando === c.id ? '...' : c.esValorado ? 'Quitar VIP' : 'Otorgar VIP'}
                    </button>
                    <button
                      onClick={() => setDesactivando(c)}
                      className="text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1 hover:bg-red-100"
                    >
                      {c.activo ? 'Desactivar' : 'Activar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {desactivando && (
        <ConfirmarModal
          titulo={desactivando.activo ? 'Desactivar cliente' : 'Activar cliente'}
          mensaje={
            desactivando.activo
              ? `¿Desactivar a ${desactivando.nombre}? Deja de aparecer en la lista y en nuevas reservas, pero su historial se conserva.`
              : `¿Reactivar a ${desactivando.nombre}?`
          }
          onConfirmar={confirmarDesactivar}
          onCancelar={() => setDesactivando(null)}
          cargando={accionCargando}
          variante={desactivando.activo ? 'peligro' : 'primario'}
        />
      )}

      {quitandoVip && (
        <ConfirmarModal
          titulo="Quitar estatus VIP"
          mensaje={`¿Quitarle el estatus VIP a ${quitandoVip.nombre}? Deja de acumular hacia la 6ta reserva gratis.`}
          onConfirmar={confirmarQuitarVip}
          onCancelar={() => setQuitandoVip(null)}
          cargando={accionCargando}
          variante="primario"
        />
      )}
    </div>
  );
}
