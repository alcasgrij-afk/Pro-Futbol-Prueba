import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EquiposService } from './equipos.service';
import { EstadoPago, TipoPagoReferencia } from '@prisma/client';

describe('EquiposService', () => {
  let service: EquiposService;
  const mockPrisma = {
    torneo: { findUnique: jest.fn() },
    equipo: { count: jest.fn(), findUnique: jest.fn(), create: jest.fn(), findMany: jest.fn() },
    pago: { findMany: jest.fn() },
  };
  const pagosService = {
    crearPagoEquipo: jest.fn(),
  };

  const torneoLiga = {
    id: 't1',
    nombre: 'Apertura',
    cuotaInscripcionQ: '100',
    maxEquipos: 8,
    estado: 'INSCRIPCIONES_ABIERTAS',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new EquiposService(mockPrisma as any, pagosService as any);
  });

  describe('inscribir', () => {
    it('lanza si torneo no existe', async () => {
      mockPrisma.torneo.findUnique.mockResolvedValue(null);
      await expect(service.inscribir({ torneoId: 'x', nombre: 'Los Canarios' })).rejects.toBeInstanceOf(NotFoundException);
    });

    it('lanza si torneo no acepta inscripciones', async () => {
      mockPrisma.torneo.findUnique.mockResolvedValue({ ...torneoLiga, estado: 'EN_CURSO' });
      await expect(service.inscribir({ torneoId: 't1', nombre: 'Los Canarios' })).rejects.toBeInstanceOf(BadRequestException);
    });

    it('lanza si se alcanzo el cupo maximo', async () => {
      mockPrisma.torneo.findUnique.mockResolvedValue(torneoLiga);
      mockPrisma.equipo.count.mockResolvedValue(8);
      await expect(service.inscribir({ torneoId: 't1', nombre: 'Los Canarios' })).rejects.toThrow('cupo maximo');
    });

    it('lanza si el nombre ya existe', async () => {
      mockPrisma.torneo.findUnique.mockResolvedValue(torneoLiga);
      mockPrisma.equipo.count.mockResolvedValue(1);
      mockPrisma.equipo.findUnique.mockResolvedValue({ id: 'e1', nombre: 'Los Canarios' });
      await expect(service.inscribir({ torneoId: 't1', nombre: 'Los Canarios' })).rejects.toThrow('Ya existe un equipo');
    });

    it('cuota Q0 -> crea equipo sin generar pago', async () => {
      mockPrisma.torneo.findUnique.mockResolvedValue({ ...torneoLiga, cuotaInscripcionQ: '0' });
      mockPrisma.equipo.count.mockResolvedValue(0);
      mockPrisma.equipo.findUnique.mockResolvedValue(null);
      mockPrisma.equipo.create.mockResolvedValue({ id: 'e1', torneoId: 't1', nombre: 'Los Canarios', capitanNombre: null, capitanTelefono: null, creadoEn: new Date() });

      const res = await service.inscribir({ torneoId: 't1', nombre: 'Los Canarios' });
      expect(pagosService.crearPagoEquipo).not.toHaveBeenCalled();
      expect(res.redirectUrl).toBeNull();
      expect(res.equipo.cuotaPagada).toBe(false);
    });

    it('cuota > 0 -> crea pago de equipo y devuelve redirectUrl', async () => {
      mockPrisma.torneo.findUnique.mockResolvedValue(torneoLiga);
      mockPrisma.equipo.count.mockResolvedValue(0);
      mockPrisma.equipo.findUnique.mockResolvedValue(null);
      mockPrisma.equipo.create.mockResolvedValue({ id: 'e1', torneoId: 't1', nombre: 'Los Canarios', capitanNombre: null, capitanTelefono: null, creadoEn: new Date() });
      pagosService.crearPagoEquipo.mockResolvedValue({ paymentId: 'p1', redirectUrl: 'http://gateway/pago' });

      const res = await service.inscribir({ torneoId: 't1', nombre: 'Los Canarios' });
      expect(pagosService.crearPagoEquipo).toHaveBeenCalledWith('BAC', {
        equipoId: 'e1',
        torneoNombre: 'Apertura',
        cuotaQ: 100,
      });
      expect(res.redirectUrl).toBe('http://gateway/pago');
    });
  });

  describe('listarDeTorneo', () => {
    it('marca cuotaPagada segun pagos COMPLETADO', async () => {
      mockPrisma.equipo.findMany.mockResolvedValue([
        { id: 'e1', torneoId: 't1', nombre: 'A', capitanNombre: null, capitanTelefono: null, creadoEn: new Date() },
        { id: 'e2', torneoId: 't1', nombre: 'B', capitanNombre: null, capitanTelefono: null, creadoEn: new Date() },
      ]);
      mockPrisma.pago.findMany.mockResolvedValue([{ referenciaId: 'e1' }]);

      const res = await service.listarDeTorneo('t1');
      expect(mockPrisma.pago.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ tipoReferencia: TipoPagoReferencia.EQUIPO, estado: EstadoPago.COMPLETADO }) }),
      );
      expect(res.find((e) => e.id === 'e1')!.cuotaPagada).toBe(true);
      expect(res.find((e) => e.id === 'e2')!.cuotaPagada).toBe(false);
    });
  });
});