import { PosicionesService } from './posiciones.service';
import { FormatoTorneo } from '@profutbol/shared-types';

describe('PosicionesService', () => {
  let service: PosicionesService;
  const mockPrisma = {
    torneo: { findUnique: jest.fn() },
    equipo: { findMany: jest.fn() },
    partido: { findMany: jest.fn() },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PosicionesService(mockPrisma as any);
  });

  it('devuelve [] para ELIMINACION_DIRECTA', async () => {
    mockPrisma.torneo.findUnique.mockResolvedValue({ id: 't1', formato: FormatoTorneo.ELIMINACION_DIRECTA });
    const res = await service.calcularTabla('t1');
    expect(res).toEqual([]);
  });

  it('ordena por puntos, dif, gf (LIGA)', async () => {
    mockPrisma.torneo.findUnique.mockResolvedValue({
      id: 't1',
      formato: FormatoTorneo.LIGA,
      equipos: [
        { id: 'a', nombre: 'A' },
        { id: 'b', nombre: 'B' },
        { id: 'c', nombre: 'C' },
      ],
      partidos: [
        // A vs B  3-1 (A gana)
        { id: 'p1', localId: 'a', visitanteId: 'b', golesLocal: 3, golesVisitante: 1 },
        // A vs C  1-1 (empate)
        { id: 'p2', localId: 'a', visitanteId: 'c', golesLocal: 1, golesVisitante: 1 },
        // B vs C  0-2 (C gana)
        { id: 'p3', localId: 'b', visitanteId: 'c', golesLocal: 0, golesVisitante: 2 },
      ],
    });

    const res = await service.calcularTabla('t1');
    expect(res).toHaveLength(3);
    // A: 4 pts (G-E-P: 1-1-0) GF=4 GC=2 dif=2
    // B: 0 pts (0-0-2) GF=1 GC=5 dif=-4
    // C: 4 pts (G-E-P: 1-1-0) GF=3 GC=1 dif=2
    // Desempate A vs C: mismos pts (4), mismo dif (2) -> A gana por GF (4>3)
    expect(res[0].nombre).toBe('A');
    expect(res[0].puntos).toBe(4);
    expect(res[1].nombre).toBe('C');
    expect(res[1].puntos).toBe(4);
    expect(res[2].nombre).toBe('B');
    expect(res[2].puntos).toBe(0);
  });

  it('equipos sin partidos -> 0 en todo', async () => {
    mockPrisma.torneo.findUnique.mockResolvedValue({
      id: 't1',
      formato: FormatoTorneo.LIGA,
      equipos: [{ id: 'a', nombre: 'A' }, { id: 'b', nombre: 'B' }],
      partidos: [],
    });
    const res = await service.calcularTabla('t1');
    expect(res).toHaveLength(2);
    expect(res.every((r) => r.puntos === 0 && r.jugados === 0)).toBe(true);
  });
});