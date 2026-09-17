import { FixtureService, generarRondasLiga, generarRonda1, generarRondaEliminatoria } from './fixture.service';

describe('FixtureService', () => {
  let service: FixtureService;
  const mockPrisma = {
    torneo: {
      findUnique: jest.fn(),
      createMany: jest.fn(),
      findMany: jest.fn(),
    },
    partido: {
      createMany: jest.fn(),
      findMany: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new FixtureService(mockPrisma as any);
  });

  describe('generarRondasLiga (pure)', () => {
    it('2 teams -> 1 partido', () => {
      const r = generarRondasLiga(['a', 'b']);
      expect(r).toHaveLength(1);
      expect(r[0]).toEqual({ jornada: 1, localId: 'a', visitanteId: 'b' });
    });

    it('4 teams -> 6 partidos en 3 jornadas', () => {
      const r = generarRondasLiga(['a', 'b', 'c', 'd']);
      expect(r).toHaveLength(6);
      const jornadas = [...new Set(r.map((p) => p.jornada))];
      expect(jornadas.sort()).toEqual([1, 2, 3]);
      // cada jornada tiene 2 partidos
      expect(r.filter((p) => p.jornada === 1)).toHaveLength(2);
      expect(r.filter((p) => p.jornada === 2)).toHaveLength(2);
      expect(r.filter((p) => p.jornada === 3)).toHaveLength(2);
    });

    it('equipos impares -> bye automatico', () => {
      const r = generarRondasLiga(['a', 'b', 'c']);
      // 3 equipos -> 3 jornadas, 1 partido por jornada (el bye descansa)
      expect(r).toHaveLength(3);
    });
  });

  describe('generarRonda1 (pure)', () => {
    it('4 equipos -> 2 partidos en ronda 1', () => {
      const r = generarRonda1(['a', 'b', 'c', 'd']);
      expect(r).toHaveLength(2);
      expect(r[0]).toEqual({ ronda: 1, localId: 'a', visitanteId: 'b' });
      expect(r[1]).toEqual({ ronda: 1, localId: 'c', visitanteId: 'd' });
    });

    it('impar -> ultimo con bye (visitanteId null)', () => {
      const r = generarRonda1(['a', 'b', 'c']);
      expect(r).toHaveLength(2);
      expect(r[1].visitanteId).toBeNull();
    });
  });

  describe('generarRondaEliminatoria (pure)', () => {
    it('4 avanzados -> 2 partidos con posiciones', () => {
      const r = generarRondaEliminatoria(['a', 'b', 'c', 'd'], 2);
      expect(r).toEqual([
        { ronda: 2, posicion: 0, localId: 'a', visitanteId: 'b' },
        { ronda: 2, posicion: 1, localId: 'c', visitanteId: 'd' },
      ]);
    });

    it('impar -> ultimo con bye (visitanteId null)', () => {
      const r = generarRondaEliminatoria(['a', 'b', 'c'], 3);
      expect(r).toHaveLength(2);
      expect(r[0]).toEqual({ ronda: 3, posicion: 0, localId: 'a', visitanteId: 'b' });
      expect(r[1].visitanteId).toBeNull();
    });
  });

  describe('generarRondaSiguiente (integrado)', () => {
    const partido = (overrides: any) => ({
      id: 'x',
      ronda: 1,
      posicion: 0,
      localId: null,
      visitanteId: null,
      golesLocal: null,
      golesVisitante: null,
      penalesGanadorId: null,
      local: null,
      visitante: null,
      penalesGanador: null,
      ...overrides,
    });

    beforeEach(() => {
      mockPrisma.partido.createMany.mockResolvedValue({ count: 1 });
      mockPrisma.partido.findMany.mockResolvedValue([partido({})]);
    });

    it('ronda 1 completa -> crea ronda 2 con los ganadores', async () => {
      mockPrisma.torneo.findUnique.mockResolvedValue({
        id: 't1',
        formato: 'ELIMINACION_DIRECTA',
        partidos: [
          partido({ id: 'p1', posicion: 0, localId: 'a', visitanteId: 'b', golesLocal: 2, golesVisitante: 0, local: { id: 'a', nombre: 'A' }, visitante: { id: 'b', nombre: 'B' } }),
          partido({ id: 'p2', posicion: 1, localId: 'c', visitanteId: 'd', golesLocal: 1, golesVisitante: 3, local: { id: 'c', nombre: 'C' }, visitante: { id: 'd', nombre: 'D' } }),
        ],
      });
      const res = await service.generarRondaSiguiente('t1');
      expect(res).toEqual({ tipo: 'avanzada', partidosCreados: [partido({})] });
      const data = mockPrisma.partido.createMany.mock.calls[0][0].data;
      expect(data).toEqual([{ torneoId: 't1', jornada: 0, ronda: 2, posicion: 0, localId: 'a', visitanteId: 'd' }]);
    });

    it('ronda 1 con bye -> el local avanza sin necesitar resultado', async () => {
      mockPrisma.torneo.findUnique.mockResolvedValue({
        id: 't1',
        formato: 'ELIMINACION_DIRECTA',
        partidos: [
          partido({ id: 'p1', posicion: 0, localId: 'a', visitanteId: 'b', golesLocal: 1, golesVisitante: 0, local: { id: 'a', nombre: 'A' }, visitante: { id: 'b', nombre: 'B' } }),
          partido({ id: 'p2', posicion: 1, localId: 'c', visitanteId: null, golesLocal: null, golesVisitante: null, local: { id: 'c', nombre: 'C' }, visitante: null }),
        ],
      });
      await service.generarRondaSiguiente('t1');
      const data = mockPrisma.partido.createMany.mock.calls[0][0].data;
      expect(data).toEqual([{ torneoId: 't1', jornada: 0, ronda: 2, posicion: 0, localId: 'a', visitanteId: 'c' }]);
    });

    it('empate sin penales -> penalesPendientes y NO crea nada', async () => {
      mockPrisma.torneo.findUnique.mockResolvedValue({
        id: 't1',
        formato: 'ELIMINACION_DIRECTA',
        partidos: [
          partido({ id: 'p1', posicion: 0, localId: 'a', visitanteId: 'b', golesLocal: 1, golesVisitante: 1, local: { id: 'a', nombre: 'A' }, visitante: { id: 'b', nombre: 'B' } }),
          partido({ id: 'p2', posicion: 1, localId: 'c', visitanteId: 'd', golesLocal: 2, golesVisitante: 0, local: { id: 'c', nombre: 'C' }, visitante: { id: 'd', nombre: 'D' } }),
        ],
      });
      const res = await service.generarRondaSiguiente('t1');
      expect(res).toEqual({ tipo: 'penalesPendientes', partidoId: 'p1' });
      expect(mockPrisma.partido.createMany).not.toHaveBeenCalled();
    });

    it('empate con penales -> avanza el ganador por penales', async () => {
      mockPrisma.torneo.findUnique.mockResolvedValue({
        id: 't1',
        formato: 'ELIMINACION_DIRECTA',
        partidos: [
          partido({ id: 'p1', posicion: 0, localId: 'a', visitanteId: 'b', golesLocal: 1, golesVisitante: 1, penalesGanadorId: 'b', local: { id: 'a', nombre: 'A' }, visitante: { id: 'b', nombre: 'B' }, penalesGanador: { id: 'b', nombre: 'B' } }),
          partido({ id: 'p2', posicion: 1, localId: 'c', visitanteId: 'd', golesLocal: 0, golesVisitante: 1, local: { id: 'c', nombre: 'C' }, visitante: { id: 'd', nombre: 'D' } }),
        ],
      });
      await service.generarRondaSiguiente('t1');
      const data = mockPrisma.partido.createMany.mock.calls[0][0].data;
      expect(data).toEqual([{ torneoId: 't1', jornada: 0, ronda: 2, posicion: 0, localId: 'b', visitanteId: 'd' }]);
    });

    it('ronda incompleta -> sin_cambios', async () => {
      mockPrisma.torneo.findUnique.mockResolvedValue({
        id: 't1',
        formato: 'ELIMINACION_DIRECTA',
        partidos: [
          partido({ id: 'p1', posicion: 0, localId: 'a', visitanteId: 'b', golesLocal: 1, golesVisitante: 0 }),
          partido({ id: 'p2', posicion: 1, localId: 'c', visitanteId: 'd', golesLocal: null, golesVisitante: null }),
        ],
      });
      const res = await service.generarRondaSiguiente('t1');
      expect(res).toEqual({ tipo: 'sin_cambios' });
      expect(mockPrisma.partido.createMany).not.toHaveBeenCalled();
    });

    it('final jugado -> campeon, sin tocar estado', async () => {
      mockPrisma.torneo.findUnique.mockResolvedValue({
        id: 't1',
        formato: 'ELIMINACION_DIRECTA',
        partidos: [
          partido({ id: 'p1', posicion: 0, localId: 'a', visitanteId: 'b', golesLocal: 2, golesVisitante: 0 }),
          partido({ id: 'p2', posicion: 1, localId: 'c', visitanteId: 'd', golesLocal: 0, golesVisitante: 1 }),
          partido({ id: 'p3', ronda: 2, posicion: 0, localId: 'a', visitanteId: 'd', golesLocal: 3, golesVisitante: 0, local: { id: 'a', nombre: 'A' }, visitante: { id: 'd', nombre: 'D' } }),
        ],
      });
      const res = await service.generarRondaSiguiente('t1');
      expect(res).toEqual({ tipo: 'campeon', campeonId: 'a', campeonNombre: 'A' });
      expect(mockPrisma.partido.createMany).not.toHaveBeenCalled();
    });

    it('liga -> sin_cambios', async () => {
      mockPrisma.torneo.findUnique.mockResolvedValue({ id: 't1', formato: 'LIGA', partidos: [] });
      const res = await service.generarRondaSiguiente('t1');
      expect(res).toEqual({ tipo: 'sin_cambios' });
    });
  });

  describe('generarFixture (integrado)', () => {
    it('lanza si torneo no existe', async () => {
      mockPrisma.torneo.findUnique.mockResolvedValue(null);
      await expect(service.generarFixture('t1')).rejects.toThrow('Torneo no encontrado.');
    });

    it('lanza si fixture ya existe', async () => {
      mockPrisma.torneo.findUnique.mockResolvedValue({ id: 't1', formato: 'LIGA', equipos: [{ id: 'a' }, { id: 'b' }], partidos: [{ id: 'p1' }] });
      await expect(service.generarFixture('t1')).rejects.toThrow('ya fue generado');
    });

    it('lanza si menos de 2 equipos', async () => {
      mockPrisma.torneo.findUnique.mockResolvedValue({ id: 't1', formato: 'LIGA', equipos: [{ id: 'a' }], partidos: [] });
      await expect(service.generarFixture('t1')).rejects.toThrow('al menos 2 equipos');
    });

    it('crea partidos de liga', async () => {
      mockPrisma.torneo.findUnique.mockResolvedValue({
        id: 't1',
        formato: 'LIGA',
        equipos: [{ id: 'a' }, { id: 'b' }],
        partidos: [],
      });
      mockPrisma.partido.createMany.mockResolvedValue({ count: 1 });
      mockPrisma.partido.findMany.mockResolvedValue([{ id: 'p1', jornada: 1, localId: 'a', visitanteId: 'b' }]);
      const res = await service.generarFixture('t1');
      expect(mockPrisma.partido.createMany).toHaveBeenCalled();
      expect(res).toHaveLength(1);
    });

    it('crea partidos de eliminacion directa (solo ronda 1)', async () => {
      mockPrisma.torneo.findUnique.mockResolvedValue({
        id: 't1',
        formato: 'ELIMINACION_DIRECTA',
        equipos: [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }],
        partidos: [],
      });
      mockPrisma.partido.createMany.mockResolvedValue({ count: 2 });
      mockPrisma.partido.findMany.mockResolvedValue([
        { id: 'p1', jornada: 0, ronda: 1, localId: 'a', visitanteId: 'b' },
        { id: 'p2', jornada: 0, ronda: 1, localId: 'c', visitanteId: 'd' },
      ]);
      const res = await service.generarFixture('t1');
      expect(mockPrisma.partido.createMany).toHaveBeenCalled();
      expect(res.every((p) => p.ronda === 1)).toBe(true);
      // ronda 1 lleva posicion de bracket (0, 1) para ordenar de forma determinista
      const created = mockPrisma.partido.createMany.mock.calls[0][0].data;
      expect(created.map((p: any) => p.posicion)).toEqual([0, 1]);
    });
  });
});