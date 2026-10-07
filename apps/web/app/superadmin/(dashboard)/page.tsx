'use client';

import { useEffect, useState } from 'react';
import { ArrowClockwise, CreditCard, Database, HardDrives, Stack } from '@phosphor-icons/react';
import { obtenerOverview, type SuperadminOverview } from '../../../lib/superadmin-client';

const INTERVALO_MS = 30_000;

const ESTILOS_ESTADO: Record<'ok' | 'warn' | 'critical', { borde: string; punto: string; texto: string; label: string }> = {
  ok: { borde: 'border-emerald-800', punto: 'bg-emerald-400', texto: 'text-emerald-400', label: 'OK' },
  warn: { borde: 'border-amber-800', punto: 'bg-amber-400', texto: 'text-amber-400', label: 'Atención' },
  critical: { borde: 'border-red-800', punto: 'bg-red-400', texto: 'text-red-400', label: 'Crítico' },
};

function Badge({ estado }: { estado: 'ok' | 'warn' | 'critical' }) {
  const e = ESTILOS_ESTADO[estado];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${e.texto}`}>
      <span className={`w-2 h-2 rounded-full ${e.punto}`} aria-hidden="true" />
      {e.label}
    </span>
  );
}

function Tile({
  icon: Icon,
  titulo,
  estado,
  children,
}: {
  icon: React.ElementType;
  titulo: string;
  estado: 'ok' | 'warn' | 'critical';
  children: React.ReactNode;
}) {
  const e = ESTILOS_ESTADO[estado];
  return (
    <div className={`rounded-2xl border ${e.borde} bg-slate-900 p-5`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-slate-200 font-semibold text-sm">
          <Icon size={18} weight="bold" aria-hidden="true" />
          {titulo}
        </div>
        <Badge estado={estado} />
      </div>
      <div className="space-y-1 text-sm text-slate-300">{children}</div>
    </div>
  );
}

export default function SuperadminOverviewPage() {
  const [data, setData] = useState<SuperadminOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let activo = true;
    async function cargar() {
      try {
        const overview = await obtenerOverview();
        if (activo) {
          setData(overview);
          setError(null);
        }
      } catch {
        if (activo) setError('No se pudo cargar el estado del sistema.');
      }
    }
    cargar();
    const id = setInterval(cargar, INTERVALO_MS);
    return () => {
      activo = false;
      clearInterval(id);
    };
  }, []);

  if (error) return <p className="text-red-400">{error}</p>;
  if (!data) return <p className="text-slate-400">Cargando...</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Estado del sistema</h1>
        <p className="text-xs text-slate-500 flex items-center gap-1.5">
          <ArrowClockwise size={14} aria-hidden="true" />
          Actualizado {new Date(data.generadoEn).toLocaleTimeString('es-GT')} · cada 30s
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        <Tile icon={Database} titulo="Base de datos" estado={data.database.estado}>
          {data.database.conexiones && (
            <p>
              Conexiones: {data.database.conexiones.usadas} / {data.database.conexiones.max}
            </p>
          )}
          {data.database.consultaMasLenta && (
            <p>
              Consulta más lenta activa: {data.database.consultaMasLenta.duracionSegundos}s (pid{' '}
              {data.database.consultaMasLenta.pid})
            </p>
          )}
          {data.database.bloqueadas.length > 0 && (
            <div className="mt-2 rounded-lg bg-red-950/40 border border-red-900 p-2 space-y-1">
              <p className="font-semibold text-red-300">Consultas bloqueadas:</p>
              {data.database.bloqueadas.map((b) => (
                <p key={b.pid} className="text-xs text-red-200">
                  pid {b.pid} esperando a pid {b.bloqueadaPorPids.join(', ')}
                </p>
              ))}
            </div>
          )}
        </Tile>

        <Tile icon={HardDrives} titulo="Redis" estado={data.redis.estado}>
          <p>Latencia: {data.redis.latenciaMs ?? '—'} ms</p>
          <p>Memoria usada: {data.redis.memoriaUsadaMb ?? '—'} MB</p>
          <p>Clientes conectados: {data.redis.clientesConectados ?? '—'}</p>
        </Tile>

        <Tile icon={Stack} titulo="Colas (BullMQ)" estado={data.colas.reservas.estado === 'warn' || data.colas.academia.estado === 'warn' ? 'warn' : 'ok'}>
          <p>
            Reservas: {data.colas.reservas.waiting} esperando, {data.colas.reservas.active} activos,{' '}
            {data.colas.reservas.failed} fallidos
          </p>
          <p>
            Academia: {data.colas.academia.waiting} esperando, {data.colas.academia.active} activos,{' '}
            {data.colas.academia.failed} fallidos
          </p>
        </Tile>

        <Tile icon={CreditCard} titulo="Pagos (últimas 24h)" estado={data.pagos.estado}>
          <p>Completados: {data.pagos.ultimas24h.COMPLETADO}</p>
          <p>Fallidos: {data.pagos.ultimas24h.FALLIDO}</p>
          <p>Pendientes: {data.pagos.ultimas24h.PENDIENTE}</p>
          {data.pagos.pendientesEstancados > 0 && (
            <p className="text-amber-300 font-semibold">
              {data.pagos.pendientesEstancados} pendientes estancados (&gt;15 min)
            </p>
          )}
        </Tile>
      </div>

      <p className="text-xs text-slate-500">
        API: uptime {Math.floor(data.api.uptimeSegundos / 60)} min · memoria {data.api.memoriaRssMb} MB
      </p>
    </div>
  );
}
