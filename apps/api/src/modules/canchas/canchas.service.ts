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

    return { canchaId, fecha, bloques };
  }
}
