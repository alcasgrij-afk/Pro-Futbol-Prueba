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
  ARBITRO: 'Servicio de arbitraje',
  MANUAL: 'Otros pagos',
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
    const pagos = await this.obtenerPagosPorReferencia(tipoReferencia, referenciaIds);
    return new Set(pagos.keys());
  }

  /**
   * Igual que obtenerPagadas pero devuelve CUANDO se pago, con que metodo y con
   * que recibo (el primer pago COMPLETADO de cada referencia). Permite mostrar
   * el pago sobre el registro que lo origino — p.ej. la mensualidad del alumno
   * con su fecha y numero de recibo — sin caer en un N+1.
   */
  async obtenerPagosPorReferencia(
    tipoReferencia: TipoPagoReferencia,
    referenciaIds: string[],
  ): Promise<Map<string, { confirmadoEn: Date | null; numeroRecibo: string | null; gateway: GatewayPago }>> {
    if (referenciaIds.length === 0) return new Map();
    const pagos = await this.prisma.pago.findMany({
      where: { tipoReferencia, referenciaId: { in: referenciaIds }, estado: EstadoPago.COMPLETADO },
      select: { referenciaId: true, confirmadoEn: true, numeroRecibo: true, gateway: true },
      orderBy: { confirmadoEn: 'asc' },
    });

    const mapa = new Map<string, { confirmadoEn: Date | null; numeroRecibo: string | null; gateway: GatewayPago }>();
    for (const pago of pagos) {
      if (mapa.has(pago.referenciaId)) continue; // el primero es el que pago
      mapa.set(pago.referenciaId, {
        confirmadoEn: pago.confirmadoEn,
        numeroRecibo: pago.numeroRecibo,
        gateway: pago.gateway as GatewayPago,
      });
    }
    return mapa;
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
        gateway: pago.gateway,
        codigoAutorizacion: pago.codigoAutorizacion,
        clienteNombre: mensualidad ? `${mensualidad.alumno.nombres} ${mensualidad.alumno.apellidos}`.trim() : null,
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
        gateway: pago.gateway,
        codigoAutorizacion: pago.codigoAutorizacion,
        descripcion: venta
          ? venta.items.map((i) => `${i.cantidad}x ${i.nombreSnapshot}`).join(', ')
          : 'Venta de productos',
      };
    }

    // Cobros manuales de Caja/Pagos (arbitraje y conceptos del catalogo): la
    // descripcion ya quedo snapshoteada al cobrar, no hace falta ir a buscarla.
    if (pago.tipoReferencia === TipoPagoReferencia.ARBITRO || pago.tipoReferencia === TipoPagoReferencia.MANUAL) {
      return {
        paymentId: pago.id,
        estado: pago.estado,
        tipoReferencia: pago.tipoReferencia,
        referenciaId: pago.referenciaId,
        montoQ: Number(pago.montoQ),
        confirmadoEn: pago.confirmadoEn,
        numeroRecibo: pago.numeroRecibo,
        gateway: pago.gateway,
        codigoAutorizacion: pago.codigoAutorizacion,
        descripcion:
          [pago.conceptoSnapshot, pago.nota].filter(Boolean).join(' · ') ||
          ETIQUETA_MODULO[pago.tipoReferencia],
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
   * Resolucion manual de un pago PENDIENTE estancado (panel /superadmin).
   * Mismo efecto que procesarWebhook, pero disparado a mano en vez de por
   * la pasarela; solo actua sobre pagos aun PENDIENTE para no reescribir
   * uno ya resuelto.
   */
  async marcarManualmente(id: string, nuevoEstado: EstadoPago.COMPLETADO | EstadoPago.CANCELADO) {
    const pago = await this.prisma.pago.findUnique({ where: { id } });
    if (!pago) throw new NotFoundException('Pago no encontrado.');
    if (pago.estado !== EstadoPago.PENDIENTE) {
      throw new BadRequestException(`El pago ya esta en estado ${pago.estado}, no se puede marcar manualmente.`);
    }

    await this.prisma.pago.update({
      where: { id: pago.id },
      data:
        nuevoEstado === EstadoPago.COMPLETADO
          ? { estado: EstadoPago.COMPLETADO, confirmadoEn: new Date() }
          : { estado: EstadoPago.CANCELADO },
    });

    if (pago.tipoReferencia === TipoPagoReferencia.RESERVA) {
      if (nuevoEstado === EstadoPago.COMPLETADO) {
        await this.reservasService.confirmar(pago.referenciaId);
      } else {
        await this.reservasService.cancelar(pago.referenciaId);
      }
    }
    // EQUIPO/MENSUALIDAD: sin efecto adicional — estado se lee en vivo de la tabla de pagos.

    this.logger.warn(`Pago ${pago.id} marcado manualmente como ${nuevoEstado} desde /superadmin.`);
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
    montoQ?: number;
  }) {
    const reserva = await this.reservasService.crearReserva({ ...dto, formaPago: FormaPago.EN_SEDE });
    const precioTotalQ = Number(reserva.precioTotalQ);

    let montoQ = dto.gratis ? 0 : precioTotalQ;
    if (!dto.gratis && dto.montoQ != null) {
      if (dto.montoQ > precioTotalQ) {
        // Cancelar la reserva recien creada: si no, un abono invalido deja el
        // horario ocupado por una reserva que nunca se llego a cobrar.
        await this.reservasService.cancelar(reserva.id);
        throw new BadRequestException(
          `El abono (Q${dto.montoQ}) no puede exceder el precio de la reserva (Q${precioTotalQ}).`,
        );
      }
      montoQ = dto.montoQ;
    }

    return this.cobrarEfectivo({
      tipoReferencia: TipoPagoReferencia.RESERVA,
      referenciaId: reserva.id,
      montoQ,
      gateway: dto.metodoPago,
      codigoAutorizacion: dto.codigoAutorizacion,
    });
  }

  /**
   * Saldo pendiente de una reserva: precio menos la suma de sus pagos
   * COMPLETADOS (los abonos son varios Pago sobre la misma reserva, no hay
   * columna montoPagado que se pueda desincronizar).
   */
  async saldoReserva(reservaId: string) {
    const reserva = await this.reservasService.obtenerPorId(reservaId);
    const { _sum } = await this.prisma.pago.aggregate({
      where: {
        tipoReferencia: TipoPagoReferencia.RESERVA,
        referenciaId: reservaId,
        estado: EstadoPago.COMPLETADO,
      },
      _sum: { montoQ: true },
    });

    const precioTotalQ = Number(reserva.precioTotalQ);
    const pagadoQ = Number(_sum.montoQ ?? 0);
    return {
      reservaId,
      precioTotalQ,
      pagadoQ,
      saldoQ: Math.max(Math.round((precioTotalQ - pagadoQ) * 100) / 100, 0),
    };
  }

  /**
   * Abono (pago parcial) de una reserva ya existente, cobrado en Caja. El
   * primer abono ya la deja CONFIRMADA (cobrarEfectivo -> confirmar, que es
   * idempotente), asi que el horario queda apartado y el saldo se cobra
   * cuando el cliente llegue.
   */
  async cobrarAbonoReserva(
    reservaId: string,
    input: { montoQ: number; metodoPago: GatewayPago.EFECTIVO | GatewayPago.TARJETA; codigoAutorizacion?: string },
  ) {
    const saldo = await this.saldoReserva(reservaId);
    if (saldo.saldoQ <= 0) {
      throw new BadRequestException('La reserva ya esta pagada por completo.');
    }
    if (input.montoQ > saldo.saldoQ) {
      throw new BadRequestException(
        `El abono (Q${input.montoQ}) excede el saldo pendiente (Q${saldo.saldoQ}).`,
      );
    }

    return this.cobrarEfectivo({
      tipoReferencia: TipoPagoReferencia.RESERVA,
      referenciaId: reservaId,
      montoQ: input.montoQ,
      gateway: input.metodoPago,
      codigoAutorizacion: input.codigoAutorizacion,
    });
  }

  /**
   * Cobro manual en sede desde /admin/pagos: arbitraje y los conceptos del
   * catalogo editable. Las reservas NO pasan por aqui (se cobran solo desde
   * Caja) y las mensualidades tampoco (usan el endpoint de academia, que las
   * ata al alumno). El nombre del arbitro/concepto se snapshotea en el Pago.
   */
  async cobrarManual(dto: {
    tipo: TipoPagoReferencia.ARBITRO | TipoPagoReferencia.MANUAL;
    referenciaId: string;
    montoQ: number;
    metodoPago: GatewayPago.EFECTIVO | GatewayPago.TARJETA;
    codigoAutorizacion?: string;
    nota?: string;
  }) {
    const conceptoSnapshot = await this.resolverConceptoManual(dto.tipo, dto.referenciaId);

    return this.cobrarEfectivo({
      tipoReferencia: dto.tipo,
      referenciaId: dto.referenciaId,
      montoQ: dto.montoQ,
      gateway: dto.metodoPago,
      codigoAutorizacion: dto.codigoAutorizacion,
      conceptoSnapshot,
      nota: dto.nota,
    });
  }

  private async resolverConceptoManual(
    tipo: TipoPagoReferencia.ARBITRO | TipoPagoReferencia.MANUAL,
    referenciaId: string,
  ): Promise<string> {
    if (tipo === TipoPagoReferencia.ARBITRO) {
      const arbitro = await this.prisma.arbitro.findUnique({ where: { id: referenciaId } });
      if (!arbitro || !arbitro.activo) throw new NotFoundException('Arbitro no encontrado o inactivo.');
      return `Arbitraje — ${arbitro.nombre}`;
    }

    const concepto = await this.prisma.conceptoPago.findUnique({ where: { id: referenciaId } });
    if (!concepto || !concepto.activo) throw new NotFoundException('Concepto de pago no encontrado o inactivo.');
    return concepto.nombre;
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
    conceptoSnapshot?: string;
    nota?: string;
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
        conceptoSnapshot: input.conceptoSnapshot,
        nota: input.nota,
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
  async listar(filtros: {
    desde?: string;
    hasta?: string;
    tipoReferencia?: TipoPagoReferencia;
    referenciaId?: string;
  }) {
    const pagos = await this.prisma.pago.findMany({
      where: {
        ...(filtros.tipoReferencia ? { tipoReferencia: filtros.tipoReferencia } : {}),
        ...(filtros.referenciaId ? { referenciaId: filtros.referenciaId } : {}),
        ...(filtros.desde || filtros.hasta
          ? {
              creadoEn: {
                ...(filtros.desde ? { gte: new Date(filtros.desde) } : {}),
                ...(filtros.hasta ? { lte: this.finDelDia(filtros.hasta) } : {}),
              },
            }
          : {}),
      },
      include: {
        reserva: { select: { cancha: { select: { nombre: true } }, cliente: { select: { nombre: true } } } },
      },
      orderBy: { creadoEn: 'desc' },
    });

    const mensualidades = await this.describirMensualidades(pagos);

    return pagos.map((p) => ({
      paymentId: p.id,
      tipoReferencia: p.tipoReferencia,
      etiqueta: ETIQUETA_MODULO[p.tipoReferencia] ?? p.tipoReferencia,
      gateway: p.gateway,
      estado: p.estado,
      montoQ: Number(p.montoQ),
      numeroRecibo: p.numeroRecibo,
      descripcion: p.reserva
        ? [p.reserva.cancha?.nombre, p.reserva.cliente?.nombre].filter(Boolean).join(' · ')
        : (mensualidades.get(p.referenciaId) ??
          ([p.conceptoSnapshot, p.nota].filter(Boolean).join(' · ') || null)),
      creadoEn: p.creadoEn,
      confirmadoEn: p.confirmadoEn,
    }));
  }

  /**
   * Nombre del alumno + mes/anio de las filas MENSUALIDAD del listado, en UNA
   * sola consulta (misma descripcion que ReportesService.describirReferencia,
   * pero en lote para no caer en un N+1 al pintar la bitacora).
   */
  private async describirMensualidades(
    pagos: { tipoReferencia: string; referenciaId: string }[],
  ): Promise<Map<string, string>> {
    const ids = pagos
      .filter((p) => p.tipoReferencia === TipoPagoReferencia.MENSUALIDAD)
      .map((p) => p.referenciaId);
    if (ids.length === 0) return new Map();

    const mensualidades = await this.prisma.academiaMensualidad.findMany({
      where: { id: { in: ids } },
      include: { alumno: { select: { nombres: true, apellidos: true } } },
    });

    return new Map(
      mensualidades.map((m) => [
        m.id,
        `Mensualidad ${m.mes}/${m.anio} · ${m.alumno.nombres} ${m.alumno.apellidos}`.trim(),
      ]),
    );
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
