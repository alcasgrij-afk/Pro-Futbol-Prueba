import * as ExcelJS from 'exceljs';
import {
  ExcelExportService,
  ReporteIngresosParaExportar,
  ReporteMorosidadParaExportar,
} from './excel-export.service';

describe('ExcelExportService', () => {
  const service = new ExcelExportService();

  const ingresos: ReporteIngresosParaExportar = {
    desde: '2026-07-01',
    hasta: '2026-07-31',
    totalQ: 700,
    cantidadPagos: 3,
    porModulo: [
      { etiqueta: 'Reservas', totalQ: 550, cantidad: 2 },
      { etiqueta: 'Equipos', totalQ: 150, cantidad: 1 },
    ],
    porDia: [
      { fecha: '2026-07-20', totalQ: 550 },
      { fecha: '2026-07-21', totalQ: 150 },
    ],
  };

  it('genera un .xlsx real (magic bytes ZIP) no vacio', async () => {
    const buffer = await service.generarReporteIngresos(ingresos);

    expect(buffer.length).toBeGreaterThan(1000);
    // Un XLSX es un ZIP: debe arrancar con PK\x03\x04.
    expect(buffer.subarray(0, 2).toString()).toBe('PK');
    expect(buffer[2]).toBe(0x03);
    expect(buffer[3]).toBe(0x04);
  });

  it('los datos de ingresos se leen de vuelta del libro', async () => {
    const buffer = await service.generarReporteIngresos(ingresos);

    const wb = new ExcelJS.Workbook();
    // La firma de exceljs espera su propio tipo Buffer (no el generico de
    // @types/node 20). Cast a any para poder hacer el round-trip de lectura.
    await wb.xlsx.load(buffer as any);

    const resumen = wb.getWorksheet('Resumen')!;
    // Fila 1 encabezado, 2 periodo, 3 ingreso total, 4 cantidad.
    expect(resumen.getRow(3).getCell(1).value).toBe('Ingreso total (Q)');
    expect(resumen.getRow(3).getCell(2).value).toBe(700);

    const porModulo = wb.getWorksheet('Por modulo')!;
    expect(porModulo.getRow(2).getCell(1).value).toBe('Reservas');
    expect(porModulo.getRow(2).getCell(2).value).toBe(550);
  });

  it('genera el reporte de morosidad, incluso vacio (sin detalle)', async () => {
    const morosidad: ReporteMorosidadParaExportar = {
      diasVencimiento: 30,
      totalQ: 0,
      cantidad: 0,
      detalle: [],
    };

    const buffer = await service.generarReporteMorosidad(morosidad);

    expect(buffer.length).toBeGreaterThan(1000);
    expect(buffer.subarray(0, 2).toString()).toBe('PK');
  });
});
