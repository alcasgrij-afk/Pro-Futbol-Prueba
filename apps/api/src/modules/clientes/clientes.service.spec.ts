import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EstadoReserva, Prisma, TipoReserva } from '@prisma/client';
import { ClientesService } from './clientes.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('ClientesService.buscarConEstadoValorado', () => {
  let service: ClientesService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      cliente: { findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn() },
      clienteValorado: { findUnique: jest.fn(), findMany: jest.fn(), upsert: jest.fn(), deleteMany: jest.fn() },
      reserva: { count: jest.fn(), groupBy: jest.fn() },
    };
    service = new ClientesService(prisma as unknown as PrismaService);
  });

  it('lanza NotFoundException si el telefono no tiene cliente', async () => {
    prisma.cliente.findUnique.mockResolvedValue(null);
    await expect(service.buscarConEstadoValorado('55551234')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('cliente normal (no valorado) nunca tiene reserva gratis', async () => {
    prisma.cliente.findUnique.mockResolvedValue({ id: 'c1' });
    prisma.clienteValorado.findUnique.mockResolvedValue(null);
    const r = await service.buscarConEstadoValorado('55551234');
    expect(r).toEqual({ cliente: { id: 'c1' }, esValorado: false, totalReservas: 0, siguienteEsGratis: false });
    expect(prisma.reserva.count).not.toHaveBeenCalled();
  });

  it('VIP con 5 reservas confirmadas: la 6ta es gratis', async () => {
    prisma.cliente.findUnique.mockResolvedValue({ id: 'c1' });
    prisma.clienteValorado.findUnique.mockResolvedValue({ id: 'v1', clienteId: 'c1' });
    prisma.reserva.count.mockResolvedValue(5);
    const r = await service.buscarConEstadoValorado('55551234');
    expect(prisma.reserva.count).toHaveBeenCalledWith({
      where: { clienteId: 'c1', estado: EstadoReserva.CONFIRMADA, tipo: TipoReserva.NORMAL },
    });
    expect(r.esValorado).toBe(true);
    expect(r.totalReservas).toBe(5);
    expect(r.siguienteEsGratis).toBe(true);
  });

  it('VIP con 6 reservas confirmadas: la 7ma no es gratis (ciclo ya se aplico)', async () => {
    prisma.cliente.findUnique.mockResolvedValue({ id: 'c1' });
    prisma.clienteValorado.findUnique.mockResolvedValue({ id: 'v1', clienteId: 'c1' });
    prisma.reserva.count.mockResolvedValue(6);
    const r = await service.buscarConEstadoValorado('55551234');
    expect(r.siguienteEsGratis).toBe(false);
  });
});

describe('ClientesService — admin (listar/actualizar/desactivar/VIP)', () => {
  let service: ClientesService;
  let prisma: any;

  const c1 = { id: 'c1', nombre: 'Juan Perez', telefono: '55551234', email: null, activo: true };
  const c2 = { id: 'c2', nombre: 'Ana Lopez', telefono: '55559999', email: null, activo: true };

  beforeEach(() => {
    prisma = {
      cliente: {
        findUnique: jest.fn().mockResolvedValue(c1),
        findMany: jest.fn().mockResolvedValue([c1, c2]),
        update: jest.fn().mockImplementation(({ where, data }) => Promise.resolve({ ...c1, id: where.id, ...data })),
      },
      clienteValorado: {
        findMany: jest.fn().mockResolvedValue([]),
        upsert: jest.fn().mockResolvedValue({ clienteId: 'c1' }),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      reserva: { groupBy: jest.fn().mockResolvedValue([]) },
    };
    service = new ClientesService(prisma as unknown as PrismaService);
  });

  describe('listar / adjuntarEstadoValorado (en lote)', () => {
    it('adjunta VIP y conteo de reservas en 2 consultas, no una por cliente', async () => {
      prisma.clienteValorado.findMany.mockResolvedValue([{ clienteId: 'c1' }]);
      prisma.reserva.groupBy.mockResolvedValue([{ clienteId: 'c1', _count: { _all: 5 } }]);

      const resultado = await service.listar({ activo: true });

      expect(prisma.clienteValorado.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.reserva.groupBy).toHaveBeenCalledTimes(1);
      expect(resultado[0]).toMatchObject({ id: 'c1', esValorado: true, totalReservas: 5, siguienteEsGratis: true });
      expect(resultado[1]).toMatchObject({ id: 'c2', esValorado: false, totalReservas: 0, siguienteEsGratis: false });
    });

    it('filtra por busqueda (nombre o telefono) y por activo', async () => {
      await service.listar({ q: 'Juan', activo: true });
      expect(prisma.cliente.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            activo: true,
            OR: [{ nombre: { contains: 'Juan', mode: 'insensitive' } }, { telefono: { contains: 'Juan' } }],
          }),
        }),
      );
    });
  });

  describe('actualizar', () => {
    it('normaliza el telefono igual que el resto del servicio', async () => {
      await service.actualizar('c1', { telefono: '+502 5555-1234' });
      expect(prisma.cliente.update).toHaveBeenCalledWith({ where: { id: 'c1' }, data: { telefono: '50255551234' } });
    });

    it('traduce un telefono duplicado (P2002) a BadRequestException', async () => {
      prisma.cliente.update.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint', { code: 'P2002', clientVersion: 'x', meta: { target: ['telefono'] } }),
      );
      await expect(service.actualizar('c1', { telefono: '55551234' })).rejects.toBeInstanceOf(BadRequestException);
    });

    it('traduce un DPI duplicado (P2002) a BadRequestException con mensaje de DPI', async () => {
      prisma.cliente.update.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint', { code: 'P2002', clientVersion: 'x', meta: { target: ['dpi'] } }),
      );
      await expect(service.actualizar('c1', { dpi: '1234567890123' })).rejects.toThrow('Ya existe otro cliente con ese DPI.');
    });

    it('404 si el cliente no existe', async () => {
      prisma.cliente.findUnique.mockResolvedValue(null);
      await expect(service.actualizar('no-existe', { nombre: 'X' })).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('desactivar / activar', () => {
    it('desactivar pone activo:false', async () => {
      await service.desactivar('c1');
      expect(prisma.cliente.update).toHaveBeenCalledWith({ where: { id: 'c1' }, data: { activo: false } });
    });

    it('activar pone activo:true', async () => {
      await service.activar('c1');
      expect(prisma.cliente.update).toHaveBeenCalledWith({ where: { id: 'c1' }, data: { activo: true } });
    });
  });

  describe('otorgarValorado / quitarValorado', () => {
    it('otorgar hace upsert sobre ClienteValorado (idempotente si ya era VIP)', async () => {
      await service.otorgarValorado('c1');
      expect(prisma.clienteValorado.upsert).toHaveBeenCalledWith({
        where: { clienteId: 'c1' },
        create: { clienteId: 'c1' },
        update: {},
      });
    });

    it('quitar no falla si el cliente nunca fue VIP (deleteMany, no delete)', async () => {
      prisma.clienteValorado.deleteMany.mockResolvedValue({ count: 0 });
      await expect(service.quitarValorado('c1')).resolves.toBeDefined();
      expect(prisma.clienteValorado.deleteMany).toHaveBeenCalledWith({ where: { clienteId: 'c1' } });
    });
  });
});
