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
import { EstadoReserva, FormaPago, Prisma, TipoReserva } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { ClientesService } from '../clientes/clientes.service';
import { CanchasService } from '../canchas/canchas.service';
import { PricingService } from '../pricing/pricing.service';
import { CrearReservaDto } from './dto/crear-reserva.dto';
import { CrearReservaRecurrenteDto } from './dto/crear-reserva-recurrente.dto';
import { horaAMinutos, minutosAHora, resolverHorario } from '../canchas/disponibilidad.util';
import { RESERVAS_QUEUE } from '../../queue/queue.module';

const ESTADOS_ACTIVOS: EstadoReserva[] = [
  EstadoReserva.CONFIRMADA,
  EstadoReserva.PENDIENTE_PAGO,
  EstadoReserva.PENDIENTE_SEDE,
];

export const JOB_LIBERAR_RESERVA = 'liberar-reserva-pendiente';
export const JOB_MATERIALIZAR_RECURRENTES = 'materializar-reservas-recurrentes';

// Cuantos dias hacia adelante el job diario (y la creacion inicial de una
// regla) materializa como filas Reserva reales.
const DIAS_ANTICIPACION_RECURRENTES = 60;

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

    // Mismo guard, pero de hora: si la fecha es hoy, el horario tampoco puede
    // haber pasado ya (protege tanto el bot como el cobro en sede del panel).
    if (dto.fecha === hoyLocal) {
      const minutosAhora = d.getHours() * 60 + d.getMinutes();
      if (horaInicioMin < minutosAhora) {
        throw new BadRequestException('No se puede reservar una hora que ya pasó.');
      }
    }

    // Solo ESPECIAL/ACADEMIA pueden pedir un horaFin explicito (bloque
    // multi-hora); NORMAL siempre usa un bloque de duracionBloqueMin, sin
    // importar si el dto trae horaFin (evita que el endpoint publico
    // extienda la duracion pagando el precio de un solo bloque).
    const esBloqueo = !!dto.tipo && dto.tipo !== TipoReserva.NORMAL;
    const horaFinMin =
      esBloqueo && dto.horaFin ? horaAMinutos(dto.horaFin) : horaInicioMin + cancha.duracionBloqueMin;
    if (horaFinMin <= horaInicioMin) {
      throw new BadRequestException('horaFin debe ser mayor que horaInicio.');
    }

    this.validarHorarioDentroDeOperacion(cancha, dto.fecha, horaInicioMin, horaFinMin);

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

    // ESPECIAL/ACADEMIA son bloqueos pre-arreglados, no una venta: se
    // confirman de una vez, sin cobro ni timeout de liberacion.
    const esBloqueo = !!dto.tipo && dto.tipo !== TipoReserva.NORMAL;
    const tipo = dto.tipo ?? TipoReserva.NORMAL;
    const precioTotalQ = esBloqueo ? 0 : this.pricingService.calcular(dto.formaPago, cancha);

    const estadoInicial = esBloqueo
      ? EstadoReserva.CONFIRMADA
      : dto.formaPago === FormaPago.ANTICIPADO_EN_LINEA
        ? EstadoReserva.PENDIENTE_PAGO
        : EstadoReserva.PENDIENTE_SEDE;

    const minutosTimeout =
      dto.formaPago === FormaPago.ANTICIPADO_EN_LINEA
        ? this.config.get<number>('RESERVA_TIMEOUT_PAGO_EN_LINEA_MIN', 15)
        : this.config.get<number>('RESERVA_TIMEOUT_PAGO_EN_SEDE_MIN', 30);

    const expiraEn = esBloqueo ? null : new Date(Date.now() + minutosTimeout * 60_000);

    // --- Capa 2 de defensa: verificar dentro de una transaccion que nadie
    // haya confirmado ya una reserva activa en este horario (cubre el caso
    // borde de que el lock de Redis haya expirado por alguna razon).
    // Se compara por solapamiento de rango (no solo igualdad de inicio) para
    // cubrir bloques multi-hora de ESPECIAL/ACADEMIA. ---
    const reserva = await this.prisma.$transaction(async (tx) => {
      const existente = await tx.reserva.findFirst({
        where: {
          canchaId: dto.canchaId,
          fecha: new Date(dto.fecha),
          estado: { in: ESTADOS_ACTIVOS },
          horaInicioMin: { lt: horaFinMin },
          horaFinMin: { gt: horaInicioMin },
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
          tipo,
          formaPago: dto.formaPago,
          precioTotalQ,
          expiraEn,
        },
        include: { cancha: true, cliente: true },
      });
    });

    if (esBloqueo) {
      this.logger.log(`Reserva ${reserva.id} (${tipo}) creada y confirmada directamente, sin cobro.`);
      return reserva;
    }

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

  /**
   * Reagenda una reserva existente (cambio de cancha/fecha/hora) desde el
   * modulo de Caja. Misma defensa en dos capas que crearReserva: lock de
   * Redis sobre el horario destino + chequeo de conflicto dentro de la
   * transaccion (excluyendo la propia reserva de la busqueda).
   */
  async reprogramar(
    reservaId: string,
    dto: { canchaId?: string; fecha?: string; horaInicio?: string },
  ) {
    const reserva = await this.obtenerPorId(reservaId);
    if (!ESTADOS_ACTIVOS.includes(reserva.estado)) {
      throw new BadRequestException(`No se puede reprogramar una reserva en estado ${reserva.estado}.`);
    }

    const canchaId = dto.canchaId ?? reserva.canchaId;
    const fecha = dto.fecha ?? reserva.fecha.toISOString().slice(0, 10);
    const cancha = dto.canchaId ? await this.canchasService.obtenerPorId(canchaId) : reserva.cancha;

    const horaInicioMin = dto.horaInicio ? horaAMinutos(dto.horaInicio) : reserva.horaInicioMin;
    const horaFinMin = horaInicioMin + cancha.duracionBloqueMin;

    this.validarHorarioDentroDeOperacion(cancha, fecha, horaInicioMin, horaFinMin);

    const claveLock = this.claveLockHorario(canchaId, fecha, horaInicioMin);
    const lockObtenido = await this.redis.adquirirLock(claveLock, 10);
    if (!lockObtenido) {
      throw new ConflictException('Ese horario esta siendo modificado. Intenta de nuevo en unos segundos.');
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const existente = await tx.reserva.findFirst({
          where: {
            id: { not: reservaId },
            canchaId,
            fecha: new Date(fecha),
            horaInicioMin,
            estado: { in: ESTADOS_ACTIVOS },
          },
        });
        if (existente) {
          throw new ConflictException('Ese horario ya esta ocupado. Elegi otro horario.');
        }

        return tx.reserva.update({
          where: { id: reservaId },
          data: { canchaId, fecha: new Date(fecha), horaInicioMin, horaFinMin },
          include: { cancha: true, cliente: true },
        });
      });
    } finally {
      await this.redis.liberarLock(claveLock);
    }
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

  /**
   * Crea una regla de reserva recurrente (academia o cliente especial) y
   * materializa de una vez sus proximas ocurrencias, para que aparezca en
   * la grilla sin esperar al tick nocturno.
   */
  async crearReservaRecurrente(dto: CrearReservaRecurrenteDto) {
    if (dto.tipo === TipoReserva.NORMAL) {
      throw new BadRequestException('tipo debe ser ESPECIAL o ACADEMIA.');
    }

    const cancha = await this.canchasService.obtenerPorId(dto.canchaId);
    const cliente = await this.clientesService.buscarOCrear(dto.clienteTelefono, dto.clienteNombre);

    const horaInicioMin = horaAMinutos(dto.horaInicio);
    const horaFinMin = horaAMinutos(dto.horaFin);
    if (horaFinMin <= horaInicioMin) {
      throw new BadRequestException('horaFin debe ser mayor que horaInicio.');
    }

    const regla = await this.prisma.reservaRecurrente.create({
      data: {
        canchaId: cancha.id,
        clienteId: cliente.id,
        tipo: dto.tipo,
        diaSemana: dto.diaSemana,
        horaInicioMin,
        horaFinMin,
        fechaInicio: new Date(dto.fechaInicio),
        fechaFin: dto.fechaFin ? new Date(dto.fechaFin) : null,
      },
    });

    await this.materializarRegla({ ...regla, cliente });
    return regla;
  }

  /** Invocado por el job diario: materializa todas las reglas activas. */
  async materializarTodasLasRecurrencias() {
    const reglas = await this.prisma.reservaRecurrente.findMany({
      where: { activa: true },
      include: { cliente: true },
    });
    for (const regla of reglas) {
      await this.materializarRegla(regla);
    }
  }

  /**
   * Para una regla, crea (via crearReserva, reusando sus dos capas de
   * defensa contra doble reserva) la fila Reserva de cada fecha futura que
   * coincida con el dia de la semana de la regla y que aun no exista.
   */
  private async materializarRegla(regla: {
    id: string;
    canchaId: string;
    tipo: TipoReserva;
    diaSemana: number;
    horaInicioMin: number;
    horaFinMin: number;
    fechaInicio: Date;
    fechaFin: Date | null;
    cliente: { nombre: string; telefono: string };
  }) {
    const fechaInicioStr = regla.fechaInicio.toISOString().slice(0, 10);
    const fechaFinStr = regla.fechaFin ? regla.fechaFin.toISOString().slice(0, 10) : null;

    const hoy = new Date();
    const hoyLocal = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());

    for (let i = 0; i < DIAS_ANTICIPACION_RECURRENTES; i++) {
      const fecha = new Date(hoyLocal);
      fecha.setDate(fecha.getDate() + i);
      if (fecha.getDay() !== regla.diaSemana) continue;

      const fechaStr = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
      if (fechaStr < fechaInicioStr) continue;
      if (fechaFinStr && fechaStr > fechaFinStr) continue;

      const yaExiste = await this.prisma.reserva.findFirst({
        where: {
          canchaId: regla.canchaId,
          fecha: new Date(fechaStr),
          horaInicioMin: regla.horaInicioMin,
          tipo: regla.tipo,
          estado: { in: ESTADOS_ACTIVOS },
        },
      });
      if (yaExiste) continue;

      try {
        await this.crearReserva({
          canchaId: regla.canchaId,
          clienteTelefono: regla.cliente.telefono,
          clienteNombre: regla.cliente.nombre,
          fecha: fechaStr,
          horaInicio: minutosAHora(regla.horaInicioMin),
          horaFin: minutosAHora(regla.horaFinMin),
          formaPago: FormaPago.EN_SEDE,
          tipo: regla.tipo,
        });
      } catch (err) {
        this.logger.warn(
          `No se pudo materializar recurrencia ${regla.id} para ${fechaStr}: ${err instanceof Error ? err.message : err}`,
        );
      }
    }
  }

  private async cancelarJobDeLiberacion(reservaId: string) {
    const job = await this.reservasQueue.getJob(reservaId);
    if (job) await job.remove();
  }

  private validarHorarioDentroDeOperacion(
    cancha: {
      horaAperturaMinSemana: number;
      horaCierreMinSemana: number;
      horaAperturaMinFinde: number;
      horaCierreMinFinde: number;
    },
    fecha: string,
    horaInicioMin: number,
    horaFinMin: number,
  ) {
    const { horaAperturaMin, horaCierreMin } = resolverHorario(cancha, fecha);
    if (horaInicioMin < horaAperturaMin || horaFinMin > horaCierreMin) {
      throw new BadRequestException('El horario solicitado esta fuera del horario de operacion.');
    }
  }

  private claveLockHorario(canchaId: string, fecha: string, horaInicioMin: number): string {
    return `lock:reserva:${canchaId}:${fecha}:${horaInicioMin}`;
  }
}
