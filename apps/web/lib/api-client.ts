'use client';

import type { ApiErrorResponse, LoginResponse, ReservaDTO } from '@profutbol/shared-types';

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

export const api = {
  login: (email: string, password: string) =>
    request<LoginResponse>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),

  listarReservas: (filtros: { fecha?: string; estado?: string } = {}) => {
    const params = new URLSearchParams(filtros as Record<string, string>);
    return request<ReservaDTO[]>(`/reservas?${params.toString()}`);
  },

  confirmarReserva: (id: string) => request<ReservaDTO>(`/reservas/${id}/confirmar`, { method: 'PATCH' }),

  cancelarReserva: (id: string) => request<ReservaDTO>(`/reservas/${id}/cancelar`, { method: 'PATCH' }),
};

export { ApiError };
