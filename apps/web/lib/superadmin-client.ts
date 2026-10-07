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

export interface SuperadminOverview {
  generadoEn: string;
  database: {
    estado: 'ok' | 'warn' | 'critical';
    conexiones: { usadas: number; max: number } | null;
    bloqueadas: { pid: number; query: string; bloqueadaPorPids: number[] }[];
    consultaMasLenta: { pid: number; query: string; duracionSegundos: number } | null;
  };
  redis: {
    estado: 'ok' | 'warn' | 'critical';
    latenciaMs: number | null;
    memoriaUsadaMb: number | null;
    clientesConectados: number | null;
  };
  colas: {
    reservas: { waiting: number; active: number; failed: number; delayed: number; estado: 'ok' | 'warn' };
    academia: { waiting: number; active: number; failed: number; delayed: number; estado: 'ok' | 'warn' };
  };
  api: { estado: 'ok'; uptimeSegundos: number; memoriaRssMb: number };
  pagos: {
    estado: 'ok' | 'warn';
    ultimas24h: { PENDIENTE: number; COMPLETADO: number; FALLIDO: number; CANCELADO: number };
    pendientesEstancados: number;
  };
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

export async function obtenerOverview(): Promise<SuperadminOverview> {
  const token = obtenerSuperadminToken();
  const respuesta = await fetch('/api/superadmin/monitoring/overview', {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (respuesta.status === 401) {
    borrarSuperadminToken();
    throw new SuperadminApiError(401, 'Sesion expirada.');
  }
  if (!respuesta.ok) {
    throw new SuperadminApiError(respuesta.status, 'No se pudo cargar el estado del sistema.');
  }
  return respuesta.json();
}
