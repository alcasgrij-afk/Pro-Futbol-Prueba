import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';

export interface ReporteIngresosParaExportar {
  desde: string;
  hasta: string;
  totalQ: number;
  cantidadPagos: number;
  porModulo: { etiqueta: string; totalQ: number; cantidad: number }[];
  porDia: { fecha: string; totalQ: number }[];
}

export interface ReporteMorosidadParaExportar {
  diasVencimiento: number;
  totalQ: number;
  cantidad: number;
  detalle: { etiqueta: string; descripcion: string; montoQ: number; diasVencido: number }[];
}

/**
 * Genera archivos .xlsx reales (no HTML disfrazado de Excel) usando exceljs,
 * para que el personal administrativo pueda abrirlos directo en Excel/Google
 * Sheets y usarlos para su contabilidad (ver Plan Tecnico, Fase 5 / Sprint 1).
 */
@Injectable()
export class ExcelExportService {
  async generarReporteIngresos(reporte: ReporteIngresosParaExportar): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Pro Futbol Antigua';
    workbook.created = new Date();

    const resumen = workbook.addWorksheet('Resumen');
    resumen.columns = [
      { header: 'Concepto', key: 'concepto', width: 30 },
      { header: 'Valor', key: 'valor', width: 20 },
    ];
    resumen.addRows([
      { concepto: 'Periodo', valor: `${reporte.desde} a ${reporte.hasta}` },
      { concepto: 'Ingreso total (Q)', valor: reporte.totalQ },
      { concepto: 'Cantidad de pagos', valor: reporte.cantidadPagos },
    ]);
    resumen.getRow(1).font = { bold: true };

    const porModulo = workbook.addWorksheet('Por modulo');
    porModulo.columns = [
      { header: 'Modulo', key: 'etiqueta', width: 28 },
      { header: 'Ingreso (Q)', key: 'totalQ', width: 15 },
      { header: 'Cantidad de pagos', key: 'cantidad', width: 18 },
    ];
    porModulo.addRows(reporte.porModulo);
    porModulo.getRow(1).font = { bold: true };

    const porDia = workbook.addWorksheet('Por dia');
    porDia.columns = [
      { header: 'Fecha', key: 'fecha', width: 15 },
      { header: 'Ingreso (Q)', key: 'totalQ', width: 15 },
    ];
    porDia.addRows(reporte.porDia);
    porDia.getRow(1).font = { bold: true };

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
  }

  async generarReporteMorosidad(reporte: ReporteMorosidadParaExportar): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Pro Futbol Antigua';
    workbook.created = new Date();

    const hoja = workbook.addWorksheet('Morosidad');
    hoja.columns = [
      { header: 'Modulo', key: 'etiqueta', width: 24 },
      { header: 'Detalle', key: 'descripcion', width: 45 },
      { header: 'Monto (Q)', key: 'montoQ', width: 12 },
      { header: 'Dias vencido', key: 'diasVencido', width: 14 },
    ];
    hoja.addRows(reporte.detalle);
    hoja.getRow(1).font = { bold: true };

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
  }
}
