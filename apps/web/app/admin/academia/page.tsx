'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Camera, CalendarBlank, Phone, TShirt, User, UserCircle, UsersFour, MapPin } from '@phosphor-icons/react';
import { AlumnoDTO } from '@profutbol/shared-types';
import { ApiError, api } from '../../../lib/api-client';
import { hoyISOAnios } from '../../../lib/fechas';
import ConfirmarModal from '../../../components/ConfirmarModal';
import Skeleton from '../../../components/Skeleton';

const FORM_VACIO = { nombre: '', fechaNacimiento: '', categoria: '', encargadoNombre: '', encargadoTelefono: '' };

// ponytail: foto guardada solo en localStorage del navegador (prueba de
// concepto). Pendiente: persistirla en el backend (columna en Alumno +
// endpoint de upload) para que sea visible entre dispositivos y admins.
function fotoKey(alumnoId: string): string {
  return `profutbol_academia_foto_${alumnoId}`;
}

// Numero de miembro cosmetico: PF-{anio de registro}-{sufijo del id}. No hay
// sistema de validacion detras, es solo para que el carnet luzca completo.
function idMiembro(a: AlumnoDTO): string {
  const anio = new Date(a.creadoEn).getFullYear();
  const sufijo = a.id.replace(/[^a-zA-Z0-9]/g, '').slice(-5).toUpperCase();
  return `PF-${anio}-${sufijo}`;
}

// Color estable por categoria (no depende de una lista fija de "Sub-N": la
// categoria es texto libre, editable por el admin), asi cada una se distingue
// de un vistazo en la tabla.
const PALETA_CATEGORIA = [
  'bg-blue-100 text-blue-800',
  'bg-emerald-100 text-emerald-800',
  'bg-amber-100 text-amber-800',
  'bg-rose-100 text-rose-800',
  'bg-violet-100 text-violet-800',
  'bg-cyan-100 text-cyan-800',
  'bg-orange-100 text-orange-800',
  'bg-lime-100 text-lime-800',
];

function colorCategoria(categoria: string): string {
  let hash = 0;
  for (let i = 0; i < categoria.length; i++) hash = (hash * 31 + categoria.charCodeAt(i)) | 0;
  return PALETA_CATEGORIA[Math.abs(hash) % PALETA_CATEGORIA.length];
}

export default function AcademiaPage() {
  const [alumnos, setAlumnos] = useState<AlumnoDTO[]>([]);
  const [cargando, setCargando] = useState(true);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [form, setForm] = useState(FORM_VACIO);
  // Alumno que se esta editando (null = el formulario esta creando uno nuevo).
  const [editando, setEditando] = useState<AlumnoDTO | null>(null);
  const [foto, setFoto] = useState<string | null>(null);
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

  function abrirFormNuevo() {
    setForm(FORM_VACIO);
    setEditando(null);
    setFoto(null);
    setError(null);
    setMostrarForm(true);
  }

  function cancelarForm() {
    setMostrarForm(false);
    setEditando(null);
    setForm(FORM_VACIO);
    setFoto(null);
    setError(null);
  }

  function iniciarEdicion(a: AlumnoDTO) {
    setEditando(a);
    setForm({
      nombre: a.nombre,
      fechaNacimiento: a.fechaNacimiento.slice(0, 10),
      categoria: a.categoria,
      encargadoNombre: a.encargadoNombre,
      encargadoTelefono: a.encargadoTelefono,
    });
    setFoto(localStorage.getItem(fotoKey(a.id)));
    setError(null);
    setMostrarForm(true);
  }

  function manejarFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    if (!archivo || !editando) return;
    const lector = new FileReader();
    lector.onload = () => {
      const resultado = lector.result as string;
      setFoto(resultado);
      localStorage.setItem(fotoKey(editando.id), resultado);
    };
    lector.readAsDataURL(archivo);
  }

  async function guardar() {
    setError(null);
    setGuardando(true);
    try {
      if (editando) {
        await api.actualizarAlumno(editando.id, { ...form, categoria: form.categoria || undefined });
      } else {
        await api.crearAlumno({ ...form, categoria: form.categoria || undefined });
      }
      setMostrarForm(false);
      setEditando(null);
      setForm(FORM_VACIO);
      cargar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : `No se pudo ${editando ? 'actualizar' : 'registrar'} al alumno.`);
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
            onClick={abrirFormNuevo}
            className="px-3 py-1.5 bg-navy text-white rounded-md font-semibold transition-transform active:scale-[0.98]"
          >
            + Nuevo alumno
          </button>
        </div>
      </div>

      {mostrarForm && (
        <div className="max-w-3xl space-y-4">
          {/* Carnet: simula el ID de jugador de la academia con los datos del formulario */}
          <div className="rounded-2xl overflow-hidden shadow-lg border border-navy/10">
            <div className="bg-navy px-6 py-4 flex items-center justify-between gap-4">
              <Image src="/profutbollogo.png" alt="Pro Futbol Antigua" width={453} height={162} className="h-9 w-auto" />
              <p className="hidden sm:block text-[11px] tracking-widest text-white/70 font-semibold">
                DISCIPLINA&nbsp;&nbsp;/&nbsp;&nbsp;FORMACIÓN&nbsp;&nbsp;/&nbsp;&nbsp;GRANDES SUEÑOS
              </p>
            </div>

            <div className="bg-white grid md:grid-cols-[220px_1fr]">
              <div className="bg-navy px-6 py-6 flex flex-col items-center gap-3">
                <div className="w-36 h-36 rounded-xl overflow-hidden border-4 border-white/90 bg-gray-200 flex items-center justify-center">
                  {foto ? (
                    // eslint-disable-next-line @next/next/no-img-element -- data URL de localStorage, no un asset estatico
                    <img src={foto} alt={`Foto de ${form.nombre || 'alumno'}`} className="w-full h-full object-cover" />
                  ) : (
                    <UserCircle size={96} weight="fill" className="text-gray-400" aria-hidden />
                  )}
                </div>
                <label className={`text-xs font-semibold text-white bg-white/10 border border-white/30 rounded-md px-3 py-1.5 transition ${editando ? 'cursor-pointer hover:bg-white/20' : 'opacity-50 cursor-not-allowed'}`}>
                  <Camera size={14} weight="bold" className="inline -mt-0.5 mr-1" aria-hidden />
                  {foto ? 'Cambiar foto' : 'Subir foto'}
                  <input type="file" accept="image/*" onChange={manejarFoto} disabled={!editando} className="hidden" />
                </label>
                {!editando && <p className="text-[10px] text-white/60 text-center">Guarda al alumno para poder subirle una foto.</p>}
                <p className="text-xs italic text-white/70 text-center mt-1">Más que fútbol,<br />formamos personas</p>
              </div>

              <div className="relative px-6 py-6">
                <span className="absolute top-4 right-4 bg-navy text-white text-[11px] font-bold tracking-wide px-3 py-1 rounded-md">JUGADOR</span>
                <p className="text-xs tracking-widest text-gray-500 font-semibold">MEMBRESÍA</p>
                <h2 className="text-sm font-bold text-navy tracking-wide">ACADEMIA DE FÚTBOL</h2>
                <h3 className="text-2xl md:text-3xl font-black text-navy uppercase leading-tight max-w-xs mt-2 mb-3 border-b border-gray-200 pb-3">
                  {form.nombre || 'Nombre del alumno'}
                </h3>

                <div className="space-y-3 mb-4">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 w-8 h-8 rounded-full bg-navy/10 flex items-center justify-center shrink-0">
                      <User size={16} weight="bold" className="text-navy" aria-hidden />
                    </span>
                    <label className="flex-1">
                      <span className="block text-[11px] font-bold text-gray-500 tracking-wide">NOMBRE DEL ALUMNO *</span>
                      <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} className="w-full border-0 border-b border-gray-300 focus:border-navy focus:ring-0 px-0 py-1 text-sm font-semibold text-navy bg-transparent" />
                    </label>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 w-8 h-8 rounded-full bg-navy/10 flex items-center justify-center shrink-0">
                      <CalendarBlank size={16} weight="bold" className="text-navy" aria-hidden />
                    </span>
                    <label className="flex-1">
                      <span className="block text-[11px] font-bold text-gray-500 tracking-wide">FECHA DE NACIMIENTO *</span>
                      <input type="date" value={form.fechaNacimiento} min={hoyISOAnios(-40)} max={hoyISOAnios(0)} onChange={(e) => setForm({ ...form, fechaNacimiento: e.target.value })} className="w-full border-0 border-b border-gray-300 focus:border-navy focus:ring-0 px-0 py-1 text-sm font-semibold text-navy bg-transparent" />
                    </label>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 w-8 h-8 rounded-full bg-navy/10 flex items-center justify-center shrink-0">
                      <TShirt size={16} weight="bold" className="text-navy" aria-hidden />
                    </span>
                    <label className="flex-1">
                      <span className="block text-[11px] font-bold text-gray-500 tracking-wide">CATEGORÍA</span>
                      <input value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} placeholder="Sugerida por edad" className="w-full border-0 border-b border-gray-300 focus:border-navy focus:ring-0 px-0 py-1 text-sm font-semibold text-navy bg-transparent placeholder:font-normal placeholder:text-gray-400" />
                    </label>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 w-8 h-8 rounded-full bg-navy/10 flex items-center justify-center shrink-0">
                      <UsersFour size={16} weight="bold" className="text-navy" aria-hidden />
                    </span>
                    <label className="flex-1">
                      <span className="block text-[11px] font-bold text-gray-500 tracking-wide">NOMBRE DEL ENCARGADO *</span>
                      <input value={form.encargadoNombre} onChange={(e) => setForm({ ...form, encargadoNombre: e.target.value })} className="w-full border-0 border-b border-gray-300 focus:border-navy focus:ring-0 px-0 py-1 text-sm font-semibold text-navy bg-transparent" />
                    </label>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 w-8 h-8 rounded-full bg-navy/10 flex items-center justify-center shrink-0">
                      <Phone size={16} weight="bold" className="text-navy" aria-hidden />
                    </span>
                    <label className="flex-1">
                      <span className="block text-[11px] font-bold text-gray-500 tracking-wide">TELÉFONO DEL ENCARGADO *</span>
                      <input value={form.encargadoTelefono} onChange={(e) => setForm({ ...form, encargadoTelefono: e.target.value })} className="w-full border-0 border-b border-gray-300 focus:border-navy focus:ring-0 px-0 py-1 text-sm font-semibold text-navy bg-transparent" />
                    </label>
                  </div>
                </div>

                <div className="inline-flex flex-col items-start">
                  <span className="text-[11px] font-bold text-gray-500 tracking-wide">NÚMERO DE MIEMBRO</span>
                  <span className="bg-navy text-white text-sm font-bold tracking-wide px-3 py-1 rounded-md mt-1">
                    {editando ? idMiembro(editando) : 'PF-NUEVO'}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-navy px-6 py-3 flex flex-wrap items-center justify-between gap-2 text-white/80 text-xs">
              <span className="flex items-center gap-1.5">
                <MapPin size={14} weight="fill" aria-hidden /> PRO FÚTBOL ANTIGUA
              </span>
              <span className="flex items-center gap-2">
                ANTIGUA GUATEMALA
                <span className="inline-flex w-4 h-3 rounded-sm overflow-hidden border border-white/30" aria-hidden>
                  <span className="flex-1 bg-sky-400" />
                  <span className="flex-1 bg-white" />
                  <span className="flex-1 bg-sky-400" />
                </span>
              </span>
            </div>
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}
          <div className="flex items-center gap-3">
            <button
              onClick={guardar}
              disabled={guardando || !form.nombre || !form.fechaNacimiento || !form.encargadoNombre || !form.encargadoTelefono}
              className="px-4 py-2 bg-navy text-white rounded-md text-sm font-semibold disabled:opacity-50 transition-transform active:scale-[0.98]"
            >
              {guardando ? 'Guardando...' : editando ? 'Guardar cambios' : 'Registrar alumno'}
            </button>
            <button
              onClick={cancelarForm}
              disabled={guardando}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md text-sm font-semibold disabled:opacity-50 hover:bg-gray-50 transition active:scale-[0.98]"
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
                    <span className={`text-xs rounded-full px-2 py-0.5 ${colorCategoria(a.categoria)}`}>{a.categoria}</span>
                  </td>
                  <td className="px-4 py-2">
                    {a.encargadoNombre}
                    <div className="text-xs text-gray-500">{a.encargadoTelefono}</div>
                  </td>
                  <td className="px-4 py-2 text-right space-x-2 whitespace-nowrap">
                    <button onClick={() => iniciarEdicion(a)} className="text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded px-2 py-1 hover:bg-blue-100 transition active:scale-[0.98]">Editar</button>
                    <button onClick={() => setDesactivando(a)} className="text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1 hover:bg-red-100 transition active:scale-[0.98]">Desactivar</button>
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
