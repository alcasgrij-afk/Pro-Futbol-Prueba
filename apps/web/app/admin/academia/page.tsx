'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlumnoDTO } from '@profutbol/shared-types';
import { ApiError, api } from '../../../lib/api-client';
import { hoyISOAnios } from '../../../lib/fechas';
import ConfirmarModal from '../../../components/ConfirmarModal';
import Skeleton from '../../../components/Skeleton';

export default function AcademiaPage() {
  const [alumnos, setAlumnos] = useState<AlumnoDTO[]>([]);
  const [cargando, setCargando] = useState(true);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [form, setForm] = useState({
    nombre: '',
    fechaNacimiento: '',
    categoria: '',
    encargadoNombre: '',
    encargadoTelefono: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  // Alumno a desactivar, pendiente de confirmacion (en vez de confirm() nativo)
  const [desactivando, setDesactivando] = useState<AlumnoDTO | null>(null);
  const [accionCargando, setAccionCargando] = useState(false);

  function cargar() {
    setCargando(true);
    api
      .listarAlumnos({ activo: true })
      .then(setAlumnos)
      .catch(() => setAlumnos([]))
      .finally(() => setCargando(false));
  }

  useEffect(cargar, []);

  async function crear() {
    setError(null);
    setGuardando(true);
    try {
      await api.crearAlumno({ ...form, categoria: form.categoria || undefined });
      setMostrarForm(false);
      setForm({ nombre: '', fechaNacimiento: '', categoria: '', encargadoNombre: '', encargadoTelefono: '' });
      cargar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo registrar al alumno.');
    } finally {
      setGuardando(false);
    }
  }

  async function confirmarDesactivar() {
    if (!desactivando) return;
    setAccionCargando(true);
    try {
      await api.desactivarAlumno(desactivando.id);
      setDesactivando(null);
      cargar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo desactivar al alumno.');
      setDesactivando(null);
    } finally {
      setAccionCargando(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Academia · Alumnos</h1>
        <div className="flex items-center gap-3 text-sm">
          <Link href="/admin/academia/asistencia" className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded-md font-semibold hover:bg-gray-50 transition active:scale-[0.98]">
            Tomar asistencia
          </Link>
          <Link href="/admin/academia/mensualidades" className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded-md font-semibold hover:bg-gray-50 transition active:scale-[0.98]">
            Mensualidades
          </Link>
          <button
            onClick={() => setMostrarForm((v) => !v)}
            className="px-3 py-1.5 bg-navy text-white rounded-md font-semibold transition-transform active:scale-[0.98]"
          >
            {mostrarForm ? 'Cancelar' : '+ Nuevo alumno'}
          </button>
        </div>
      </div>

      {mostrarForm && (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 space-y-4 max-w-xl">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1">
              <span className="block text-sm text-gray-700">Nombre del alumno *</span>
              <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            </label>
            <label className="space-y-1">
              <span className="block text-sm text-gray-700">Fecha de nacimiento *</span>
              <input type="date" value={form.fechaNacimiento} min={hoyISOAnios(-60)} max={hoyISOAnios(0)} onChange={(e) => setForm({ ...form, fechaNacimiento: e.target.value })} className="w-full rounded bg-white px-3 py-2 min-h-11 text-sm text-navy" />
            </label>
            <label className="space-y-1">
              <span className="block text-sm text-gray-700">Categoría (vacío = sugerida por edad)</span>
              <input value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            </label>
            <label className="space-y-1">
              <span className="block text-sm text-gray-700">Nombre del encargado *</span>
              <input value={form.encargadoNombre} onChange={(e) => setForm({ ...form, encargadoNombre: e.target.value })} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            </label>
            <label className="space-y-1">
              <span className="block text-sm text-gray-700">Teléfono del encargado *</span>
              <input value={form.encargadoTelefono} onChange={(e) => setForm({ ...form, encargadoTelefono: e.target.value })} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            </label>
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button
            onClick={crear}
            disabled={guardando || !form.nombre || !form.fechaNacimiento || !form.encargadoNombre || !form.encargadoTelefono}
            className="px-4 py-2 bg-navy text-white rounded-md text-sm font-semibold disabled:opacity-50 transition-transform active:scale-[0.98]"
          >
            {guardando ? 'Guardando...' : 'Registrar alumno'}
          </button>
        </div>
      )}

      {cargando ? (
        <div className="border border-gray-200 rounded-lg overflow-x-auto" aria-busy="true">
          <table className="w-full text-sm">
            <tbody>
              {Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-t border-gray-100 first:border-0">
                  <td className="px-4 py-3"><Skeleton className="h-4 w-36" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-5 w-20 rounded-full" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-32" /></td>
                  <td className="px-4 py-3 text-right"><Skeleton className="h-4 w-16 ml-auto" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : alumnos.length === 0 ? (
        <p className="text-gray-500">No hay alumnos registrados todavía.</p>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-left">
                <th className="px-4 py-2">Nombre</th>
                <th className="px-4 py-2">Categoría</th>
                <th className="px-4 py-2">Encargado</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {alumnos.map((a) => (
                <tr key={a.id} className="border-t border-gray-100">
                  <td className="px-4 py-2 font-medium">{a.nombre}</td>
                  <td className="px-4 py-2">
                    <span className="text-xs bg-yellow-100 text-yellow-800 rounded-full px-2 py-0.5">{a.categoria}</span>
                  </td>
                  <td className="px-4 py-2">
                    {a.encargadoNombre}
                    <div className="text-xs text-gray-500">{a.encargadoTelefono}</div>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button onClick={() => setDesactivando(a)} className="text-xs text-red-600 hover:underline">Desactivar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {desactivando && (
        <ConfirmarModal
          titulo="Desactivar alumno"
          mensaje={`¿Desactivar a ${desactivando.nombre}? Dejará de recibir mensualidades. Esta acción no se puede deshacer.`}
          onConfirmar={confirmarDesactivar}
          onCancelar={() => setDesactivando(null)}
          cargando={accionCargando}
          variante="peligro"
        />
      )}
    </div>
  );
}
