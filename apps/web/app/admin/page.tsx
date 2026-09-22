import Link from 'next/link';
import Image from 'next/image';

// Landing del panel admin: hub de accesos a cada funcion. El shell (guarda de
// sesion + header navy) lo provee app/admin/layout.tsx via AdminLayout.
const MODULOS = [
  { href: '/reservas', t: 'Reservas del día', d: 'Confirmar, cancelar y adjuntar links de pago.', color: 'navy' },
  { href: '/admin/torneos', t: 'Torneos', d: 'Crear y gestionar torneos e inscripciones.', color: 'mustard' },
  { href: '/admin/academia', t: 'Academia', d: 'Alumnos, asistencia y mensualidades.', color: 'teal' },
  { href: '/admin/reportes', t: 'Reportes', d: 'Métricas de reservas e ingresos.', color: 'slate' },
] as const;

const ACCESOS = [
  { href: '/reservas', t: 'Reservas', color: 'navy' },
  { href: '/admin/torneos', t: 'Torneos', color: 'mustard' },
  { href: '/admin/academia', t: 'Academia', color: 'teal' },
  { href: '/admin/academia/asistencia', t: 'Asistencia', color: 'teal' },
  { href: '/admin/academia/mensualidades', t: 'Mensualidades', color: 'teal' },
  { href: '/admin/reportes', t: 'Reportes', color: 'slate' },
  { href: '/admin/perfil', t: 'Mi perfil', color: 'navy' },
] as const;

const COLOR_CLASSES = {
  navy: {
    bg: 'bg-[#0a3d7d]',
    bgLight: 'bg-[#0a3d7d]/10',
    border: 'border-[#0a3d7d]',
    text: 'text-[#0a3d7d]',
    hover: 'hover:bg-[#0a3d7d]/20 hover:text-[#0a3d7d] hover:border-[#0a3d7d]',
  },
  mustard: {
    bg: 'bg-[#d8b32d]',
    bgLight: 'bg-[#d8b32d]/10',
    border: 'border-[#d8b32d]',
    text: 'text-[#d8b32d]',
    hover: 'hover:bg-[#d8b32d]/20 hover:text-[#d8b32d] hover:border-[#d8b32d]',
  },
  teal: {
    bg: 'bg-[#15803d]',
    bgLight: 'bg-[#15803d]/10',
    border: 'border-[#15803d]',
    text: 'text-[#15803d]',
    hover: 'hover:bg-[#15803d]/20 hover:text-[#15803d] hover:border-[#15803d]',
  },
  slate: {
    bg: 'bg-[#4a6fa5]',
    bgLight: 'bg-[#4a6fa5]/10',
    border: 'border-[#4a6fa5]',
    text: 'text-[#4a6fa5]',
    hover: 'hover:bg-[#4a6fa5]/20 hover:text-[#4a6fa5] hover:border-[#4a6fa5]',
  },
};

export default function AdminHomePage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-center space-y-4">
        <Image
          src="/profutbollogo.png"
          alt="Pro Futbol Antigua Logo"
          width={453}
          height={162}
          className="h-16 w-auto rounded-lg border-4 border-navy/20 bg-navy p-2"
        />
        <h1 className="text-lg font-bold text-navy">Panel Admin</h1>
      </div>

      <div className="space-y-4">
        {MODULOS.map((m) => {
          const colors = COLOR_CLASSES[m.color as keyof typeof COLOR_CLASSES];
          return (
            <Link
              key={m.href}
              href={m.href}
              className={`block w-full bg-white rounded-lg shadow-sm ${colors.border} p-5 ${colors.hover} hover:shadow-md transition flex items-center justify-between`}
            >
              <div className="flex-1">
                <span className={`font-semibold ${colors.text} text-lg`}>{m.t}</span>
                <p className="text-sm text-gray-500 mt-1">{m.d}</p>
              </div>
              <span className="text-gray-400 group-hover:text-navy transition" aria-hidden="true">›</span>
            </Link>
          );
        })}
      </div>

      <div className="mt-6">
        <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">
          Todos los accesos
        </h2>
        <div className="space-y-2">
          {ACCESOS.map((a) => {
            const colors = COLOR_CLASSES[a.color as keyof typeof COLOR_CLASSES];
            return (
              <Link
                key={a.href}
                href={a.href}
                className={`block w-full text-left rounded-full px-4 py-2 border ${colors.border} text-xs font-medium ${colors.text} ${colors.hover} transition`}
              >
                {a.t}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
