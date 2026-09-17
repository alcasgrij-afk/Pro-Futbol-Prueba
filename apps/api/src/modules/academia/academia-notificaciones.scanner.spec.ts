import { ConfigService } from '@nestjs/config';
import { AcademiaNotificacionesScanner } from './academia-notificaciones.scanner';

describe('AcademiaNotificacionesScanner', () => {
  let scanner: AcademiaNotificacionesScanner;
  let prisma: any;
  let pagosService: any;

  const mensualidadMock = {
    id: 'mensualidad-1',
    mes: 7,
    anio: 2026,
    montoQ: 150,
    alumno: { nombre: 'Mateo', encargadoTelefono: '50255551234' },
  };

  beforeEach(() => {
    prisma = {
      academiaMensualidad: {
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    pagosService = { estaPagada: jest.fn().mockResolvedValue(false) };
    const config = new ConfigService({ ACADEMIA_DIAS_GRACIA_PAGO: 5 });
    scanner = new AcademiaNotificacionesScanner(prisma, pagosService, config);
  });

  it('marca como avisada cada mensualidad vencida y sin pagar', async () => {
    prisma.academiaMensualidad.findMany.mockResolvedValue([mensualidadMock]);

    const cantidad = await scanner.escanearMensualidadesVencidas();

    expect(cantidad).toBe(1);
    expect(prisma.academiaMensualidad.update).toHaveBeenCalledWith({
      where: { id: 'mensualidad-1' },
      data: { avisoVencidoEnviado: true },
    });
  });

  it('no avisa si la mensualidad ya fue pagada, pero igual la marca como revisada', async () => {
    prisma.academiaMensualidad.findMany.mockResolvedValue([mensualidadMock]);
    pagosService.estaPagada.mockResolvedValue(true);

    const cantidad = await scanner.escanearMensualidadesVencidas();

    expect(cantidad).toBe(0);
    expect(prisma.academiaMensualidad.update).toHaveBeenCalledWith({
      where: { id: 'mensualidad-1' },
      data: { avisoVencidoEnviado: true },
    });
  });

  it('consulta solo mensualidades con avisoVencidoEnviado en false y creadas antes del periodo de gracia', async () => {
    await scanner.escanearMensualidadesVencidas();
    const filtro = prisma.academiaMensualidad.findMany.mock.calls[0][0].where;
    expect(filtro.avisoVencidoEnviado).toBe(false);
    expect(filtro.creadoEn.lte).toBeInstanceOf(Date);
  });

  it('no hace nada si no hay mensualidades candidatas', async () => {
    const cantidad = await scanner.escanearMensualidadesVencidas();
    expect(cantidad).toBe(0);
    expect(prisma.academiaMensualidad.update).not.toHaveBeenCalled();
  });
});
