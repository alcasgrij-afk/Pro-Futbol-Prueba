import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EstadoPago, TipoPagoReferencia } from '@prisma/client';
import { GatewayPago } from '@profutbol/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { PagosService } from '../pagos/pagos.service';
import { EquipoDTO } from '@profutbol/shared-types';

@Injectable()
export class EquiposService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pagosService: PagosService,
  ) {}

  private aDTO(e: { id: string; torneoId: string; nombre: string; capitanNombre: string | null; capitanTelefono: string | null; creadoEn: Date }, cuotaPagada: boolean): EquipoDTO {
    return {
      id: e.id,
      torneoId: e.torneoId,
      nombre: e.nombre,
      capitanNombre: e.capitanNombre,
      capitanTelefono: e.capitanTelefono,
      cuotaPagada,
      creadoEn: e.creadoEn.toISOString(),
    };
  }

  /**
   * Inscribe un equipo en un torneo. Si la cuota es mayor a 0, crea un Pago
   * de inscripcion (tipoReferencia=EQUIPO) por redireccion y devuelve su
   * redirectUrl; si es Q0, no genera ningun pago.
   */
  async inscribir(input: {
    torneoId: string;
    nombre: string;
    capitanNombre?: string;
    capitanTelefono?: string;
    jugadores?: unknown;
    gateway?: GatewayPago;
  }) {
    const torneo = await this.prisma.torneo.findUnique({ where: { id: input.torneoId } });
    if (!torneo) throw new NotFoundException('Torneo no encontrado.');
    if (torneo.estado !== 'INSCRIPCIONES_ABIERTAS') {
      throw new BadRequestException('El torneo no acepta inscripciones en este momento.');
    }

    const count = await this.prisma.equipo.count({ where: { torneoId: input.torneoId } });
    if (count >= torneo.maxEquipos) {
      throw new BadRequestException('El torneo alcanzo su cupo maximo de equipos.');
    }

    const existente = await this.prisma.equipo.findUnique({
      where: { torneoId_nombre: { torneoId: input.torneoId, nombre: input.nombre } },
    });
    if (existente) {
      throw new BadRequestException('Ya existe un equipo con ese nombre en el torneo.');
    }

    const equipo = await this.prisma.equipo.create({
      data: {
        torneoId: input.torneoId,
        nombre: input.nombre,
        capitanNombre: input.capitanNombre,
        capitanTelefono: input.capitanTelefono,
        jugadores: (input.jugadores as object) ?? undefined,
      },
    });

    const cuota = Number(torneo.cuotaInscripcionQ);
    if (cuota > 0) {
      const pago = await this.pagosService.crearPagoEquipo(input.gateway ?? GatewayPago.BAC, {
        equipoId: equipo.id,
        torneoNombre: torneo.nombre,
        cuotaQ: cuota,
      });
      return { equipo: this.aDTO(equipo, false), redirectUrl: pago.redirectUrl, paymentId: pago.paymentId };
    }

    return { equipo: this.aDTO(equipo, false), redirectUrl: null, paymentId: null };
  }

  /** Equipos de un torneo con la cuotaPagada calculada al vuelo desde pagos. */
  async listarDeTorneo(torneoId: string): Promise<EquipoDTO[]> {
    const equipos = await this.prisma.equipo.findMany({
      where: { torneoId },
      orderBy: { creadoEn: 'asc' },
    });

    const pagos = await this.prisma.pago.findMany({
      where: {
        tipoReferencia: TipoPagoReferencia.EQUIPO,
        estado: EstadoPago.COMPLETADO,
        referenciaId: { in: equipos.map((e) => e.id) },
      },
      select: { referenciaId: true },
    });
    const pagados = new Set(pagos.map((p) => p.referenciaId));

    return equipos.map((e) => this.aDTO(e, pagados.has(e.id)));
  }
}
