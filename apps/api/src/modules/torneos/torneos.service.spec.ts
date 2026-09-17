import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TorneosService } from './torneos.service';
import { EstadoTorneo } from '@profutbol/shared-types';

describe('TorneosService', () => {
  let service: TorneosService;
  const mockPrisma = {
    torneo: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    equipo: { count: jest.fn() },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TorneosService(mockPrisma as any);
  });

  describe('crearTorneo', () => {
    it('crea con defaults', async () => {
      mockPrisma.torneo.create.mockResolvedValue({
        id: 't1',
        nombre: 'Apertura',
        descripcion: null,
        formato: 'LIGA',
        categoria: null,
        maxEquipos: 16,
        cuotaInscripcionQ: '0',
        fechaInicio: null,
        fechaLimiteInscripcion: null,
        estado: 'INSCRIPCIONES_ABIERTAS',
        creadoEn: new Date(),
      });
      const res = await service.crearTorneo({ nombre: 'Apertura', formato: 'LIGA' });
      expect(res.maxEquipos).toBe(16);
      expect(res.cuotaInscripcionQ).toBe(0);
    });
  });

  describe('listarTorneos', () => {
    it('incluye equiposInscritos', async () => {
      mockPrisma.torneo.findMany.mockResolvedValue([
        { id: 't1', nombre: 'A', descripcion: null, formato: 'LIGA', categoria: null, maxEquipos: 8, cuotaInscripcionQ: '100', fechaInicio: null, fechaLimiteInscripcion: null, estado: 'INSCRIPCIONES_ABIERTAS', creadoEn: new Date(), _count: { equipos: 3 } },
      ]);
      const res = await service.listarTorneos();
      expect(res[0].equiposInscritos).toBe(3);
    });
  });

  describe('obtenerTorneo', () => {
    it('lanza si no existe', async () => {
      mockPrisma.torneo.findUnique.mockResolvedValue(null);
      await expect(service.obtenerTorneo('x')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('incluye equipos y partidos con nombres', async () => {
      mockPrisma.torneo.findUnique.mockResolvedValue({
        id: 't1', nombre: 'A', descripcion: null, formato: 'LIGA', categoria: null, maxEquipos: 8, cuotaInscripcionQ: '100', fechaInicio: null, fechaLimiteInscripcion: null, estado: 'INSCRIPCIONES_ABIERTAS', creadoEn: new Date(),
        equipos: [{ id: 'e1', nombre: 'Equipo A', capitanNombre: null, capitanTelefono: null, creadoEn: new Date() }],
        partidos: [{ id: 'p1', jornada: 1, ronda: null, localId: 'e1', visitanteId: null, golesLocal: null, golesVisitante: null, local: { nombre: 'Equipo A' }, visitante: null, creadoEn: new Date() }],
      });
      const res = await service.obtenerTorneo('t1');
      expect(res.equipos).toHaveLength(1);
      expect(res.partidos[0].localNombre).toBe('Equipo A');
    });
  });

  describe('cambiarEstado', () => {
    it('lanza si no existe', async () => {
      mockPrisma.torneo.findUnique.mockResolvedValue(null);
      await expect(service.cambiarEstado('x', EstadoTorneo.EN_CURSO)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('lanza si intenta reabrir inscripciones de un torneo EN_CURSO', async () => {
      mockPrisma.torneo.findUnique.mockResolvedValue({ id: 't1', estado: 'EN_CURSO' });
      await expect(service.cambiarEstado('t1', EstadoTorneo.INSCRIPCIONES_ABIERTAS)).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});