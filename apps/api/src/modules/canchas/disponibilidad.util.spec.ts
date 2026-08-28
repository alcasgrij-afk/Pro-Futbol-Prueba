import {
  calcularBloquesDisponibilidad,
  horaAMinutos,
  minutosAHora,
} from './disponibilidad.util';

describe('calcularBloquesDisponibilidad', () => {
  const reglasEstandar = {
    horaAperturaMin: 8 * 60, // 08:00
    horaCierreMin: 11 * 60, // 11:00
    duracionBloqueMin: 60,
  };

  it('genera todos los bloques como disponibles cuando no hay reservas', () => {
    const bloques = calcularBloquesDisponibilidad(reglasEstandar, []);
    expect(bloques).toHaveLength(3);
    expect(bloques.every((b) => b.disponible)).toBe(true);
    expect(bloques[0]).toEqual({ horaInicio: '08:00', horaFin: '09:00', disponible: true });
  });

  it('marca como ocupado el bloque exacto de una reserva existente', () => {
    const bloques = calcularBloquesDisponibilidad(reglasEstandar, [
      { horaInicioMin: 9 * 60, horaFinMin: 10 * 60 },
    ]);
    const bloque9 = bloques.find((b) => b.horaInicio === '09:00');
    expect(bloque9?.disponible).toBe(false);
    // Los demas bloques siguen libres
    expect(bloques.find((b) => b.horaInicio === '08:00')?.disponible).toBe(true);
    expect(bloques.find((b) => b.horaInicio === '10:00')?.disponible).toBe(true);
  });

  it('marca como ocupados varios bloques si una reserva los cubre parcialmente (solapamiento)', () => {
    // Reserva de 08:30 a 09:30 se solapa con los bloques 08:00-09:00 y 09:00-10:00
    const bloques = calcularBloquesDisponibilidad(reglasEstandar, [
      { horaInicioMin: 8 * 60 + 30, horaFinMin: 9 * 60 + 30 },
    ]);
    expect(bloques.find((b) => b.horaInicio === '08:00')?.disponible).toBe(false);
    expect(bloques.find((b) => b.horaInicio === '09:00')?.disponible).toBe(false);
    expect(bloques.find((b) => b.horaInicio === '10:00')?.disponible).toBe(true);
  });

  it('no marca como ocupado un bloque que termina justo cuando otro empieza (adyacentes, no solapados)', () => {
    const bloques = calcularBloquesDisponibilidad(reglasEstandar, [
      { horaInicioMin: 9 * 60, horaFinMin: 10 * 60 },
    ]);
    // El bloque 08:00-09:00 termina exactamente cuando empieza la reserva -> libre
    expect(bloques.find((b) => b.horaInicio === '08:00')?.disponible).toBe(true);
    // El bloque 10:00-11:00 empieza exactamente cuando termina la reserva -> libre
    expect(bloques.find((b) => b.horaInicio === '10:00')?.disponible).toBe(true);
  });

  it('respeta multiples reservas simultaneas en distintos horarios', () => {
    const bloques = calcularBloquesDisponibilidad(reglasEstandar, [
      { horaInicioMin: 8 * 60, horaFinMin: 9 * 60 },
      { horaInicioMin: 10 * 60, horaFinMin: 11 * 60 },
    ]);
    expect(bloques.map((b) => b.disponible)).toEqual([false, true, false]);
  });

  it('lanza un error si la duracion del bloque es 0 o negativa', () => {
    expect(() =>
      calcularBloquesDisponibilidad({ ...reglasEstandar, duracionBloqueMin: 0 }, []),
    ).toThrow();
  });

  it('lanza un error si la hora de cierre no es mayor a la de apertura', () => {
    expect(() =>
      calcularBloquesDisponibilidad(
        { ...reglasEstandar, horaAperturaMin: 20 * 60, horaCierreMin: 8 * 60 },
        [],
      ),
    ).toThrow();
  });
});

describe('conversion de horas <-> minutos', () => {
  it('convierte minutos a formato HH:mm', () => {
    expect(minutosAHora(0)).toBe('00:00');
    expect(minutosAHora(90)).toBe('01:30');
    expect(minutosAHora(1320)).toBe('22:00');
  });

  it('convierte HH:mm a minutos', () => {
    expect(horaAMinutos('00:00')).toBe(0);
    expect(horaAMinutos('01:30')).toBe(90);
    expect(horaAMinutos('22:00')).toBe(1320);
  });

  it('rechaza formatos de hora invalidos', () => {
    expect(() => horaAMinutos('25:00')).toThrow();
    expect(() => horaAMinutos('10:70')).toThrow();
    expect(() => horaAMinutos('no-es-hora')).toThrow();
  });
});
