'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  ArrowClockwise,
  ArrowCounterClockwise,
  CaretDown,
  CheckCircle,
  CreditCard,
  Database,
  HardDrives,
  Stack,
  Trash,
  XCircle,
} from '@phosphor-icons/react';
import {
  obtenerOverview,
  obtenerHistorial,
  obtenerLogs,
  postSuperadmin,
  deleteSuperadmin,
  type SuperadminOverview,
  type PuntoHistorial,
  type LineaLog,
} from '../../../lib/superadmin-client';
import { Sparkline } from '../../../components/Sparkline';

const INTERVALO_MS = 30_000;

const ESTILOS_ESTADO: Record<'ok' | 'warn' | 'critical', { borde: string; punto: string; texto: string; label: string }> = {
  ok: { borde: 'border-emerald-800', punto: 'bg-emerald-400', texto: 'text-emerald-400', label: 'OK' },
  warn: { borde: 'border-amber-800', punto: 'bg-amber-400', texto: 'text-amber-400', label: 'Atención' },
  critical: { borde: 'border-red-800', punto: 'bg-red-400', texto: 'text-red-400', label: 'Crítico' },
};

function SparklineConLabel({
  data,
  estado,
  label,
}: {
  data: number[];
  estado: 'ok' | 'warn' | 'critical';
  label: string;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <Sparkline data={data} estado={estado} />
      <span className="text-[9px] text-slate-600">{label}</span>
    </div>
  );
}

function Badge({ estado }: { estado: 'ok' | 'warn' | 'critical' }) {
  const e = ESTILOS_ESTADO[estado];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${e.texto}`}>
      <span className={`w-2 h-2 rounded-full ${e.punto}`} aria-hidden="true" />
      {e.label}
    </span>
  );
}

function BotonAccion({
  onClick,
  enCurso,
  variante = 'neutral',
  children,
}: {
  onClick: () => void;
  enCurso: boolean;
  variante?: 'neutral' | 'peligro' | 'exito';
  children: React.ReactNode;
}) {
  const colores =
    variante === 'peligro'
      ? 'border-red-800 text-red-300 hover:bg-red-950/40'
      : variante === 'exito'
        ? 'border-emerald-800 text-emerald-300 hover:bg-emerald-950/40'
        : 'border-slate-700 text-slate-300 hover:bg-slate-800';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={enCurso}
      className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-medium transition disabled:opacity-40 disabled:cursor-not-allowed ${colores}`}
    >
      {children}
    </button>
  );
}

function Tile({
  icon: Icon,
  titulo,
  estado,
  sparkline,
  expandido,
  onToggle,
  children,
  detalle,
}: {
  icon: React.ElementType;
  titulo: string;
  estado: 'ok' | 'warn' | 'critical';
  sparkline?: React.ReactNode;
  expandido: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  detalle?: React.ReactNode;
}) {
  const e = ESTILOS_ESTADO[estado];
  return (
    <div className={`rounded-2xl border ${e.borde} bg-slate-900 p-5`}>
      <button type="button" onClick={onToggle} className="w-full text-left">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-slate-200 font-semibold text-sm">
            <Icon size={18} weight="bold" aria-hidden="true" />
            {titulo}
          </div>
          <div className="flex items-center gap-3">
            {sparkline}
            <Badge estado={estado} />
            <CaretDown
              size={14}
              className={`text-slate-500 transition-transform ${expandido ? 'rotate-180' : ''}`}
              aria-hidden="true"
            />
          </div>
        </div>
      </button>
      <div className="space-y-1 text-sm text-slate-300">{children}</div>
      {expandido && detalle && <div className="mt-4 pt-4 border-t border-slate-800 space-y-3">{detalle}</div>}
    </div>
  );
}

export default function SuperadminOverviewPage() {
  const [data, setData] = useState<SuperadminOverview | null>(null);
  const [historial, setHistorial] = useState<PuntoHistorial[]>([]);
  const [logs, setLogs] = useState<LineaLog[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());
  const [accionEnCurso, setAccionEnCurso] = useState<string | null>(null);
  const [mensajeAccion, setMensajeAccion] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  const cargar = useCallback(async () => {
    try {
      const [overview, puntos, lineas] = await Promise.all([obtenerOverview(), obtenerHistorial(), obtenerLogs()]);
      setData(overview);
      setHistorial(puntos);
      setLogs(lineas);
      setError(null);
    } catch {
      setError('No se pudo cargar el estado del sistema.');
    }
  }, []);

  useEffect(() => {
    cargar();
    const id = setInterval(cargar, INTERVALO_MS);
    return () => clearInterval(id);
  }, [cargar]);

  function alternarTile(key: string) {
    setExpandidos((prev) => {
      const siguiente = new Set(prev);
      if (siguiente.has(key)) siguiente.delete(key);
      else siguiente.add(key);
      return siguiente;
    });
  }

  async function ejecutarAccion(key: string, fn: () => Promise<unknown>, confirmacion?: string) {
    if (confirmacion && !window.confirm(confirmacion)) return;
    setAccionEnCurso(key);
    setMensajeAccion(null);
    try {
      await fn();
      setMensajeAccion({ tipo: 'ok', texto: 'Acción aplicada correctamente.' });
      await cargar();
    } catch (e) {
      setMensajeAccion({ tipo: 'error', texto: e instanceof Error ? e.message : 'Error al ejecutar la acción.' });
    } finally {
      setAccionEnCurso(null);
    }
  }

  if (error) return <p className="text-red-400">{error}</p>;
  if (!data) return <p className="text-slate-400">Cargando...</p>;

  const serie = {
    db: historial.map((p) => p.dbConexiones ?? 0),
    redis: historial.map((p) => p.redisLatenciaMs ?? 0),
    colas: historial.map((p) => p.colasFallidos),
    pagos: historial.map((p) => p.pagosEstancados),
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Estado del sistema</h1>
        <p className="text-xs text-slate-500 flex items-center gap-1.5">
          <ArrowClockwise size={14} aria-hidden="true" />
          Actualizado {new Date(data.generadoEn).toLocaleTimeString('es-GT')} · cada 30s
        </p>
      </div>

      {mensajeAccion && (
        <p className={`text-xs rounded-lg px-3 py-2 ${mensajeAccion.tipo === 'ok' ? 'bg-emerald-950/40 text-emerald-300' : 'bg-red-950/40 text-red-300'}`}>
          {mensajeAccion.texto}
        </p>
      )}

      <div className="grid md:grid-cols-2 gap-5">
        <Tile
          icon={Database}
          titulo="Base de datos"
          estado={data.database.estado}
          sparkline={<SparklineConLabel data={serie.db} estado={data.database.estado} label="conexiones" />}
          expandido={expandidos.has('database')}
          onToggle={() => alternarTile('database')}
          detalle={
            <div className="space-y-3">
              <div>
                <p className="font-semibold text-slate-300 text-xs mb-2">
                  Conexiones activas ({data.database.conexionesDetalle.otras.length}
                  {data.database.conexionesDetalle.idleCount > 0 ? `, +${data.database.conexionesDetalle.idleCount} inactivas` : ''}):
                </p>
                {data.database.conexionesDetalle.otras.length > 0 ? (
                  <div className="space-y-2">
                    {data.database.conexionesDetalle.otras.map((c) => (
                      <div key={c.pid} className="rounded-lg bg-slate-800/50 border border-slate-700 p-2">
                        <p className="text-xs text-slate-300">
                          pid {c.pid} · {c.state ?? 'sin estado'} · {c.duracionSegundos}s
                          {c.applicationName ? ` · ${c.applicationName}` : ''}
                        </p>
                        {c.query && <p className="text-[11px] text-slate-500 truncate font-mono">{c.query}</p>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">Sin conexiones activas distintas de idle.</p>
                )}
              </div>
              {data.database.bloqueadas.length > 0 && (
              <div>
                <p className="font-semibold text-red-300 text-xs mb-2">Consultas bloqueadas:</p>
                <div className="space-y-2">
                  {data.database.bloqueadas.map((b) => (
                    <div key={b.pid} className="flex items-center justify-between gap-2 rounded-lg bg-red-950/30 border border-red-900 p-2">
                      <p className="text-xs text-red-200">
                        pid {b.pid} esperando a pid {b.bloqueadaPorPids.join(', ')}
                      </p>
                      <div className="flex gap-2">
                        {b.bloqueadaPorPids.map((pidBloqueante) => (
                          <BotonAccion
                            key={pidBloqueante}
                            variante="peligro"
                            enCurso={accionEnCurso === `terminar-${pidBloqueante}`}
                            onClick={() =>
                              ejecutarAccion(
                                `terminar-${pidBloqueante}`,
                                () => postSuperadmin('/monitoring/database/terminar-consulta', { pid: pidBloqueante }),
                                `¿Terminar la conexión pid ${pidBloqueante}? Esto cancela su consulta en curso.`,
                              )
                            }
                          >
                            <XCircle size={14} /> Terminar pid {pidBloqueante}
                          </BotonAccion>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              )}
            </div>
          }
        >
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
        </Tile>

        <Tile
          icon={HardDrives}
          titulo="Redis"
          estado={data.redis.estado}
          sparkline={<SparklineConLabel data={serie.redis} estado={data.redis.estado} label="latencia ms" />}
          expandido={expandidos.has('redis')}
          onToggle={() => alternarTile('redis')}
          detalle={
            <div className="space-y-1">
              <p>
                Uptime:{' '}
                {data.redis.uptimeSegundos != null
                  ? `${Math.floor(data.redis.uptimeSegundos / 3600)}h ${Math.floor((data.redis.uptimeSegundos % 3600) / 60)}m`
                  : '—'}
              </p>
              <p>Memoria pico: {data.redis.memoriaPicoMb ?? '—'} MB</p>
              <p>Tasa de acierto: {data.redis.tasaAciertoPct != null ? `${data.redis.tasaAciertoPct}%` : '—'}</p>
              <p>Claves evictadas: {data.redis.clavesEvictadas ?? '—'}</p>
              <p>Comandos procesados: {data.redis.comandosProcesados ?? '—'}</p>
              <p className="text-xs text-slate-500 pt-2">
                Sin acciones correctivas disponibles desde el panel; reiniciar Redis es una operación de infraestructura.
              </p>
            </div>
          }
        >
          <p>Latencia: {data.redis.latenciaMs ?? '—'} ms</p>
          <p>Memoria usada: {data.redis.memoriaUsadaMb ?? '—'} MB</p>
          <p>Clientes conectados: {data.redis.clientesConectados ?? '—'}</p>
        </Tile>

        <Tile
          icon={Stack}
          titulo="Colas (BullMQ)"
          estado={data.colas.reservas.estado === 'warn' || data.colas.academia.estado === 'warn' ? 'warn' : 'ok'}
          sparkline={
            <SparklineConLabel
              data={serie.colas}
              estado={data.colas.reservas.failed + data.colas.academia.failed > 0 ? 'warn' : 'ok'}
              label="fallidos"
            />
          }
          expandido={expandidos.has('colas')}
          onToggle={() => alternarTile('colas')}
          detalle={
            <div className="space-y-3">
              {(['reservas', 'academia'] as const).map((cola) => {
                const fallidos = data.colas[cola].fallidos;
                if (fallidos.length === 0) return null;
                return (
                  <div key={cola}>
                    <p className="font-semibold text-amber-300 text-xs mb-2 capitalize">Fallidos en {cola}:</p>
                    <div className="space-y-2">
                      {fallidos.map((job) => (
                        <div key={job.id} className="flex items-center justify-between gap-2 rounded-lg bg-amber-950/20 border border-amber-900 p-2">
                          <div className="text-xs text-amber-100">
                            <p className="font-mono">{job.name} ({job.id})</p>
                            {job.failedReason && <p className="text-amber-300/80 truncate max-w-xs">{job.failedReason}</p>}
                          </div>
                          <div className="flex gap-1.5 shrink-0">
                            <BotonAccion
                              enCurso={accionEnCurso === `reintentar-${cola}-${job.id}`}
                              onClick={() =>
                                ejecutarAccion(`reintentar-${cola}-${job.id}`, () =>
                                  postSuperadmin(`/monitoring/colas/${cola}/jobs/${job.id}/reintentar`),
                                )
                              }
                            >
                              <ArrowCounterClockwise size={14} /> Reintentar
                            </BotonAccion>
                            <BotonAccion
                              variante="peligro"
                              enCurso={accionEnCurso === `eliminar-${cola}-${job.id}`}
                              onClick={() =>
                                ejecutarAccion(
                                  `eliminar-${cola}-${job.id}`,
                                  () => deleteSuperadmin(`/monitoring/colas/${cola}/jobs/${job.id}`),
                                  `¿Eliminar el job ${job.id}? No se podrá recuperar.`,
                                )
                              }
                            >
                              <Trash size={14} /> Eliminar
                            </BotonAccion>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
              {data.colas.reservas.fallidos.length === 0 && data.colas.academia.fallidos.length === 0 && (
                <p className="text-xs text-slate-500">Sin jobs fallidos.</p>
              )}
            </div>
          }
        >
          <p>
            Reservas: {data.colas.reservas.waiting} esperando, {data.colas.reservas.active} activos,{' '}
            {data.colas.reservas.failed} fallidos
          </p>
          <p>
            Academia: {data.colas.academia.waiting} esperando, {data.colas.academia.active} activos,{' '}
            {data.colas.academia.failed} fallidos
          </p>
        </Tile>

        <Tile
          icon={CreditCard}
          titulo="Pagos (últimas 24h)"
          estado={data.pagos.estado}
          sparkline={<SparklineConLabel data={serie.pagos} estado={data.pagos.estado} label="pendientes" />}
          expandido={expandidos.has('pagos')}
          onToggle={() => alternarTile('pagos')}
          detalle={
            data.pagos.estancados.length > 0 ? (
              <div className="space-y-2">
                <p className="font-semibold text-amber-300 text-xs mb-2">Pendientes estancados (&gt;15 min):</p>
                {data.pagos.estancados.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-2 rounded-lg bg-amber-950/20 border border-amber-900 p-2">
                    <p className="text-xs text-amber-100">
                      {p.tipoReferencia} · Q{p.montoQ.toFixed(2)} · desde {new Date(p.creadoEn).toLocaleTimeString('es-GT')}
                    </p>
                    <div className="flex gap-1.5 shrink-0">
                      <BotonAccion
                        variante="exito"
                        enCurso={accionEnCurso === `pago-${p.id}-COMPLETADO`}
                        onClick={() =>
                          ejecutarAccion(
                            `pago-${p.id}-COMPLETADO`,
                            () => postSuperadmin(`/monitoring/pagos/${p.id}/estado`, { estado: 'COMPLETADO' }),
                            `¿Marcar este pago como completado? Úsalo solo si confirmaste el cobro por otro medio.`,
                          )
                        }
                      >
                        <CheckCircle size={14} /> Completado
                      </BotonAccion>
                      <BotonAccion
                        variante="peligro"
                        enCurso={accionEnCurso === `pago-${p.id}-CANCELADO`}
                        onClick={() =>
                          ejecutarAccion(
                            `pago-${p.id}-CANCELADO`,
                            () => postSuperadmin(`/monitoring/pagos/${p.id}/estado`, { estado: 'CANCELADO' }),
                            `¿Cancelar este pago estancado?`,
                          )
                        }
                      >
                        <XCircle size={14} /> Cancelado
                      </BotonAccion>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500">Sin pendientes estancados.</p>
            )
          }
        >
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

      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <p className="font-semibold text-sm text-slate-200 mb-2">Logs recientes (warn/error)</p>
        {logs.length > 0 ? (
          <div className="max-h-80 overflow-y-auto font-mono text-xs space-y-1">
            {logs.map((l, i) => (
              <p
                key={i}
                title={l.mensaje}
                className={`truncate ${l.nivel === 'error' ? 'text-red-300' : 'text-amber-300'}`}
              >
                [{new Date(l.t).toLocaleTimeString('es-GT')}] {l.nivel.toUpperCase()}
                {l.contexto ? ` ${l.contexto}` : ''}: {l.mensaje}
              </p>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-500">Sin avisos ni errores recientes.</p>
        )}
      </div>

      <p className="text-xs text-slate-500">
        API: uptime {Math.floor(data.api.uptimeSegundos / 60)} min · memoria {data.api.memoriaRssMb} MB
      </p>
    </div>
  );
}
