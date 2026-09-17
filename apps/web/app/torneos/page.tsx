'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { EstadoTorneo, FormatoTorneo, TorneoDTO } from '@profutbol/shared-types';
import { api } from '../../lib/api-client';
import Skeleton from '../../components/Skeleton';

const ETIQUETA_ESTADO: Record<EstadoTorneo, string> = {
  [EstadoTorneo.PROXIMO]: 'Próximo',
  [EstadoTorneo.INSCRIPCIONES_ABIERTAS]: 'Inscripciones abiertas',
  [EstadoTorneo.EN_CURSO]: 'En curso',
  [EstadoTorneo.FINALIZADO]: 'Finalizado',
  [EstadoTorneo.CANCELADO]: 'Cancelado',
};

const ETIQUETA_FORMATO: Record<FormatoTorneo, string> = {
  [FormatoTorneo.LIGA]: 'Todos contra todos',
  [FormatoTorneo.ELIMINACION_DIRECTA]: 'Eliminación directa',
};

export default function TorneosPage() {
  const [torneos, setTorneos] = useState<TorneoDTO[]>([]);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    api
      .listarTorneos()
      .then(setTorneos)
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  }, []);

  return (
    <div className="min-h-screen bg-navy text-white">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-white focus:text-navy focus:px-3 focus:py-2 rounded">Saltar al contenido</a>
      <header className="bg-navy border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <Link href="/" className="font-bold text-lg">Pro Futbol Antigua</Link>
        <Link href="/reservar" className="text-sm underline underline-offset-2">Reservar cancha</Link>
      </header>
      <main id="main" className="p-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Torneos y campeonatos</h1>
        {error && <p className="text-red-400 mb-4">{error}</p>}
        {cargando && (
          <div className="grid gap-4 md:grid-cols-2" aria-busy="true">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="block bg-white/5 border border-white/10 rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-6 w-24 rounded-full" />
                </div>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-32" />
              </div>
            ))}
          </div>
        )}
        {!cargando && torneos.length === 0 && !error && <p className="text-white/70">Aún no hay torneos publicados.</p>}
        <div className="grid gap-4 md:grid-cols-2">
          {torneos.map((t) => (
            <Link key={t.id} href={`/torneos/${t.id}`} className="block bg-white/5 border border-white/10 rounded-lg p-4 hover:bg-white/10">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">{t.nombre}</h2>
                <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 text-navy">{ETIQUETA_ESTADO[t.estado]}</span>
              </div>
              {t.descripcion && <p className="text-sm text-white/70 mt-1">{t.descripcion}</p>}
              <p className="text-xs text-white/60 mt-2">
                {ETIQUETA_FORMATO[t.formato]} · {t.equiposInscritos}/{t.maxEquipos} equipos
              </p>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
