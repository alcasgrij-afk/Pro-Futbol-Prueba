'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { borrarToken, obtenerToken } from '../lib/api-client';

/**
 * Chrome compartido del panel admin: guarda de sesion (redirige a /login si no
 * hay token) + header con navegacion. Superficie clara unica para todo el
 * admin (Bento light); las paginas publicas conservan el tema navy/yellow.
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

  const nav = [
    { href: '/reservas', label: 'Reservas' },
    { href: '/admin/torneos', label: 'Torneos' },
    { href: '/admin/academia', label: 'Academia' },
    { href: '/admin/reportes', label: 'Reportes' },
  ];

  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-white focus:text-navy focus:px-3 focus:py-2 rounded">Saltar al contenido</a>
      <div className="min-h-screen">
      <header className="bg-navy text-white px-6 py-3 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <Link href="/admin" className="flex items-center gap-2 font-bold hover:text-yellow-300 transition-colors">
            <Image src="/profutbollogo.png" alt="Pro Futbol Antigua" width={453} height={162} className="h-7 w-auto" />
            Pro Futbol Antigua · Panel Admin
          </Link>
          <nav className="flex gap-4 text-sm">
            {nav.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={pathname.startsWith(n.href) ? 'underline underline-offset-4 text-yellow-300' : 'text-white/80 hover:text-white'}
              >
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/admin/perfil" className="text-sm text-white/80 hover:text-white">
            Mi perfil
          </Link>
          <button onClick={cerrarSesion} className="text-sm underline underline-offset-2">
            Cerrar sesión
          </button>
        </div>
      </header>
      <main id="main" className="p-6 max-w-5xl mx-auto">
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
    </>
  );
}
