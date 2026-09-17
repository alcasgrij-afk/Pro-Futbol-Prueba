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

    // Filter out past time slots when reserving for today
    const hoy = this.fechaHoy();
    const esHoy = fecha === hoy;

    if (esHoy) {
      const ahoraMin = this.horaActualMinutos();
      return {
        canchaId,
        fecha,
        bloques: bloques.map((b) => {
          // Parse horaInicio to minutes for comparison
          const [h, m] = b.horaInicio.split(':').map(Number);
          const bloqueInicioMin = h * 60 + m;

          // Mark as unavailable if the block starts in the past
          return bloqueInicioMin <= ahoraMin
            ? { ...b, disponible: false }
            : b;
        }),
      };
    }

    return { canchaId, fecha, bloques };
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
