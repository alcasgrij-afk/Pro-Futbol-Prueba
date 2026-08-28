import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EstadoPago, GatewayPago, TipoPagoReferencia } from '@profutbol/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { ReservasService } from '../reservas/reservas.service';
import { GatewayService } from './gateways/gateway.service';

@Injectable()
export class PagosService {
  private readonly logger = new Logger(PagosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly reservasService: ReservasService,
    private readonly gateway: GatewayService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Crea un registro de Pago PENDIENTE para una reserva y devuelve la URL de
   * redireccion a la pasarela. El cliente es redirigido ahi y la pasarela
   * avisa el resultado por webhook (o se simula en desarrollo).
   */
  async crearPago(gateway: GatewayPago, dto: { referenciaTipo: TipoPagoReferencia; referenciaId: string; monto?: number; returnUrl?: string }) {
    if (dto.referenciaTipo !== TipoPagoReferencia.RESERVA) {
      throw new BadRequestException('Tipo de referencia no soportado.');
    }

    const reserva = await this.reservasService.obtenerPorId(dto.referenciaId);

    if (reserva.estado !== 'PENDIENTE_PAGO') {
      throw new BadRequestException(
        `La reserva debe estar en estado PENDIENTE_PAGO para crear un pago (estado actual: ${reserva.estado}).`,
      );
    }

    const monto = Number(reserva.precioTotalQ);
    if (dto.monto !== undefined && Number(dto.monto) !== monto) {
      throw new BadRequestException(`El monto enviado (${dto.monto}) no coincide con el de la reserva (${monto}).`);
    }

    const pago = await this.prisma.pago.create({
      data: {
        reservaId: reserva.id,
        gateway,
        montoQ: monto,
        estado: EstadoPago.PENDIENTE,
        redirectUrl: null,
        referenciaExterna: null,
      },
    });

    const redireccion = await this.gateway.createRedirectPayment(gateway, {
      paymentId: pago.id,
      montoQ: monto,
      descripcion: `Reserva ${reserva.cancha!.nombre} - ${reserva.fecha.toISOString().slice(0, 10)}`,
      returnUrl: dto.returnUrl,
    });

    const actualizado = await this.prisma.pago.update({
      where: { id: pago.id },
      data: { redirectUrl: redireccion.redirectUrl },
    });

    return {
      paymentId: actualizado.id,
      redirectUrl: actualizado.redirectUrl,
      gateway,
    };
  }

  /** Estado del pago + estado de su reserva (para la pagina de resultado). */
  async obtenerPago(id: string) {
    const pago = await this.prisma.pago.findUnique({
      where: { id },
      include: { reserva: { select: { estado: true, cancha: { select: { nombre: true } } } } },
    });
    if (!pago) throw new NotFoundException('Pago no encontrado.');
    return {
      paymentId: pago.id,
      estado: pago.estado,
      reservaEstado: pago.reserva.estado,
      canchaNombre: pago.reserva.cancha.nombre,
      montoQ: Number(pago.montoQ),
      confirmadoEn: pago.confirmadoEn,
    };
  }

  /**
   * Webhook de confirmacion de pago (verificado con HMAC fuera de aqui, en el
   * controller, contra el rawBody). Si el pago fue aprobado, confirma la
   * reserva asociada. Es idempotente.
   */
  async procesarWebhook(gateway: GatewayPago, payload: { referenciaId: string; estado: string; referenciaPago?: string }) {
    const pago = await this.prisma.pago.findUnique({ where: { id: payload.referenciaId } });
    if (!pago) throw new NotFoundException('Pago no encontrado.');

    if (pago.estado === EstadoPago.COMPLETADO) {
      return this.obtenerPago(pago.id); // ya confirmado, idempotente
    }

    if (payload.estado !== 'APROBADO' && payload.estado !== 'COMPLETADO') {
      await this.prisma.pago.update({
        where: { id: pago.id },
        data: { estado: EstadoPago.FALLIDO },
      });
      this.logger.warn(`Pago ${pago.id} (${gateway}) marcado FALLIDO: ${payload.estado}`);
      return this.obtenerPago(pago.id);
    }

    await this.prisma.pago.update({
      where: { id: pago.id },
      data: {
        estado: EstadoPago.COMPLETADO,
        referenciaExterna: payload.referenciaPago,
        confirmadoEn: new Date(),
      },
    });

    await this.reservasService.confirmar(pago.reservaId, payload.referenciaPago);

    return this.obtenerPago(pago.id);
  }

  /** Confirma un pago simulado de desarrollo (equivale al webhook). */
  async confirmarPagoSimulado(paymentId: string) {
    const pago = await this.prisma.pago.findUnique({ where: { id: paymentId } });
    if (!pago) throw new NotFoundException('Pago no encontrado.');

    if (pago.estado === EstadoPago.COMPLETADO) {
      return this.obtenerPago(pago.id);
    }

    await this.prisma.pago.update({
      where: { id: paymentId },
      data: { estado: EstadoPago.COMPLETADO, confirmadoEn: new Date(), referenciaExterna: `sim-${paymentId}` },
    });

    await this.reservasService.confirmar(pago.reservaId, `sim-${paymentId}`);
    return this.obtenerPago(paymentId);
  }
}
