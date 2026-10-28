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
/**
 * Rango de la semana (lunes a domingo) que contiene a `fechaISO`. Lo usa el
 * cierre de caja: dia/semana/mes son el mismo reporte con distinto rango.
 */
export function rangoSemana(fechaISO: string): { desde: string; hasta: string } {
  const [anio, mes, dia] = fechaISO.split('-').map(Number);
  const d = new Date(anio, mes - 1, dia);
  // getDay(): 0=domingo. Se corre al lunes anterior (domingo cuenta como fin
  // de la semana que arranco el lunes previo).
  const offsetLunes = (d.getDay() + 6) % 7;
  const lunes = new Date(anio, mes - 1, dia - offsetLunes);
  const domingo = new Date(anio, mes - 1, dia - offsetLunes + 6);
  return { desde: aISO(lunes), hasta: aISO(domingo) };
}

/** Rango del mes calendario que contiene a `fechaISO`. */
export function rangoMes(fechaISO: string): { desde: string; hasta: string } {
  const [anio, mes] = fechaISO.split('-').map(Number);
  return { desde: aISO(new Date(anio, mes - 1, 1)), hasta: aISO(new Date(anio, mes, 0)) };
}
