import { AsistenciaService } from './asistencia.service';

describe('AsistenciaService', () => {
  let service: AsistenciaService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      asistencia: {
        upsert: jest.fn().mockResolvedValue({ id: 'asistencia-1' }),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    service = new AsistenciaService(prisma);
  });

  describe('marcar', () => {
    it('usa upsert para no duplicar el registro si ya existe', async () => {
      await service.marcar({ alumnoId: 'alumno-1', fecha: '2026-07-30', presente: true });

      expect(prisma.asistencia.upsert).toHaveBeenCalledWith({
        where: { alumnoId_fecha: { alumnoId: 'alumno-1', fecha: new Date('2026-07-30') } },
        update: { presente: true },
        create: { alumnoId: 'alumno-1', fecha: new Date('2026-07-30'), presente: true },
      });
    });
  });

  describe('listarPorFecha', () => {
    it('filtra por la fecha exacta e incluye el alumno', async () => {
      await service.listarPorFecha('2026-07-30');
      expect(prisma.asistencia.findMany).toHaveBeenCalledWith({
        where: { fecha: new Date('2026-07-30') },
        include: { alumno: true },
      });
    });
  });

  describe('listarPorAlumno', () => {
    it('lista por alumno ordenado por fecha descendente', async () => {
      await service.listarPorAlumno('alumno-1');
      expect(prisma.asistencia.findMany).toHaveBeenCalledWith({
        where: { alumnoId: 'alumno-1' },
        orderBy: { fecha: 'desc' },
      });
    });
  });
});
