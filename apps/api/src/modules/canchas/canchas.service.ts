import { Injectable, NotFoundException } from '@nestjs/common';
import { EstadoReserva } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { calcularBloquesDisponibilidad } from './disponibilidad.util';

// Estados que efectivamente "ocupan" el horario a efectos de disponibilidad.
const ESTADOS_ACTIVOS: EstadoReserva[] = [
  EstadoReserva.CONFIRMADA,
  EstadoReserva.PENDIENTE_PAGO,
  EstadoReserva.PENDIENTE_SEDE,
];

@Injectable()
export class CanchasService {
  constructor(private readonly prisma: PrismaService) {}

  async listar() {
    return this.prisma.cancha.findMany({ where: { activa: true }, orderBy: { nombre: 'asc' } });
  }

  async obtenerPorId(canchaId: string) {
    const cancha = await this.prisma.cancha.findUnique({ where: { id: canchaId } });
    if (!cancha) throw new NotFoundException('Cancha no encontrada.');
    return cancha;
  }

  async disponibilidad(canchaId: string, fecha: string) {
    const cancha = await this.obtenerPorId(canchaId);

    const reservasDelDia = await this.prisma.reserva.findMany({
      where: {
        canchaId,
        fecha: new Date(fecha),
        estado: { in: ESTADOS_ACTIVOS },
      },
      select: { horaInicioMin: true, horaFinMin: true },
    });

    const bloques = calcularBloquesDisponibilidad(
      {
        horaAperturaMin: cancha.horaAperturaMin,
        horaCierreMin: cancha.horaCierreMin,
        duracionBloqueMin: cancha.duracionBloqueMin,
      },
      reservasDelDia,
    );

    return { canchaId, fecha, bloques: this.filtrarBloquesPasados(bloques, fecha) };
  }

  /**
   * Misma disponibilidad, pero para todas las canchas activas en una sola
   * consulta: evita el fan-out de N requests (una por cancha) que hacia el
   * frontend del selector de horarios en cada carga.
   */
  async disponibilidadTodas(fecha: string) {
    const canchas = await this.listar();
    if (canchas.length === 0) return [];

    const reservasDelDia = await this.prisma.reserva.findMany({
      where: {
        canchaId: { in: canchas.map((c) => c.id) },
        fecha: new Date(fecha),
        estado: { in: ESTADOS_ACTIVOS },
      },
      select: { canchaId: true, horaInicioMin: true, horaFinMin: true },
    });

    const reservasPorCancha = new Map<string, { horaInicioMin: number; horaFinMin: number }[]>();
    for (const r of reservasDelDia) {
      const lista = reservasPorCancha.get(r.canchaId) ?? [];
      lista.push({ horaInicioMin: r.horaInicioMin, horaFinMin: r.horaFinMin });
      reservasPorCancha.set(r.canchaId, lista);
    }

    return canchas.map((cancha) => {
      const bloques = calcularBloquesDisponibilidad(
        {
          horaAperturaMin: cancha.horaAperturaMin,
          horaCierreMin: cancha.horaCierreMin,
          duracionBloqueMin: cancha.duracionBloqueMin,
        },
        reservasPorCancha.get(cancha.id) ?? [],
      );
      return { canchaId: cancha.id, fecha, bloques: this.filtrarBloquesPasados(bloques, fecha) };
    });
  }

  private filtrarBloquesPasados(bloques: ReturnType<typeof calcularBloquesDisponibilidad>, fecha: string) {
    if (fecha !== this.fechaHoy()) return bloques;

    const ahoraMin = this.horaActualMinutos();
    return bloques.map((b) => {
      const [h, m] = b.horaInicio.split(':').map(Number);
      const bloqueInicioMin = h * 60 + m;
      return bloqueInicioMin <= ahoraMin ? { ...b, disponible: false } : b;
    });
  }

  private fechaHoy(): string {
    // Fecha local (no UTC): el cliente manda su fecha local; comparar contra el
    // "hoy" UTC rechazaria reservas del dia actual en horas de la tarde/noche.
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  private horaActualMinutos(): number {
    const ahora = new Date();
    return ahora.getHours() * 60 + ahora.getMinutes();
  }
}
