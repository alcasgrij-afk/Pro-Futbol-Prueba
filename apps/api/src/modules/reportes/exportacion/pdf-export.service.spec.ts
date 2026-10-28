import { PdfExportService } from './pdf-export.service';
import {
  ReporteCierreParaExportar,
  ReporteIngresosParaExportar,
  ReporteMorosidadParaExportar,
} from './excel-export.service';

describe('PdfExportService', () => {
  const service = new PdfExportService();

  const ingresos: ReporteIngresosParaExportar = {
    desde: '2026-07-01',
    hasta: '2026-07-31',
    totalQ: 700,
    cantidadPagos: 3,
    porModulo: [{ etiqueta: 'Reservas', totalQ: 550, cantidad: 2 }],
    porDia: [{ fecha: '2026-07-20', totalQ: 550 }],
  };


  const cierre: ReporteCierreParaExportar = {
    desde: '2026-10-27',
    hasta: '2026-10-27',
    ingresos: {
      totalQ: 950,
      cantidad: 4,
      porCategoria: [
        { etiqueta: 'Reservas de cancha', totalQ: 600, cantidad: 2 },
        { etiqueta: 'Servicio de arbitraje', totalQ: 200, cantidad: 1 },
        { etiqueta: 'Venta de productos', totalQ: 150, cantidad: 1 },
      ],
      porMetodo: [
        { gateway: 'EFECTIVO', totalQ: 750, cantidad: 3 },
        { gateway: 'TARJETA', totalQ: 200, cantidad: 1 },
      ],
    },
    gastos: { totalQ: 300, porCategoria: [{ categoria: 'SUMINISTROS', totalQ: 300, cantidad: 1 }] },
    ventas: { totalQ: 150, cantidad: 1, porProducto: [{ nombre: 'Camiseta', cantidad: 1, totalQ: 150 }] },
    netoQ: 650,
  };

  it('genera un PDF real (%PDF) no vacio con marcador de fin', async () => {
    const buffer = await service.generarReporteIngresos(ingresos);

    expect(buffer.length).toBeGreaterThan(1000);
    expect(buffer.subarray(0, 4).toString()).toBe('%PDF');
    expect(buffer.toString('latin1')).toContain('%%EOF');
  });

  it('genera el reporte de morosidad', async () => {
    const morosidad: ReporteMorosidadParaExportar = {
      diasVencimiento: 30,
      totalQ: 150,
      cantidad: 1,
      detalle: [
        { etiqueta: 'Mensualidad', descripcion: 'Alumno X - julio', montoQ: 150, diasVencido: 45 },
      ],
    };

    const buffer = await service.generarReporteMorosidad(morosidad);

    expect(buffer.length).toBeGreaterThan(1000);
    expect(buffer.subarray(0, 4).toString()).toBe('%PDF');
  });

  it('genera el cierre de caja con el neto en el documento', async () => {
    const buffer = await service.generarReporteCierre(cierre);
    const texto = buffer.toString('latin1');

    expect(buffer.subarray(0, 4).toString()).toBe('%PDF');
    expect(texto).toContain('%%EOF');
    expect(buffer.length).toBeGreaterThan(1000);
  });

  it('el cierre no truena con gastos vacios', async () => {
    const buffer = await service.generarReporteCierre({
      ...cierre,
      gastos: { totalQ: 0, porCategoria: [] },
      netoQ: cierre.ingresos.totalQ,
    });

    expect(buffer.subarray(0, 4).toString()).toBe('%PDF');
  });
});
