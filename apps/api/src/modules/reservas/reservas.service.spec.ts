import { ConflictException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EstadoReserva, FormaPago } from '@prisma/client';
import { ReservasService } from './reservas.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { ClientesService } from '../clientes/clientes.service';
import { CanchasService } from '../canchas/canchas.service';
import { PricingService } from '../pricing/pricing.service';

describe('ReservasService', () => {
  let service: ReservasService;
  let prisma: any;
  let redis: any;
  let clientes: any;
  let canchas: any;
  let queue: any;

  const canchaMock = {
    id: 'cancha-1',
    activa: true,
    horaAperturaMin: 8 * 60,
    horaCierreMin: 22 * 60,
    duracionBloqueMin: 60,
    precioAnticipadoQ: 250,
    precioSedeQ: 300,
  };

  // Fecha futura calculada: la creacion de reservas rechaza fechas pasadas,
  // asi que el fixture siempre apunta a manana para no pudrirse con el tiempo.
  const mananaISO = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  };

  const dtoBase = {
    canchaId: 'cancha-1',
    clienteTelefono: '+502 5555 1234',
    clienteNombre: 'Juan Perez',
    fecha: mananaISO(),
    horaInicio: '18:00',
    formaPago: FormaPago.ANTICIPADO_EN_LINEA,
  };

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn(async (cb) =>
        cb({
          reserva: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue({
              id: 'reserva-1',
              estado: EstadoReserva.PENDIENTE_PAGO,
              ...dtoBase,
            }),
          },
        }),
      ),
      reserva: {
        findUnique: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
    };

    redis = {
      adquirirLock: jest.fn().mockResolvedValue(true),
      liberarLock: jest.fn().mockResolvedValue(undefined),
    };

    clientes = {
      buscarOCrear: jest.fn().mockResolvedValue({ id: 'cliente-1', nombre: 'Juan Perez' }),
    };

    canchas = {
      obtenerPorId: jest.fn().mockResolvedValue(canchaMock),
    };

    queue = {
      add: jest.fn().mockResolvedValue(undefined),
      getJob: jest.fn().mockResolvedValue(null),
    };

    const config = new ConfigService({
      RESERVA_TIMEOUT_PAGO_EN_LINEA_MIN: 15,
      RESERVA_TIMEOUT_PAGO_EN_SEDE_MIN: 30,
    });

    service = new ReservasService(
      prisma as unknown as PrismaService,
      redis as unknown as RedisService,
      clientes as unknown as ClientesService,
      canchas as unknown as CanchasService,
      config,
      new PricingService(),
      queue,
    );
  });

  describe('crearReserva', () => {
    it('crea la reserva cuando el lock de Redis se obtiene y el horario esta libre', async () => {
      const reserva = await service.crearReserva(dtoBase as any);

      expect(redis.adquirirLock).toHaveBeenCalledWith(
        `lock:reserva:cancha-1:${mananaISO()}:1080`, // 18:00 = 1080 min
        10,
      );
      expect(redis.liberarLock).toHaveBeenCalled(); // el lock siempre se libera
      expect(queue.add).toHaveBeenCalledWith(
        'liberar-reserva-pendiente',
        { reservaId: 'reserva-1' },
        expect.objectContaining({ delay: 15 * 60_000 }),
      );
      expect(reserva.id).toBe('reserva-1');
    });

    it('rechaza la reserva si no se pudo obtener el lock (alguien mas esta reservando)', async () => {
      redis.adquirirLock.mockResolvedValue(false);

      await expect(service.crearReserva(dtoBase as any)).rejects.toThrow(ConflictException);
      // No debe intentar crear nada en la base de datos si no hay lock.
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('libera el lock incluso si la creacion falla dentro de la transaccion', async () => {
      prisma.$transaction.mockRejectedValue(new ConflictException('ya reservado'));

      await expect(service.crearReserva(dtoBase as any)).rejects.toThrow(ConflictException);
      expect(redis.liberarLock).toHaveBeenCalled();
    });

    it('rechaza un horario fuera del horario de operacion de la cancha', async () => {
      await expect(
        service.crearReserva({ ...dtoBase, horaInicio: '23:00' } as any),
      ).rejects.toThrow(BadRequestException);
      expect(redis.adquirirLock).not.toHaveBeenCalled();
    });

    it('rechaza una reserva en una fecha pasada', async () => {
      await expect(
        service.crearReserva({ ...dtoBase, fecha: '2020-01-01' } as any),
      ).rejects.toThrow(BadRequestException);
      expect(redis.adquirirLock).not.toHaveBeenCalled();
    });

    it('usa el precio y timeout correctos para pago en sede', async () => {
      await service.crearReserva({ ...dtoBase, formaPago: FormaPago.EN_SEDE } as any);
      expect(queue.add).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({ delay: 30 * 60_000 }),
      );
    });
  });

  describe('confirmar', () => {
    it('confirma una reserva pendiente y cancela el job de liberacion', async () => {
      prisma.reserva.findUnique.mockResolvedValue({
        id: 'reserva-1',
        estado: EstadoReserva.PENDIENTE_PAGO,
      });
      prisma.reserva.update.mockResolvedValue({
        id: 'reserva-1',
        estado: EstadoReserva.CONFIRMADA,
      });
      const jobMock = { remove: jest.fn() };
      queue.getJob.mockResolvedValue(jobMock);

      const resultado = await service.confirmar('reserva-1', 'REF-123');

      expect(resultado.estado).toBe(EstadoReserva.CONFIRMADA);
      expect(jobMock.remove).toHaveBeenCalled();
    });

    it('es idempotente: confirmar una reserva ya confirmada no falla', async () => {
      prisma.reserva.findUnique.mockResolvedValue({
        id: 'reserva-1',
        estado: EstadoReserva.CONFIRMADA,
      });

      const resultado = await service.confirmar('reserva-1');
      expect(resultado.estado).toBe(EstadoReserva.CONFIRMADA);
      expect(prisma.reserva.update).not.toHaveBeenCalled();
    });
  });

  describe('liberarPorTimeout', () => {
    it('libera una reserva que sigue pendiente de pago', async () => {
      prisma.reserva.findUnique.mockResolvedValue({
        id: 'reserva-1',
        estado: EstadoReserva.PENDIENTE_PAGO,
      });

      await service.liberarPorTimeout('reserva-1');

      expect(prisma.reserva.update).toHaveBeenCalledWith({
        where: { id: 'reserva-1' },
        data: { estado: EstadoReserva.LIBERADA },
      });
    });

    it('NO libera una reserva que ya fue confirmada (evita condicion de carrera)', async () => {
      prisma.reserva.findUnique.mockResolvedValue({
        id: 'reserva-1',
        estado: EstadoReserva.CONFIRMADA,
      });

      await service.liberarPorTimeout('reserva-1');

      expect(prisma.reserva.update).not.toHaveBeenCalled();
    });
  });
});
