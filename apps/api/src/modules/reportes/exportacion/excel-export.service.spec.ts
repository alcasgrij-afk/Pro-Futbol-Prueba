import * as ExcelJS from 'exceljs';
import {
  ExcelExportService,
  ReporteCierreParaExportar,
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

  it('el cierre de caja expone neto, gastos y tienda sin doble conteo', async () => {
    const buffer = await service.generarReporteCierre(cierre);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as any);

    const resumen = wb.getWorksheet('Resumen')!;
    expect(resumen.getRow(3).getCell(2).value).toBe(950); // ingresos
    expect(resumen.getRow(5).getCell(2).value).toBe(300); // gastos
    // El neto es ingresos - gastos: la venta de tienda NO se vuelve a sumar.
    expect(resumen.getRow(6).getCell(2).value).toBe(650);
    expect(resumen.getRow(7).getCell(2).value).toBe(150); // tienda, informativo

    expect(wb.getWorksheet('Metodos de pago')!.getRow(2).getCell(1).value).toBe('EFECTIVO');
    expect(wb.getWorksheet('Tienda')!.getRow(2).getCell(1).value).toBe('Camiseta');
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
