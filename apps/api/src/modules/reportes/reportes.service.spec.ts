import { TipoPagoReferencia } from '@profutbol/shared-types';
import { ReportesService } from './reportes.service';

describe('ReportesService', () => {
  let service: ReportesService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      pago: { findMany: jest.fn().mockResolvedValue([]) },
      reserva: { findMany: jest.fn(), count: jest.fn(), findUnique: jest.fn() },
      cancha: { findMany: jest.fn() },
      equipo: { findUnique: jest.fn() },
      academiaMensualidad: { findUnique: jest.fn() },
    };
    service = new ReportesService(prisma);
  });

  describe('ingresos (consolidado)', () => {
    it('suma pagos completados de todos los modulos en el total', async () => {
      prisma.pago.findMany.mockResolvedValue([
        { tipoReferencia: TipoPagoReferencia.RESERVA, montoQ: 250, confirmadoEn: new Date('2026-07-20T10:00:00Z') },
        { tipoReferencia: TipoPagoReferencia.EQUIPO, montoQ: 300, confirmadoEn: new Date('2026-07-20T11:00:00Z') },
        { tipoReferencia: TipoPagoReferencia.MENSUALIDAD, montoQ: 150, confirmadoEn: new Date('2026-07-21T09:00:00Z') },
      ]);

      const reporte = await service.ingresos('2026-07-01', '2026-07-31');

      expect(reporte.totalQ).toBe(700);
      expect(reporte.cantidadPagos).toBe(3);
    });

    it('desglosa el total por modulo (reserva/equipo/mensualidad)', async () => {
      prisma.pago.findMany.mockResolvedValue([
        { tipoReferencia: TipoPagoReferencia.RESERVA, montoQ: 250, confirmadoEn: new Date('2026-07-20T10:00:00Z') },
        { tipoReferencia: TipoPagoReferencia.RESERVA, montoQ: 300, confirmadoEn: new Date('2026-07-20T11:00:00Z') },
        { tipoReferencia: TipoPagoReferencia.MENSUALIDAD, montoQ: 150, confirmadoEn: new Date('2026-07-21T09:00:00Z') },
      ]);

      const reporte = await service.ingresos('2026-07-01', '2026-07-31');

      const filaReserva = reporte.porModulo.find((m) => m.tipoReferencia === TipoPagoReferencia.RESERVA);
      const filaMensualidad = reporte.porModulo.find((m) => m.tipoReferencia === TipoPagoReferencia.MENSUALIDAD);
      expect(filaReserva).toEqual(
        expect.objectContaining({ totalQ: 550, cantidad: 2, etiqueta: 'Reservas de cancha' }),
      );
      expect(filaMensualidad).toEqual(
        expect.objectContaining({ totalQ: 150, cantidad: 1, etiqueta: 'Mensualidades de academia' }),
      );
    });

    it('agrupa por dia usando confirmadoEn (fecha de confirmacion del pago)', async () => {
      prisma.pago.findMany.mockResolvedValue([
        { tipoReferencia: TipoPagoReferencia.RESERVA, montoQ: 100, confirmadoEn: new Date('2026-07-20T10:00:00Z') },
        { tipoReferencia: TipoPagoReferencia.RESERVA, montoQ: 200, confirmadoEn: new Date('2026-07-20T23:00:00Z') },
      ]);

      const reporte = await service.ingresos('2026-07-01', '2026-07-31');
      expect(reporte.porDia).toEqual([{ fecha: '2026-07-20', totalQ: 300 }]);
    });

    it('solo consulta pagos con estado COMPLETADO', async () => {
      await service.ingresos('2026-07-01', '2026-07-31');
      const filtro = prisma.pago.findMany.mock.calls[0][0].where;
      expect(filtro.estado).toBe('COMPLETADO');
    });
  });

  describe('ocupacion', () => {
    it('calcula el porcentaje de bloques ocupados por cancha', async () => {
      prisma.cancha.findMany.mockResolvedValue([
        { id: 'c1', nombre: 'Cancha A', horaAperturaMin: 480, horaCierreMin: 1320, duracionBloqueMin: 60 },
      ]);
      prisma.reserva.count.mockResolvedValue(5);

      const reporte = await service.ocupacion('2026-07-01', '2026-07-07');

      // 8am-10pm = 14 bloques/dia * 7 dias = 98 bloques; 5 ocupados = 5.1%
      expect(reporte.porCancha[0].bloquesTotales).toBe(98);
      expect(reporte.porCancha[0].bloquesOcupados).toBe(5);
      expect(reporte.porCancha[0].porcentajeOcupacion).toBe(5.1);
    });

    it('filtra las reservas por estado CONFIRMADA y rango de fechas', async () => {
      prisma.cancha.findMany.mockResolvedValue([
        { id: 'c1', nombre: 'Cancha A', horaAperturaMin: 480, horaCierreMin: 1320, duracionBloqueMin: 60 },
      ]);
      await service.ocupacion('2026-07-01', '2026-07-07');
      const filtro = prisma.reserva.count.mock.calls[0][0].where;
      expect(filtro.estado).toBe('CONFIRMADA');
      expect(filtro.canchaId).toBe('c1');
    });
  });

  describe('morosidad', () => {
    it('calcula el total y los dias de vencimiento de cada pago pendiente', async () => {
      const haceOchoDias = new Date();
      haceOchoDias.setDate(haceOchoDias.getDate() - 8);

      prisma.reserva.findMany = undefined; // no se usa en morosidad
      prisma.pago.findMany = jest.fn().mockResolvedValue([
        { id: 'pago-1', tipoReferencia: TipoPagoReferencia.EQUIPO, montoQ: 300, creadoEn: haceOchoDias },
      ]);
      prisma.equipo.findUnique.mockResolvedValue({ nombre: 'Los Tigres', capitanNombre: 'Juan', capitanTelefono: '50255551234' });

      const reporte = await service.morosidad(7);

      expect(reporte.totalQ).toBe(300);
      expect(reporte.cantidad).toBe(1);
      expect(reporte.detalle[0].diasVencido).toBeGreaterThanOrEqual(8);
      expect(reporte.detalle[0].descripcion).toContain('Los Tigres');
    });

    it('describe correctamente una mensualidad vencida', async () => {
      prisma.pago.findMany.mockResolvedValue([
        { id: 'pago-2', tipoReferencia: TipoPagoReferencia.MENSUALIDAD, montoQ: 150, creadoEn: new Date('2026-01-01') },
      ]);
      prisma.academiaMensualidad.findUnique.mockResolvedValue({
        mes: 7,
        anio: 2026,
        alumno: { nombre: 'Mateo', encargadoTelefono: '50255551234' },
      });

      const reporte = await service.morosidad(7);
      expect(reporte.detalle[0].descripcion).toContain('Mateo');
      expect(reporte.detalle[0].descripcion).toContain('7/2026');
    });

    it('devuelve vacio si no hay pagos vencidos', async () => {
      const reporte = await service.morosidad(7);
      expect(reporte.cantidad).toBe(0);
      expect(reporte.totalQ).toBe(0);
    });
  });
});
