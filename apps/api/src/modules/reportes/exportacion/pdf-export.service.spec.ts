import { PdfExportService } from './pdf-export.service';
import {
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
});
