import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EstadoPago, FormaPago, GatewayPago, TipoPagoReferencia } from '@profutbol/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { ReservasService } from '../reservas/reservas.service';
import { minutosAHora } from '../canchas/disponibilidad.util';
import { GatewayService } from './gateways/gateway.service';

const ETIQUETA_MODULO: Record<string, string> = {
  RESERVA: 'Reserva de cancha',
  EQUIPO: 'Cuota de torneo',
  MENSUALIDAD: 'Mensualidad de academia',
  VENTA: 'Venta de productos',
};

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

    return this.crearPagoConReferencia(gateway, {
      tipoReferencia: TipoPagoReferencia.RESERVA,
      referenciaId: reserva.id,
      reservaId: reserva.id,
      montoQ: monto,
      descripcion: `Reserva ${reserva.cancha!.nombre} - ${reserva.fecha.toISOString().slice(0, 10)}`,
      returnUrl: dto.returnUrl,
    });
  }

  /**
   * Pago de cuota de inscripcion de un equipo de torneo (tipoReferencia=EQUIPO).
   * Devuelve la URL de redireccion a la pasarela; al confirmarse, el estado se
   * lee en vivo desde la tabla de pagos (no hay columna cuotaPagada).
   */
  async crearPagoEquipo(
    gateway: GatewayPago,
    input: { equipoId: string; torneoNombre: string; cuotaQ: number; returnUrl?: string },
  ) {
    return this.crearPagoConReferencia(gateway, {
      tipoReferencia: TipoPagoReferencia.EQUIPO,
      referenciaId: input.equipoId,
      reservaId: null,
      montoQ: input.cuotaQ,
      descripcion: `Inscripcion equipo - ${input.torneoNombre}`,
      returnUrl: input.returnUrl,
    });
  }

  /**
   * Pago de mensualidad de academia (tipoReferencia=MENSUALIDAD).
   * Referencia una AcademiaMensualidad; al confirmarse, el estado se lee en
   * vivo desde la tabla de pagos (no hay columna pagada en la mensualidad).
   */
  async crearPagoMensualidad(
    gateway: GatewayPago,
    input: { mensualidadId: string; descripcion: string; montoQ: number; returnUrl?: string },
  ) {
    return this.crearPagoConReferencia(gateway, {
      tipoReferencia: TipoPagoReferencia.MENSUALIDAD,
      referenciaId: input.mensualidadId,
      reservaId: null,
      montoQ: input.montoQ,
      descripcion: input.descripcion,
      returnUrl: input.returnUrl,
    });
  }

  /** Devuelve true si existe un pago COMPLETADO para la referencia dada. */
  async estaPagada(tipoReferencia: TipoPagoReferencia, referenciaId: string): Promise<boolean> {
    const pago = await this.prisma.pago.findFirst({
      where: { tipoReferencia, referenciaId, estado: EstadoPago.COMPLETADO },
    });
    return !!pago;
  }

  /**
   * Version batch de estaPagada: devuelve el conjunto de referencias que tienen
   * un pago COMPLETADO en una sola consulta (evita el N+1 al listar muchas).
   */
  async obtenerPagadas(tipoReferencia: TipoPagoReferencia, referenciaIds: string[]): Promise<Set<string>> {
    if (referenciaIds.length === 0) return new Set();
    const pagos = await this.prisma.pago.findMany({
      where: { tipoReferencia, referenciaId: { in: referenciaIds }, estado: EstadoPago.COMPLETADO },
      select: { referenciaId: true },
    });
    return new Set(pagos.map((p) => p.referenciaId));
  }

  private async crearPagoConReferencia(
    gateway: GatewayPago,
    input: {
      tipoReferencia: TipoPagoReferencia;
      referenciaId: string;
      reservaId: string | null;
      montoQ: number;
      descripcion: string;
      returnUrl?: string;
    },
  ) {
    const pago = await this.prisma.pago.create({
      data: {
        tipoReferencia: input.tipoReferencia,
        referenciaId: input.referenciaId,
        reservaId: input.reservaId,
        gateway,
        montoQ: input.montoQ,
        estado: EstadoPago.PENDIENTE,
        redirectUrl: null,
        referenciaExterna: null,
      },
    });

    const redireccion = await this.gateway.createRedirectPayment(gateway, {
      paymentId: pago.id,
      montoQ: input.montoQ,
      descripcion: input.descripcion,
      returnUrl: input.returnUrl,
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

  /** Estado del pago + detalle de su referencia (para la pagina de resultado). */
  async obtenerPago(id: string) {
    const pago = await this.prisma.pago.findUnique({
      where: { id },
      include: {
        reserva: {
          select: {
            estado: true,
            fecha: true,
            horaInicioMin: true,
            cancha: { select: { nombre: true } },
            cliente: { select: { nombre: true, telefono: true } },
          },
        },
      },
    });
    if (!pago) throw new NotFoundException('Pago no encontrado.');

    if (pago.tipoReferencia === TipoPagoReferencia.EQUIPO) {
      const equipo = await this.prisma.equipo.findUnique({
        where: { id: pago.referenciaId },
        include: { torneo: { select: { nombre: true } } },
      });
      return {
        paymentId: pago.id,
        estado: pago.estado,
        tipoReferencia: pago.tipoReferencia,
        referenciaId: pago.referenciaId,
        montoQ: Number(pago.montoQ),
        confirmadoEn: pago.confirmadoEn,
        numeroRecibo: pago.numeroRecibo,
        descripcion: equipo ? `${equipo.torneo.nombre} · ${equipo.nombre}` : 'Cuota de inscripcion',
      };
    }

    if (pago.tipoReferencia === TipoPagoReferencia.MENSUALIDAD) {
      const mensualidad = await this.prisma.academiaMensualidad.findUnique({
        where: { id: pago.referenciaId },
        include: { alumno: { select: { nombres: true, apellidos: true } } },
      });
      return {
        paymentId: pago.id,
        estado: pago.estado,
        tipoReferencia: pago.tipoReferencia,
        referenciaId: pago.referenciaId,
        montoQ: Number(pago.montoQ),
        confirmadoEn: pago.confirmadoEn,
        numeroRecibo: pago.numeroRecibo,
        descripcion: mensualidad
          ? `Mensualidad academia ${mensualidad.mes}/${mensualidad.anio} - ${mensualidad.alumno.nombres} ${mensualidad.alumno.apellidos}`
          : 'Mensualidad de academia',
      };
    }

    if (pago.tipoReferencia === TipoPagoReferencia.VENTA) {
      const venta = await this.prisma.venta.findUnique({
        where: { id: pago.referenciaId },
        include: { items: true },
      });
      return {
        paymentId: pago.id,
        estado: pago.estado,
        tipoReferencia: pago.tipoReferencia,
        referenciaId: pago.referenciaId,
        montoQ: Number(pago.montoQ),
        confirmadoEn: pago.confirmadoEn,
        numeroRecibo: pago.numeroRecibo,
        descripcion: venta
          ? venta.items.map((i) => `${i.cantidad}x ${i.nombreSnapshot}`).join(', ')
          : 'Venta de productos',
      };
    }

    return {
      paymentId: pago.id,
      estado: pago.estado,
      tipoReferencia: pago.tipoReferencia,
      referenciaId: pago.referenciaId,
      reservaEstado: pago.reserva?.estado ?? null,
      canchaNombre: pago.reserva?.cancha?.nombre ?? null,
      fecha: pago.reserva?.fecha ?? null,
      horaInicio: pago.reserva?.horaInicioMin != null ? minutosAHora(pago.reserva.horaInicioMin) : null,
      montoQ: Number(pago.montoQ),
      confirmadoEn: pago.confirmadoEn,
      clienteNombre: pago.reserva?.cliente?.nombre ?? null,
      clienteTelefono: pago.reserva?.cliente?.telefono ?? null,
      gateway: pago.gateway,
      codigoAutorizacion: pago.codigoAutorizacion,
      numeroRecibo: pago.numeroRecibo,
    };
  }

  /**
   * Webhook de confirmacion de pago (verificado con HMAC fuera de aqui, en el
   * controller, contra el rawBody). Si el pago fue aprobado, confirma la
   * referencia asociada (reserva o cuota de equipo). Es idempotente.
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

    if (pago.tipoReferencia === TipoPagoReferencia.RESERVA) {
      await this.reservasService.confirmar(pago.referenciaId, payload.referenciaPago);
    }
    // EQUIPO: sin efecto adicional — cuotaPagada se calcula al leer la tabla de pagos.

    return this.obtenerPago(pago.id);
  }

  /**
   * Modulo de Caja: crea una reserva walk-in (EN_SEDE) y la cobra en
   * efectivo en el mismo paso, quedando CONFIRMADA de inmediato (sin la
   * ventana de 30 min de espera que aplica al flujo normal del bot).
   */
  async cobrarReservaSede(dto: {
    canchaId: string;
    clienteTelefono: string;
    clienteNombre: string;
    fecha: string;
    horaInicio: string;
    metodoPago: GatewayPago.EFECTIVO | GatewayPago.TARJETA;
    codigoAutorizacion?: string;
    gratis?: boolean;
  }) {
    const reserva = await this.reservasService.crearReserva({ ...dto, formaPago: FormaPago.EN_SEDE });
    return this.cobrarEfectivo({
      tipoReferencia: TipoPagoReferencia.RESERVA,
      referenciaId: reserva.id,
      montoQ: dto.gratis ? 0 : Number(reserva.precioTotalQ),
      gateway: dto.metodoPago,
      codigoAutorizacion: dto.codigoAutorizacion,
    });
  }

  /**
   * Cobro en efectivo registrado desde el modulo de Caja (walk-in): crea el
   * Pago ya COMPLETADO (el dinero se recibio en el momento, no hay gateway
   * ni webhook de por medio) y, si es una reserva, la confirma de inmediato
   * (cancela el job de liberacion por timeout via ReservasService.confirmar).
   */
  async cobrarEfectivo(input: {
    tipoReferencia: TipoPagoReferencia;
    referenciaId: string;
    montoQ: number;
    gateway?: GatewayPago;
    codigoAutorizacion?: string;
  }) {
    const gateway = input.gateway ?? GatewayPago.EFECTIVO;
    const numeroRecibo = await this.generarNumeroRecibo();
    const pago = await this.prisma.pago.create({
      data: {
        tipoReferencia: input.tipoReferencia,
        referenciaId: input.referenciaId,
        reservaId: input.tipoReferencia === TipoPagoReferencia.RESERVA ? input.referenciaId : null,
        gateway,
        montoQ: input.montoQ,
        estado: EstadoPago.COMPLETADO,
        confirmadoEn: new Date(),
        referenciaExterna: `${gateway.toLowerCase()}-${Date.now()}`,
        codigoAutorizacion: input.codigoAutorizacion,
        numeroRecibo,
      },
    });

    if (input.tipoReferencia === TipoPagoReferencia.RESERVA) {
      await this.reservasService.confirmar(input.referenciaId, pago.referenciaExterna!);
    }

    return this.obtenerPago(pago.id);
  }

  /**
   * Bitacora de pagos para el modulo de Caja (/admin/pagos): todos los Pago
   * sin importar el modulo, mas recientes primero. Para RESERVA se incluye
   * cancha + cliente (misma relacion que obtenerPago); para EQUIPO/
   * MENSUALIDAD/VENTA la etiqueta del modulo ya es suficiente descripcion
   * en un listado (el detalle completo esta en la pagina de cada modulo).
   */
  async listar(filtros: { desde?: string; hasta?: string }) {
    const pagos = await this.prisma.pago.findMany({
      where:
        filtros.desde || filtros.hasta
          ? {
              creadoEn: {
                ...(filtros.desde ? { gte: new Date(filtros.desde) } : {}),
                ...(filtros.hasta ? { lte: this.finDelDia(filtros.hasta) } : {}),
              },
            }
          : {},
      include: {
        reserva: { select: { cancha: { select: { nombre: true } }, cliente: { select: { nombre: true } } } },
      },
      orderBy: { creadoEn: 'desc' },
    });

    return pagos.map((p) => ({
      paymentId: p.id,
      tipoReferencia: p.tipoReferencia,
      etiqueta: ETIQUETA_MODULO[p.tipoReferencia] ?? p.tipoReferencia,
      gateway: p.gateway,
      estado: p.estado,
      montoQ: Number(p.montoQ),
      descripcion: p.reserva
        ? [p.reserva.cancha?.nombre, p.reserva.cliente?.nombre].filter(Boolean).join(' · ')
        : null,
      creadoEn: p.creadoEn,
      confirmadoEn: p.confirmadoEn,
    }));
  }

  /**
   * Secuencia atomica por anio para el numero de recibo impreso. El upsert
   * con increment es atomico a nivel de fila en Postgres: dos cobros
   * simultaneos no pueden terminar con el mismo numero.
   */
  private async generarNumeroRecibo(): Promise<string> {
    const anio = new Date().getFullYear();
    const contador = await this.prisma.reciboContador.upsert({
      where: { anio },
      create: { anio, ultimoNumero: 1 },
      update: { ultimoNumero: { increment: 1 } },
    });
    return `REC-${anio}-${String(contador.ultimoNumero).padStart(6, '0')}`;
  }

  private finDelDia(fecha: string): Date {
    const d = new Date(fecha);
    d.setHours(23, 59, 59, 999);
    return d;
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

    if (pago.tipoReferencia === TipoPagoReferencia.RESERVA) {
      await this.reservasService.confirmar(pago.referenciaId, `sim-${paymentId}`);
    }

    return this.obtenerPago(paymentId);
  }
}
