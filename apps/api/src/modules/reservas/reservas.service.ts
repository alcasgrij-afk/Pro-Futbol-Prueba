import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { EstadoReserva, FormaPago, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { ClientesService } from '../clientes/clientes.service';
import { CanchasService } from '../canchas/canchas.service';
import { PricingService } from '../pricing/pricing.service';
import { CrearReservaDto } from './dto/crear-reserva.dto';
import { horaAMinutos } from '../canchas/disponibilidad.util';
import { RESERVAS_QUEUE } from '../../queue/queue.module';

const ESTADOS_ACTIVOS: EstadoReserva[] = [
  EstadoReserva.CONFIRMADA,
  EstadoReserva.PENDIENTE_PAGO,
  EstadoReserva.PENDIENTE_SEDE,
];

export const JOB_LIBERAR_RESERVA = 'liberar-reserva-pendiente';

@Injectable()
export class ReservasService {
  private readonly logger = new Logger(ReservasService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly clientesService: ClientesService,
    private readonly canchasService: CanchasService,
    private readonly config: ConfigService,
    private readonly pricingService: PricingService,
    @InjectQueue(RESERVAS_QUEUE) private readonly reservasQueue: Queue,
  ) {}

  async crearReserva(dto: CrearReservaDto) {
    const cancha = await this.canchasService.obtenerPorId(dto.canchaId);
    if (!cancha.activa) {
      throw new BadRequestException('Esta cancha no esta disponible para reservas.');
    }

    // El picker del chat usa min=hoy; este guard es la red de seguridad para
    // cualquier llamador: no se crean reservas en fechas pasadas. "hoy" en
    // fecha local (el cliente manda su fecha local, no UTC).
    const d = new Date();
    const hoyLocal = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (dto.fecha < hoyLocal) {
      throw new BadRequestException('No se puede reservar para una fecha pasada.');
    }

    const horaInicioMin = horaAMinutos(dto.horaInicio);
    const horaFinMin = horaInicioMin + cancha.duracionBloqueMin;

    this.validarHorarioDentroDeOperacion(cancha, horaInicioMin, horaFinMin);

    const claveLock = this.claveLockHorario(dto.canchaId, dto.fecha, horaInicioMin);

    // --- Capa 1 de defensa: lock distribuido en Redis ---
    // TTL corto (10s): solo protege la ventana de creacion misma, no la
    // reserva completa (eso lo maneja el campo `expiraEn` + el job de BullMQ).
    const lockObtenido = await this.redis.adquirirLock(claveLock, 10);
    if (!lockObtenido) {
      throw new ConflictException(
        'Alguien mas esta reservando este horario en este momento. Intenta de nuevo en unos segundos.',
      );
    }

    try {
      return await this.crearReservaDentroDeLock(dto, cancha, horaInicioMin, horaFinMin);
    } finally {
      await this.redis.liberarLock(claveLock);
    }
  }

  private async crearReservaDentroDeLock(
    dto: CrearReservaDto,
    cancha: { id: string; precioAnticipadoQ: Prisma.Decimal; precioSedeQ: Prisma.Decimal },
    horaInicioMin: number,
    horaFinMin: number,
  ) {
    const cliente = await this.clientesService.buscarOCrear(dto.clienteTelefono, dto.clienteNombre);

    const precioTotalQ = this.pricingService.calcular(dto.formaPago, cancha);

    const estadoInicial =
      dto.formaPago === FormaPago.ANTICIPADO_EN_LINEA
        ? EstadoReserva.PENDIENTE_PAGO
        : EstadoReserva.PENDIENTE_SEDE;

    const minutosTimeout =
      dto.formaPago === FormaPago.ANTICIPADO_EN_LINEA
        ? this.config.get<number>('RESERVA_TIMEOUT_PAGO_EN_LINEA_MIN', 15)
        : this.config.get<number>('RESERVA_TIMEOUT_PAGO_EN_SEDE_MIN', 30);

    const expiraEn = new Date(Date.now() + minutosTimeout * 60_000);

    // --- Capa 2 de defensa: verificar dentro de una transaccion que nadie
    // haya confirmado ya una reserva activa en este horario (cubre el caso
    // borde de que el lock de Redis haya expirado por alguna razon). ---
    const reserva = await this.prisma.$transaction(async (tx) => {
      const existente = await tx.reserva.findFirst({
        where: {
          canchaId: dto.canchaId,
          fecha: new Date(dto.fecha),
          horaInicioMin,
          estado: { in: ESTADOS_ACTIVOS },
        },
      });
      if (existente) {
        throw new ConflictException('Ese horario ya fue reservado. Elegi otro horario.');
      }

      return tx.reserva.create({
        data: {
          canchaId: dto.canchaId,
          clienteId: cliente.id,
          fecha: new Date(dto.fecha),
          horaInicioMin,
          horaFinMin,
          estado: estadoInicial,
          formaPago: dto.formaPago,
          precioTotalQ,
          expiraEn,
        },
        include: { cancha: true, cliente: true },
      });
    });

    // Job que libera automaticamente el horario si no hay confirmacion a
    // tiempo. jobId = reserva.id (uuid, unico) permite cancelarlo puntualmente
    // despues. Nota: BullMQ no permite ":" en el custom jobId.
    await this.reservasQueue.add(
      JOB_LIBERAR_RESERVA,
      { reservaId: reserva.id },
      { delay: minutosTimeout * 60_000, jobId: reserva.id },
    );

    this.logger.log(
      `Reserva ${reserva.id} creada (${estadoInicial}), expira en ${minutosTimeout} min si no hay pago.`,
    );

    return reserva;
  }

  async confirmar(reservaId: string, referenciaPago?: string) {
    const reserva = await this.obtenerPorId(reservaId);

    if (!ESTADOS_ACTIVOS.includes(reserva.estado) || reserva.estado === EstadoReserva.CONFIRMADA) {
      if (reserva.estado === EstadoReserva.CONFIRMADA) return reserva; // idempotente
      throw new BadRequestException(
        `No se puede confirmar una reserva en estado ${reserva.estado}.`,
      );
    }

    const actualizada = await this.prisma.reserva.update({
      where: { id: reservaId },
      data: {
        estado: EstadoReserva.CONFIRMADA,
        referenciaPago: referenciaPago ?? reserva.referenciaPago,
      },
      include: { cancha: true, cliente: true },
    });

    await this.cancelarJobDeLiberacion(reservaId);
    this.logger.log(`Reserva ${reservaId} confirmada.`);
    return actualizada;
  }

  async cancelar(reservaId: string) {
    const reserva = await this.obtenerPorId(reservaId);
    if (reserva.estado === EstadoReserva.CANCELADA) return reserva;

    const actualizada = await this.prisma.reserva.update({
      where: { id: reservaId },
      data: { estado: EstadoReserva.CANCELADA },
    });

    await this.cancelarJobDeLiberacion(reservaId);
    return actualizada;
  }

  /**
   * Invocado por el worker de BullMQ cuando el timeout de pago se cumple.
   * Solo libera si la reserva SIGUE pendiente (si ya fue confirmada o
   * cancelada antes del timeout, no hace nada: es una operacion idempotente).
   */
  async liberarPorTimeout(reservaId: string) {
    const reserva = await this.prisma.reserva.findUnique({ where: { id: reservaId } });
    if (!reserva) return;

    if (reserva.estado !== EstadoReserva.PENDIENTE_PAGO && reserva.estado !== EstadoReserva.PENDIENTE_SEDE) {
      return; // ya fue confirmada o cancelada; no hacer nada
    }

    await this.prisma.reserva.update({
      where: { id: reservaId },
      data: { estado: EstadoReserva.LIBERADA },
    });
    this.logger.log(`Reserva ${reservaId} liberada automaticamente por timeout de pago.`);
  }

  async obtenerPorId(reservaId: string) {
    const reserva = await this.prisma.reserva.findUnique({
      where: { id: reservaId },
      include: { cancha: true, cliente: true },
    });
    if (!reserva) throw new NotFoundException('Reserva no encontrada.');
    return reserva;
  }

  async listar(filtros: { fecha?: string; estado?: EstadoReserva }) {
    return this.prisma.reserva.findMany({
      where: {
        ...(filtros.fecha ? { fecha: new Date(filtros.fecha) } : {}),
        ...(filtros.estado ? { estado: filtros.estado } : {}),
      },
      include: { cancha: true, cliente: true },
      orderBy: [{ fecha: 'asc' }, { horaInicioMin: 'asc' }],
    });
  }

  private async cancelarJobDeLiberacion(reservaId: string) {
    const job = await this.reservasQueue.getJob(reservaId);
    if (job) await job.remove();
  }

  private validarHorarioDentroDeOperacion(
    cancha: { horaAperturaMin: number; horaCierreMin: number },
    horaInicioMin: number,
    horaFinMin: number,
  ) {
    if (horaInicioMin < cancha.horaAperturaMin || horaFinMin > cancha.horaCierreMin) {
      throw new BadRequestException('El horario solicitado esta fuera del horario de operacion.');
    }
  }

  private claveLockHorario(canchaId: string, fecha: string, horaInicioMin: number): string {
    return `lock:reserva:${canchaId}:${fecha}:${horaInicioMin}`;
  }
}
