/** Utilidades de fecha local (no UTC) para los date pickers. */

/** Ventana maxima de reserva: no se puede reservar mas alla de 120 dias. */
export const RESERVA_MAX_DIAS = 120;

export function aISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function hoyISO(): string {
  return aISO(new Date());
}

/** Fecha de hoy desplazada N anios (negativo = pasado; 0 = hoy). */
export function hoyISOAnios(desplazo: number): string {
  const d = new Date();
  return aISO(new Date(d.getFullYear() + desplazo, d.getMonth(), d.getDate()));
}

/** Fecha de hoy desplazada N dias (negativo = pasado). */
export function hoyISODias(desplazo: number): string {
  const d = new Date();
  d.setDate(d.getDate() + desplazo);
  return aISO(d);
}