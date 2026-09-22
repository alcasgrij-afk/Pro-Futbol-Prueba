'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { CalendarBlank, ChartBar, GraduationCap, House, Trophy } from '@phosphor-icons/react';
import { borrarToken, obtenerToken } from '../lib/api-client';

const NAV = [
  { href: '/admin', label: 'Inicio', icon: House, exacto: true },
  { href: '/reservas', label: 'Reservas', icon: CalendarBlank, exacto: false },
  { href: '/admin/torneos', label: 'Torneos', icon: Trophy, exacto: false },
  { href: '/admin/academia', label: 'Academia', icon: GraduationCap, exacto: false },
  { href: '/admin/reportes', label: 'Reportes', icon: ChartBar, exacto: false },
] as const;

function esActivo(pathname: string, href: string, exacto: boolean): boolean {
  return exacto ? pathname === href : pathname.startsWith(href);
}

/**
 * Chrome compartido del panel admin: guarda de sesion (redirige a /login si no
 * hay token) + sidebar de navegacion. Superficie clara unica para todo el
 * admin; las paginas publicas conservan el tema navy/yellow.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [listo, setListo] = useState(false);

  useEffect(() => {
    if (!obtenerToken()) {
      router.replace('/login');
      return;
    }
    setListo(true);
  }, [router]);

  function cerrarSesion() {
    borrarToken();
    router.replace('/login');
  }

  if (!listo) return null;

  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-white focus:text-navy focus:px-3 focus:py-2 rounded">Saltar al contenido</a>
      <div className="min-h-screen md:flex bg-[#eef2f8]">
        {/* Sidebar de escritorio */}
        <aside className="hidden md:flex md:flex-col md:w-64 md:shrink-0 bg-navy text-white relative overflow-hidden">
          <div className="absolute -bottom-16 -left-16 w-56 h-56 rounded-full bg-white/5" aria-hidden="true" />
          <div className="absolute bottom-24 left-8 w-24 h-24 rounded-full bg-white/5" aria-hidden="true" />
          <div className="relative z-10 flex flex-col h-full">
            <div className="px-6 pt-8 pb-6">
              <Image src="/profutbollogo.png" alt="Pro Futbol Antigua" width={453} height={162} className="h-14 w-auto" priority />
            </div>
            <nav className="flex-1 px-4 space-y-1">
              {NAV.map(({ href, label, icon: Icon, exacto }) => {
                const activo = esActivo(pathname, href, exacto);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition ${
                      activo ? 'bg-white text-navy shadow-sm' : 'text-white/70 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <Icon size={20} weight={activo ? 'fill' : 'regular'} aria-hidden="true" />
                    {label}
                  </Link>
                );
              })}
            </nav>
            <div className="px-6 py-5 text-xs text-white/50 border-t border-white/10">
              <p className="font-semibold text-white/70">Pro Fútbol Antigua</p>
              <p>Panel de Administración</p>
            </div>
          </div>
        </aside>

        {/* Nav superior en movil (la sidebar solo aparece desde md) */}
        <header className="md:hidden bg-navy text-white px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <Link href="/admin" className="flex items-center gap-2 font-bold">
            <Image src="/profutbollogo.png" alt="Pro Futbol Antigua" width={453} height={162} className="h-7 w-auto" />
          </Link>
          <nav className="flex gap-4 text-xs overflow-x-auto">
            {NAV.map(({ href, label, exacto }) => (
              <Link
                key={href}
                href={href}
                className={esActivo(pathname, href, exacto) ? 'underline underline-offset-4 text-yellow-300 shrink-0' : 'text-white/80 hover:text-white shrink-0'}
              >
                {label}
              </Link>
            ))}
          </nav>
        </header>

        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex items-center justify-end gap-4 px-6 py-3 text-sm border-b border-gray-200 bg-white">
            <Link href="/admin/perfil" className="text-gray-600 hover:text-navy font-medium">
              Mi perfil
            </Link>
            <button onClick={cerrarSesion} className="text-gray-600 hover:text-navy font-medium underline underline-offset-2">
              Cerrar sesión
            </button>
          </div>
          <main id="main" className="flex-1 p-6 max-w-5xl mx-auto w-full">
            {pathname !== '/admin' && (
              <Link
                href="/admin"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-navy hover:underline mb-4"
              >
                <span aria-hidden="true">←</span> Atras
              </Link>
            )}
            {children}
          </main>
        </div>
      </div>
    </>
  );
}
