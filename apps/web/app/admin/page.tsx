'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, CalendarBlank, ChartBar, GraduationCap, Trophy } from '@phosphor-icons/react';

// Landing del panel admin: hub de accesos a cada categoria. El shell (guarda
// de sesion + sidebar) lo provee app/admin/layout.tsx via AdminLayout.
const CATEGORIAS = [
  {
    href: '/reservas',
    t: 'Reservas del día',
    d: 'Confirma, cancela y adjunta links de pago.',
    icon: CalendarBlank,
    tint: 'bg-blue-50',
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
  },
  {
    href: '/admin/torneos',
    t: 'Torneos',
    d: 'Crear y gestionar torneos e inscripciones.',
    icon: Trophy,
    tint: 'bg-amber-50',
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
  },
  {
    href: '/admin/academia',
    t: 'Academia',
    d: 'Alumnos, asistencia y mensualidades.',
    icon: GraduationCap,
    tint: 'bg-emerald-50',
    iconBg: 'bg-emerald-100',
    iconColor: 'text-emerald-600',
  },
  {
    href: '/admin/reportes',
    t: 'Reportes',
    d: 'Métricas de reservas e ingresos.',
    icon: ChartBar,
    tint: 'bg-violet-50',
    iconBg: 'bg-violet-100',
    iconColor: 'text-violet-600',
  },
] as const;

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function fechaLarga(d: Date): string {
  return `${DIAS[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
}

export default function AdminHomePage() {
  // Fecha calculada en el cliente (no en render del servidor): evita
  // congelar "hoy" en la fecha del build y el mismatch de hidratacion por
  // diferencia de zona horaria entre el servidor (UTC) y el navegador (GT).
  const [fecha, setFecha] = useState('');
  useEffect(() => setFecha(fechaLarga(new Date())), []);

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <p className="text-xs font-bold tracking-widest text-gray-400 uppercase">Panel de administración</p>
          <h1 className="text-3xl font-black text-navy mt-1">¡Bienvenido, Administrador!</h1>
          <p className="text-gray-600 mt-1">Gestiona tu academia, reservas, torneos y más, todo desde un solo lugar.</p>
        </div>
        <div className="flex items-center gap-3 bg-white border border-gray-100 rounded-xl px-4 py-3 shadow-sm shrink-0" suppressHydrationWarning>
          <span className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
            <CalendarBlank size={18} weight="bold" className="text-blue-600" aria-hidden="true" />
          </span>
          <div className="text-sm">
            <p className="font-semibold text-navy">{fecha || ' '}</p>
            <p className="text-gray-500 text-xs">Pro Fútbol Antigua</p>
          </div>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {CATEGORIAS.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className={`group rounded-2xl border border-gray-100 ${c.tint} p-6 flex items-center justify-between gap-4 hover:shadow-md transition`}
          >
            <div className="flex items-center gap-4 min-w-0">
              <span className={`w-14 h-14 rounded-full ${c.iconBg} flex items-center justify-center shrink-0`}>
                <c.icon size={26} weight="bold" className={c.iconColor} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="font-bold text-navy text-lg">{c.t}</p>
                <p className="text-sm text-gray-600 mt-0.5">{c.d}</p>
              </div>
            </div>
            <ArrowRight size={20} className="text-gray-400 group-hover:text-navy group-hover:translate-x-0.5 transition shrink-0" aria-hidden="true" />
          </Link>
        ))}
      </div>

      <div>
        <h2 className="text-xs font-bold tracking-widest text-gray-500 uppercase mb-3">Acceso rápido</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {CATEGORIAS.map((c) => (
            <Link
              key={c.href}
              href={c.href}
              className={`rounded-xl ${c.tint} p-4 flex items-center gap-3 hover:shadow-sm transition min-w-0`}
            >
              <span className={`w-10 h-10 rounded-full ${c.iconBg} flex items-center justify-center shrink-0`}>
                <c.icon size={18} weight="bold" className={c.iconColor} aria-hidden="true" />
              </span>
              <p className="font-semibold text-navy text-sm min-w-0">{c.t.replace(' del día', '')}</p>
              <ArrowRight size={16} className="ml-auto text-gray-400 shrink-0" aria-hidden="true" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
