'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { borrarToken, obtenerToken } from '../../lib/api-client';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
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
    <div className="min-h-screen">
      <header className="bg-navy text-white px-6 py-3 flex items-center justify-between">
        <span className="font-bold">Pro Futbol Antigua · Panel Admin</span>
        <button onClick={cerrarSesion} className="text-sm underline underline-offset-2">
          Cerrar sesión
        </button>
      </header>
      <main className="p-6 max-w-5xl mx-auto">{children}</main>
    </div>
  );
}
