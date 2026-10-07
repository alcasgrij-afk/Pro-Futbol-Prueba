'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldWarning } from '@phosphor-icons/react';
import { borrarSuperadminToken, obtenerSuperadminToken } from '../lib/superadmin-client';

/**
 * Chrome del panel /superadmin: guarda de sesion (redirige a
 * /superadmin/login si no hay token) con token propio
 * (profutbol_superadmin_token), completamente separado del de /admin.
 * Tema slate/amber en vez de navy/amarillo para que nunca se confunda con
 * el panel de negocio.
 */
export default function SuperadminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [listo, setListo] = useState(false);

  useEffect(() => {
    if (!obtenerSuperadminToken()) {
      router.replace('/superadmin/login');
      return;
    }
    setListo(true);
  }, [router]);

  function cerrarSesion() {
    borrarSuperadminToken();
    router.replace('/superadmin/login');
  }

  if (!listo) return null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldWarning size={22} weight="bold" className="text-amber-400" aria-hidden="true" />
          <div>
            <p className="font-bold leading-tight">Superadmin</p>
            <p className="text-xs text-slate-400 leading-tight">Monitoreo interno - dev/infra</p>
          </div>
        </div>
        <button onClick={cerrarSesion} className="text-sm text-slate-400 hover:text-slate-100 underline underline-offset-2">
          Cerrar sesión
        </button>
      </header>
      <main className="p-6 max-w-6xl mx-auto">{children}</main>
    </div>
  );
}
