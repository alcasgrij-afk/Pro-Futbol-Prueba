import { BloqueHorario } from '@profutbol/shared-types';

export interface RangoOcupado {
  horaInicioMin: number;
  horaFinMin: number;
}

export interface ReglasCancha {
  horaAperturaMin: number;
  horaCierreMin: number;
  duracionBloqueMin: number;
}

/**
 * Calcula los bloques de horario de una cancha para un dia dado, marcando
 * cuales estan libres y cuales ocupados.
 *
 * DECISION DE DISENO (ver Plan Tecnico, seccion 4): la disponibilidad NO se
 * guarda en una tabla propia. Se deriva en tiempo real restando las reservas
 * activas del horario de operacion de la cancha. Esto evita que la
 * disponibilidad mostrada y las reservas reales se desincronicen.
 *
 * Es una funcion pura (sin dependencias externas) a proposito, para poder
 * testearla exhaustivamente sin necesidad de una base de datos.
 */
export function calcularBloquesDisponibilidad(
  reglas: ReglasCancha,
  reservasActivas: RangoOcupado[],
): BloqueHorario[] {
  const { horaAperturaMin, horaCierreMin, duracionBloqueMin } = reglas;

  if (duracionBloqueMin <= 0) {
    throw new Error('duracionBloqueMin debe ser mayor a 0.');
  }
  if (horaCierreMin <= horaAperturaMin) {
    throw new Error('horaCierreMin debe ser mayor que horaAperturaMin.');
  }

  const bloques: BloqueHorario[] = [];

  for (
    let inicio = horaAperturaMin;
    inicio + duracionBloqueMin <= horaCierreMin;
    inicio += duracionBloqueMin
  ) {
    const fin = inicio + duracionBloqueMin;

    const seSolapaConReserva = reservasActivas.some((r) =>
      seSolapan(inicio, fin, r.horaInicioMin, r.horaFinMin),
    );

    bloques.push({
      horaInicio: minutosAHora(inicio),
      horaFin: minutosAHora(fin),
      disponible: !seSolapaConReserva,
    });
  }

  return bloques;
}

function seSolapan(aInicio: number, aFin: number, bInicio: number, bFin: number): boolean {
  return aInicio < bFin && bInicio < aFin;
}

export function minutosAHora(minutos: number): string {
  const h = Math.floor(minutos / 60)
    .toString()
    .padStart(2, '0');
  const m = (minutos % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

export function horaAMinutos(hora: string): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hora);
  if (!match) {
    throw new Error(`Formato de hora invalido: "${hora}". Se espera "HH:mm".`);
  }
  const [, h, m] = match;
  const horas = parseInt(h, 10);
  const minutos = parseInt(m, 10);
  if (horas < 0 || horas > 23 || minutos < 0 || minutos > 59) {
    throw new Error(`Hora fuera de rango: "${hora}".`);
  }
  return horas * 60 + minutos;
}
