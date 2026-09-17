import { ConfigService } from '@nestjs/config';
import { TipoPagoReferencia } from '@profutbol/shared-types';
import { MensualidadesService } from './mensualidades.service';

describe('MensualidadesService', () => {
  let service: MensualidadesService;
  let prisma: any;
  let pagosService: any;

  const alumnoActivo1 = { id: 'alumno-1', nombre: 'Mateo', encargadoTelefono: '50255551234', activo: true };
  const alumnoActivo2 = { id: 'alumno-2', nombre: 'Sofia', encargadoTelefono: '50255559999', activo: true };

  beforeEach(() => {
    prisma = {
      alumno: { findMany: jest.fn().mockResolvedValue([alumnoActivo1, alumnoActivo2]) },
      academiaMensualidad: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: `mensualidad-${data.alumnoId}`, ...data })),
        findMany: jest.fn().mockResolvedValue([]),
      },
      pago: { findFirst: jest.fn().mockResolvedValue({ id: 'payment-existente' }) },
    };
    pagosService = {
      crearPagoMensualidad: jest.fn().mockResolvedValue({ paymentId: 'pago-1', redirectUrl: null }),
      estaPagada: jest.fn().mockResolvedValue(false),
      obtenerPagadas: jest.fn().mockResolvedValue(new Set<string>()),
    };
    const config = new ConfigService({ ACADEMIA_MENSUALIDAD_Q: 150 });
    service = new MensualidadesService(prisma, pagosService, config);
  });

  describe('generarParaMesActual', () => {
    it('genera una mensualidad y un link de pago por cada alumno activo', async () => {
      const cantidad = await service.generarParaMesActual(new Date('2026-08-01'));

      expect(cantidad).toBe(2);
      expect(prisma.academiaMensualidad.create).toHaveBeenCalledTimes(2);
      expect(pagosService.crearPagoMensualidad).toHaveBeenCalledTimes(2);
      // montoQ puede llegar como number o string segun como el entorno provea
      // ACADEMIA_MENSUALIDAD_Q; comparamos el valor numerico.
      const [, args] = pagosService.crearPagoMensualidad.mock.calls[0];
      expect(args.mensualidadId).toBe('mensualidad-alumno-1');
      expect(Number(args.montoQ)).toBe(150);
    });

    it('usa el mes y anio de la fecha de referencia', async () => {
      await service.generarParaMesActual(new Date('2026-03-15'));
      const dataCreada = prisma.academiaMensualidad.create.mock.calls[0][0].data;
      expect(dataCreada.mes).toBe(3);
      expect(dataCreada.anio).toBe(2026);
    });

    it('NO genera una mensualidad duplicada si ya existe y tiene su pago', async () => {
      prisma.academiaMensualidad.findUnique
        .mockResolvedValueOnce({ id: 'ya-existe' }) // alumno 1 ya tiene (con pago)
        .mockResolvedValueOnce(null); // alumno 2 no tiene

      const cantidad = await service.generarParaMesActual(new Date('2026-08-01'));

      expect(cantidad).toBe(1);
      expect(prisma.academiaMensualidad.create).toHaveBeenCalledTimes(1);
      expect(pagosService.crearPagoMensualidad).toHaveBeenCalledTimes(1); // solo alumno 2
    });

    it('recupera la mensualidad que existe pero no tiene link de pago', async () => {
      prisma.academiaMensualidad.findUnique
        .mockResolvedValueOnce({ id: 'ya-existe' }) // alumno 1 ya tiene (sin pago)
        .mockResolvedValueOnce(null); // alumno 2 no tiene
      prisma.pago.findFirst.mockResolvedValueOnce(null); // alumno 1 sin pago
      prisma.pago.findFirst.mockResolvedValue({ id: 'payment-existente' }); // resto

      const cantidad = await service.generarParaMesActual(new Date('2026-08-01'));

      expect(cantidad).toBe(1);
      expect(pagosService.crearPagoMensualidad).toHaveBeenCalledTimes(2); // alumno 1 (recuperado) + alumno 2
      expect(pagosService.crearPagoMensualidad).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ mensualidadId: 'ya-existe' }),
      );
    });

    it('no genera nada si no hay alumnos activos', async () => {
      prisma.alumno.findMany.mockResolvedValue([]);
      const cantidad = await service.generarParaMesActual(new Date('2026-08-01'));
      expect(cantidad).toBe(0);
      expect(pagosService.crearPagoMensualidad).not.toHaveBeenCalled();
    });
  });

  describe('listarDelMes', () => {
    it('adjunta el estado de pago y convierte montoQ a number', async () => {
      prisma.academiaMensualidad.findMany.mockResolvedValue([
        { id: 'm1', alumnoId: 'alumno-1', montoQ: '150' },
        { id: 'm2', alumnoId: 'alumno-2', montoQ: 150 },
      ]);
      pagosService.obtenerPagadas.mockResolvedValue(new Set(['m1']));

      const resultado = await service.listarDelMes(8, 2026);

      expect(pagosService.obtenerPagadas).toHaveBeenCalledWith(TipoPagoReferencia.MENSUALIDAD, ['m1', 'm2']);
      expect(resultado[0].pagada).toBe(true);
      expect(resultado[0].montoQ).toBe(150);
      expect(resultado[1].pagada).toBe(false);
      expect(resultado[1].montoQ).toBe(150);
    });
  });
});
