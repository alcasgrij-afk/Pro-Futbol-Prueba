'use client';

const TOKEN_KEY = 'profutbol_superadmin_token';

export function guardarSuperadminToken(token: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKEN_KEY, token);
}

export function obtenerSuperadminToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function borrarSuperadminToken() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
}

class SuperadminApiError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}

export interface JobFallido {
  id: string;
  name: string;
  failedReason: string | null;
  attemptsMade: number;
}

export interface PagoEstancado {
  id: string;
  montoQ: number;
  tipoReferencia: string;
  referenciaId: string;
  creadoEn: string;
}

export interface ConexionActiva {
  pid: number;
  state: string | null;
  query: string;
  applicationName: string | null;
  duracionSegundos: number;
}

export interface SuperadminOverview {
  generadoEn: string;
  database: {
    estado: 'ok' | 'warn' | 'critical';
    conexiones: { usadas: number; max: number } | null;
    bloqueadas: { pid: number; query: string; bloqueadaPorPids: number[] }[];
    consultaMasLenta: { pid: number; query: string; duracionSegundos: number } | null;
    conexionesDetalle: { idleCount: number; otras: ConexionActiva[] };
  };
  redis: {
    estado: 'ok' | 'warn' | 'critical';
    latenciaMs: number | null;
    memoriaUsadaMb: number | null;
    clientesConectados: number | null;
    uptimeSegundos: number | null;
    memoriaPicoMb: number | null;
    tasaAciertoPct: number | null;
    clavesEvictadas: number | null;
    comandosProcesados: number | null;
  };
  colas: {
    reservas: { waiting: number; active: number; failed: number; delayed: number; estado: 'ok' | 'warn'; fallidos: JobFallido[] };
    academia: { waiting: number; active: number; failed: number; delayed: number; estado: 'ok' | 'warn'; fallidos: JobFallido[] };
  };
  api: { estado: 'ok'; uptimeSegundos: number; memoriaRssMb: number };
  pagos: {
    estado: 'ok' | 'warn';
    ultimas24h: { PENDIENTE: number; COMPLETADO: number; FALLIDO: number; CANCELADO: number };
    pendientesEstancados: number;
    estancados: PagoEstancado[];
  };
}

export interface LineaLog {
  t: number;
  nivel: 'warn' | 'error';
  contexto?: string;
  mensaje: string;
}

export interface PuntoHistorial {
  t: number;
  dbConexiones: number | null;
  dbEstado: 'ok' | 'warn' | 'critical';
  redisLatenciaMs: number | null;
  redisEstado: 'ok' | 'warn' | 'critical';
  colasFallidos: number;
  colasEstado: 'ok' | 'warn';
  pagosEstancados: number;
  pagosEstado: 'ok' | 'warn';
}

/** Login del panel /superadmin: contrasena compartida, token aislado del de /admin. */
export async function loginSuperadmin(password: string): Promise<void> {
  const respuesta = await fetch('/api/superadmin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  if (!respuesta.ok) {
    throw new SuperadminApiError(respuesta.status, 'Contrasena incorrecta.');
  }
  const { accessToken } = await respuesta.json();
  guardarSuperadminToken(accessToken);
}

async function fetchSuperadmin<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = obtenerSuperadminToken();
  const respuesta = await fetch(`/api/superadmin${path}`, {
    ...init,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  });
  if (respuesta.status === 401) {
    borrarSuperadminToken();
    throw new SuperadminApiError(401, 'Sesion expirada.');
  }
  if (!respuesta.ok) {
    const cuerpo = await respuesta.json().catch(() => null);
    throw new SuperadminApiError(respuesta.status, cuerpo?.message ?? 'Error al comunicarse con el servidor.');
  }
  return respuesta.json();
}

export function obtenerOverview(): Promise<SuperadminOverview> {
  return fetchSuperadmin('/monitoring/overview');
}

export function obtenerHistorial(): Promise<PuntoHistorial[]> {
  return fetchSuperadmin('/monitoring/historial');
}

export function obtenerLogs(): Promise<LineaLog[]> {
  return fetchSuperadmin('/monitoring/logs');
}

export function postSuperadmin<T>(path: string, body?: unknown): Promise<T> {
  return fetchSuperadmin(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined });
}

export function deleteSuperadmin<T>(path: string): Promise<T> {
  return fetchSuperadmin(path, { method: 'DELETE' });
}
