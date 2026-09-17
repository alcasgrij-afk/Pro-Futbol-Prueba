import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PartidosService } from './partidos.service';

describe('PartidosService', () => {
  let service: PartidosService;
  const mockPrisma = {
    partido: { findUnique: jest.fn(), update: jest.fn() },
    torneo: { findUnique: jest.fn() },
  };
  const mockFixtureService = { generarRondaSiguiente: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PartidosService(mockPrisma as any, mockFixtureService as any);
  });

  it('lanza si partido no existe', async () => {
    mockPrisma.partido.findUnique.mockResolvedValue(null);
    await expect(
      service.capturarResultado({ partidoId: 'x', golesLocal: 1, golesVisitante: 1 }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lanza si goles negativos', async () => {
    mockPrisma.partido.findUnique.mockResolvedValue({ id: 'p1', torneoId: 't1' });
    await expect(
      service.capturarResultado({ partidoId: 'p1', golesLocal: -1, golesVisitante: 0 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('lanza si no llega ningun dato', async () => {
    mockPrisma.partido.findUnique.mockResolvedValue({ id: 'p1', torneoId: 't1' });
    await expect(service.capturarResultado({ partidoId: 'p1' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('lanza si el ganador por penales no es local ni visitante', async () => {
    mockPrisma.partido.findUnique.mockResolvedValue({ id: 'p1', torneoId: 't1', localId: 'a', visitanteId: 'b' });
    await expect(
      service.capturarResultado({ partidoId: 'p1', penalesGanadorId: 'zzz' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('guarda goles y penales, devuelve { partido, bracket } ', async () => {
    mockPrisma.partido.findUnique.mockResolvedValue({
      id: 'p1',
      torneoId: 't1',
      localId: 'a',
      visitanteId: 'b',
    });
    mockPrisma.partido.update.mockResolvedValue({ id: 'p1', golesLocal: 1, golesVisitante: 1, penalesGanadorId: 'b' });
    mockPrisma.torneo.findUnique.mockResolvedValue({ id: 't1', formato: 'ELIMINACION_DIRECTA' });
    mockFixtureService.generarRondaSiguiente.mockResolvedValue({ tipo: 'sin_cambios' });

    const res = await service.capturarResultado({
      partidoId: 'p1',
      golesLocal: 1,
      golesVisitante: 1,
      penalesGanadorId: 'b',
    });

    expect(mockPrisma.partido.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { golesLocal: 1, golesVisitante: 1, penalesGanadorId: 'b' },
    });
    expect(mockFixtureService.generarRondaSiguiente).toHaveBeenCalledWith('t1');
    expect(res.bracket).toEqual({ tipo: 'sin_cambios' });
    expect(res.partido.golesLocal).toBe(1);
  });

  it('torneo de liga -> no dispara el bracket', async () => {
    mockPrisma.partido.findUnique.mockResolvedValue({ id: 'p1', torneoId: 't1' });
    mockPrisma.partido.update.mockResolvedValue({ id: 'p1', golesLocal: 2, golesVisitante: 1 });
    mockPrisma.torneo.findUnique.mockResolvedValue({ id: 't1', formato: 'LIGA' });
    const res = await service.capturarResultado({ partidoId: 'p1', golesLocal: 2, golesVisitante: 1 });
    expect(res.bracket).toEqual({ tipo: 'sin_cambios' });
    expect(mockFixtureService.generarRondaSiguiente).not.toHaveBeenCalled();
  });
});