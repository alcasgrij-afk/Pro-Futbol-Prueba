import { CanchasService } from './canchas.service';

describe('CanchasService', () => {
  let service: CanchasService;
  let prisma: any;

  const CANCHA_F5 = { id: 'f5', nombre: 'Futbol 5', horaAperturaMin: 14 * 60, horaCierreMin: 16 * 60, duracionBloqueMin: 60 };
  const CANCHA_F7 = { id: 'f7', nombre: 'Futbol 7', horaAperturaMin: 14 * 60, horaCierreMin: 16 * 60, duracionBloqueMin: 60 };

  beforeEach(() => {
    prisma = {
      cancha: { findMany: jest.fn() },
      reserva: { findMany: jest.fn().mockResolvedValue([]) },
    };
    service = new CanchasService(prisma);
  });

  describe('disponibilidadTodas', () => {
    it('agrupa las reservas por cancha en una sola consulta', async () => {
      prisma.cancha.findMany.mockResolvedValue([CANCHA_F5, CANCHA_F7]);
      prisma.reserva.findMany.mockResolvedValue([
        { canchaId: 'f5', horaInicioMin: 14 * 60, horaFinMin: 15 * 60 },
      ]);

      const resultado = await service.disponibilidadTodas('2026-12-01');

      expect(prisma.reserva.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.reserva.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ canchaId: { in: ['f5', 'f7'] } }) }),
      );

      const f5 = resultado.find((r) => r.canchaId === 'f5')!;
      const f7 = resultado.find((r) => r.canchaId === 'f7')!;
      expect(f5.bloques.find((b) => b.horaInicio === '14:00')?.disponible).toBe(false);
      expect(f7.bloques.every((b) => b.disponible)).toBe(true);
    });

    it('devuelve un arreglo vacio si no hay canchas activas', async () => {
      prisma.cancha.findMany.mockResolvedValue([]);
      const resultado = await service.disponibilidadTodas('2026-12-01');
      expect(resultado).toEqual([]);
      expect(prisma.reserva.findMany).not.toHaveBeenCalled();
    });
  });
});
