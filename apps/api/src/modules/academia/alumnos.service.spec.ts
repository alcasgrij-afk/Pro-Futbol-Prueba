import { AlumnosService } from './alumnos.service';

describe('AlumnosService', () => {
  let service: AlumnosService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      alumno: {
        create: jest.fn().mockResolvedValue({ id: 'alumno-1' }),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };
    service = new AlumnosService(prisma);
  });

  describe('crear', () => {
    it('usa la categoria explicita si se proporciona', async () => {
      await service.crear({
        nombre: 'Mateo',
        fechaNacimiento: '2016-04-12',
        categoria: 'Sub-12 Avanzado',
        encargadoNombre: 'Ana',
        encargadoTelefono: '50255551234',
      });

      expect(prisma.alumno.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ categoria: 'Sub-12 Avanzado' }) }),
      );
    });

    it('sugiere la categoria automaticamente si no se proporciona', async () => {
      await service.crear({
        nombre: 'Mateo',
        fechaNacimiento: '2016-04-12',
        encargadoNombre: 'Ana',
        encargadoTelefono: '50255551234',
      } as any);

      const dataCreada = prisma.alumno.create.mock.calls[0][0].data;
      expect(dataCreada.categoria).toMatch(/^Sub-\d+$|Libre/);
    });
  });

  describe('listar', () => {
    it('filtra por categoria cuando se especifica', async () => {
      await service.listar({ categoria: 'Sub-10' });
      expect(prisma.alumno.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ categoria: 'Sub-10' }) }),
      );
    });

    it('sin filtros, no restringe por categoria ni actividad', async () => {
      await service.listar();
      const args = prisma.alumno.findMany.mock.calls[0][0];
      expect(args.where).toEqual({});
    });
  });

  describe('desactivar', () => {
    it('marca al alumno como inactivo', async () => {
      prisma.alumno.findUnique.mockResolvedValue({ id: 'alumno-1' });
      await service.desactivar('alumno-1');
      expect(prisma.alumno.update).toHaveBeenCalledWith({
        where: { id: 'alumno-1' },
        data: { activo: false },
      });
    });

    it('lanza error si el alumno no existe', async () => {
      prisma.alumno.findUnique.mockResolvedValue(null);
      await expect(service.desactivar('no-existe')).rejects.toThrow('Alumno no encontrado.');
    });
  });
});
