'use client';

import type { ApiErrorResponse, LoginResponse, ReservaDTO, TorneoDTO, EquipoDTO, PartidoDTO, PosicionDTO, FormatoTorneo, EstadoTorneo, AlumnoDTO, AcademiaMensualidadDTO, AsistenciaDTO, ReporteIngresosDTO, ReporteOcupacionDTO, ReporteMorosidadDTO } from '@profutbol/shared-types';

const TOKEN_KEY = 'profutbol_access_token';

export function guardarToken(token: string) {
  if (typeof window !== 'undefined') localStorage.setItem(TOKEN_KEY, token);
}

export function obtenerToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function borrarToken() {
  if (typeof window !== 'undefined') localStorage.removeItem(TOKEN_KEY);
}

class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

/** Resultado de intentar avanzar el bracket de eliminacion directa (Fase 3). */
export interface BracketResultado {
  tipo: 'sin_cambios' | 'penalesPendientes' | 'avanzada' | 'campeon';
  partidosCreados?: PartidoDTO[];
  /** Solo con tipo === 'penalesPendientes': partido que necesita ganador por penales. */
  partidoId?: string;
  campeonId?: string;
  campeonNombre?: string;
}

async function request<T>(path: string, opciones: RequestInit = {}): Promise<T> {
  const token = obtenerToken();

  const respuesta = await fetch(`/api${path}`, {
    ...opciones,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...opciones.headers,
    },
  });

  if (!respuesta.ok) {
    const cuerpo: ApiErrorResponse = await respuesta.json().catch(() => ({
      statusCode: respuesta.status,
      message: 'Error inesperado',
    }));
    const mensaje = Array.isArray(cuerpo.message) ? cuerpo.message.join(', ') : cuerpo.message;
    throw new ApiError(respuesta.status, mensaje || 'Error inesperado');
  }

  if (respuesta.status === 204) return undefined as T;
  return respuesta.json();
}

const API_BASE_URL = typeof window !== 'undefined' && process.env.NEXT_PUBLIC_API_URL
  ? process.env.NEXT_PUBLIC_API_URL
  : '';

export const api = {
  login: (email: string, password: string) =>
    request<LoginResponse>(`${API_BASE_URL}/auth/login`, { method: 'POST', body: JSON.stringify({ email, password }) }),

  listarReservas: (filtros: { fecha?: string; estado?: string } = {}) => {
    const params = new URLSearchParams(filtros as Record<string, string>);
    return request<ReservaDTO[]>(`/reservas?${params.toString()}`);
  },

  confirmarReserva: (id: string) => request<ReservaDTO>(`/reservas/${id}/confirmar`, { method: 'PATCH' }),

  cancelarReserva: (id: string) => request<ReservaDTO>(`/reservas/${id}/cancelar`, { method: 'PATCH' }),

  // ---- Torneos (Fase 3) ----

  listarTorneos: () => request<TorneoDTO[]>('/torneos'),

  obtenerTorneo: (id: string) =>
    request<TorneoDTO & { equipos: EquipoDTO[]; partidos: PartidoDTO[]; tabla: PosicionDTO[] }>(`/torneos/${id}`),

  listarEquiposDeTorneo: (id: string) => request<EquipoDTO[]>(`/torneos/${id}/equipos`),

  crearTorneo: (datos: {
    nombre: string;
    descripcion?: string;
    formato: FormatoTorneo;
    categoria?: string;
    maxEquipos?: number;
    cuotaInscripcionQ?: number;
    fechaLimiteInscripcion?: string;
  }) => {
    // Omite campos opcionales vacios ('' / undefined) para no romper la validacion
    // @IsDateString() del backend con strings vacios.
    const body = Object.fromEntries(Object.entries(datos).filter(([, v]) => v !== '' && v != null));
    return request<TorneoDTO>('/torneos', { method: 'POST', body: JSON.stringify(body) });
  },

  inscribirEquipo: (torneoId: string, datos: { nombre: string; capitanNombre?: string; capitanTelefono?: string; jugadores?: string[] }) =>
    request<{ equipo: EquipoDTO; redirectUrl: string | null; paymentId: string | null }>(`/torneos/${torneoId}/equipos`, {
      method: 'POST',
      body: JSON.stringify(datos),
    }),

  generarFixture: (torneoId: string) => request<PartidoDTO[]>(`/torneos/${torneoId}/fixture`, { method: 'POST' }),

  capturarResultado: (torneoId: string, datos: { partidoId: string; golesLocal?: number; golesVisitante?: number; penalesGanadorId?: string }) =>
    request<{ partido: PartidoDTO; bracket: BracketResultado }>(`/torneos/${torneoId}/resultados`, { method: 'PATCH', body: JSON.stringify(datos) }),

  cambiarEstadoTorneo: (torneoId: string, estado: EstadoTorneo) =>
    request<TorneoDTO>(`/torneos/${torneoId}/estado`, { method: 'PATCH', body: JSON.stringify({ estado }) }),

  // ---- Academia (Fase 4) ----

  listarAlumnos: (filtros: { categoria?: string; activo?: boolean } = {}) => {
    const params = new URLSearchParams();
    if (filtros.categoria) params.set('categoria', filtros.categoria);
    if (filtros.activo !== undefined) params.set('activo', String(filtros.activo));
    return request<AlumnoDTO[]>(`/academia/alumnos?${params.toString()}`);
  },

  crearAlumno: (datos: { nombre: string; fechaNacimiento: string; categoria?: string; encargadoNombre: string; encargadoTelefono: string }) => {
    const body = Object.fromEntries(Object.entries(datos).filter(([, v]) => v !== '' && v != null));
    return request<AlumnoDTO>('/academia/alumnos', { method: 'POST', body: JSON.stringify(body) });
  },

  desactivarAlumno: (id: string) => request<AlumnoDTO>(`/academia/alumnos/${id}/desactivar`, { method: 'PATCH' }),

  listarMensualidadesDelMes: (mes: number, anio: number) =>
    request<AcademiaMensualidadDTO[]>(`/academia/mensualidades?mes=${mes}&anio=${anio}`),

  marcarAsistencia: (datos: { alumnoId: string; fecha: string; presente: boolean }) =>
    request<AsistenciaDTO>('/asistencia', { method: 'POST', body: JSON.stringify(datos) }),

  listarAsistenciaPorFecha: (fecha: string) =>
    request<(AsistenciaDTO & { alumno: AlumnoDTO })[]>(`/asistencia?fecha=${fecha}`),

  // ---- Reportes (Fase 5) ----

  reporteIngresos: (desde: string, hasta: string) =>
    request<ReporteIngresosDTO>(`/reportes/ingresos?desde=${desde}&hasta=${hasta}`),

  reporteOcupacion: (desde: string, hasta: string) =>
    request<ReporteOcupacionDTO>(`/reportes/ocupacion?desde=${desde}&hasta=${hasta}`),

  reporteMorosidad: (diasVencimiento = 7) =>
    request<ReporteMorosidadDTO>(`/reportes/morosidad?diasVencimiento=${diasVencimiento}`),

  cambiarPassword: (passwordActual: string, passwordNuevo: string) =>
    request('/auth/password', { method: 'PATCH', body: JSON.stringify({ passwordActual, passwordNuevo }) }),

  /**
   * Los endpoints de exportacion devuelven un archivo binario, no JSON,
   * asi que no pueden pasar por `request()` (que siempre espera JSON) —
   * se maneja aparte, con fetch directo, para poder disparar la descarga
   * en el navegador.
   */
  async descargarExportacion(path: string, nombreSugerido: string) {
    const token = obtenerToken();
    const respuesta = await fetch(`/api${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!respuesta.ok) throw new ApiError(respuesta.status, 'No se pudo generar el archivo.');

    const blob = await respuesta.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombreSugerido;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  },
};

export { ApiError };
