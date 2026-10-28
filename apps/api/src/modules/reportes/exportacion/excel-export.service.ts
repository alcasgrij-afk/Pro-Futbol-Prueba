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

export interface ReporteGastosParaExportar {
  desde: string;
  hasta: string;
  totalQ: number;
  porCategoria: { categoria: string; totalQ: number; cantidad: number }[];
  gastos: { fecha: string; categoria: string; descripcion: string; montoQ: number }[];
}

export interface ReporteCierreParaExportar {
  desde: string;
  hasta: string;
  ingresos: {
    totalQ: number;
    cantidad: number;
    porCategoria: { etiqueta: string; totalQ: number; cantidad: number }[];
    porMetodo: { gateway: string; totalQ: number; cantidad: number }[];
  };
  gastos: { totalQ: number; porCategoria: { categoria: string; totalQ: number; cantidad: number }[] };
  ventas: { totalQ: number; cantidad: number; porProducto: { nombre: string; cantidad: number; totalQ: number }[] };
  netoQ: number;
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

  /**
   * Cierre de caja (dia/semana/mes): ingresos por categoria y metodo, gastos y
   * venta de tienda en un solo archivo. El total de ventas NO se suma al neto
   * (ya viene dentro de los ingresos); se incluye como desglose.
   */
  async generarReporteCierre(reporte: ReporteCierreParaExportar): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Pro Futbol Antigua';
    workbook.created = new Date();

    const resumen = workbook.addWorksheet('Resumen');
    resumen.columns = [
      { header: 'Concepto', key: 'concepto', width: 34 },
      { header: 'Valor', key: 'valor', width: 22 },
    ];
    resumen.addRows([
      { concepto: 'Periodo', valor: `${reporte.desde} a ${reporte.hasta}` },
      { concepto: 'Ingresos (Q)', valor: reporte.ingresos.totalQ },
      { concepto: 'Cantidad de pagos', valor: reporte.ingresos.cantidad },
      { concepto: 'Gastos (Q)', valor: reporte.gastos.totalQ },
      { concepto: 'Neto (ingresos - gastos) (Q)', valor: reporte.netoQ },
      { concepto: 'Venta de tienda (incluida en ingresos) (Q)', valor: reporte.ventas.totalQ },
    ]);
    resumen.getRow(1).font = { bold: true };

    const ingresos = workbook.addWorksheet('Ingresos');
    ingresos.columns = [
      { header: 'Categoria', key: 'etiqueta', width: 28 },
      { header: 'Ingreso (Q)', key: 'totalQ', width: 15 },
      { header: 'Cantidad', key: 'cantidad', width: 12 },
    ];
    ingresos.addRows(reporte.ingresos.porCategoria);
    ingresos.getRow(1).font = { bold: true };

    const metodos = workbook.addWorksheet('Metodos de pago');
    metodos.columns = [
      { header: 'Metodo', key: 'gateway', width: 20 },
      { header: 'Ingreso (Q)', key: 'totalQ', width: 15 },
      { header: 'Cantidad', key: 'cantidad', width: 12 },
    ];
    metodos.addRows(reporte.ingresos.porMetodo);
    metodos.getRow(1).font = { bold: true };

    const gastos = workbook.addWorksheet('Gastos');
    gastos.columns = [
      { header: 'Categoria', key: 'categoria', width: 24 },
      { header: 'Gasto (Q)', key: 'totalQ', width: 15 },
      { header: 'Cantidad', key: 'cantidad', width: 12 },
    ];
    gastos.addRows(reporte.gastos.porCategoria);
    gastos.getRow(1).font = { bold: true };

    const tienda = workbook.addWorksheet('Tienda');
    tienda.columns = [
      { header: 'Producto', key: 'nombre', width: 32 },
      { header: 'Cantidad', key: 'cantidad', width: 12 },
      { header: 'Total (Q)', key: 'totalQ', width: 15 },
    ];
    tienda.addRows(reporte.ventas.porProducto);
    tienda.getRow(1).font = { bold: true };

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

  async generarReporteGastos(reporte: ReporteGastosParaExportar): Promise<Buffer> {
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
      { concepto: 'Gasto total (Q)', valor: reporte.totalQ },
    ]);
    resumen.getRow(1).font = { bold: true };

    const porCategoria = workbook.addWorksheet('Por categoria');
    porCategoria.columns = [
      { header: 'Categoria', key: 'categoria', width: 24 },
      { header: 'Gasto (Q)', key: 'totalQ', width: 15 },
      { header: 'Cantidad', key: 'cantidad', width: 12 },
    ];
    porCategoria.addRows(reporte.porCategoria);
    porCategoria.getRow(1).font = { bold: true };

    const detalle = workbook.addWorksheet('Detalle');
    detalle.columns = [
      { header: 'Fecha', key: 'fecha', width: 15 },
      { header: 'Categoria', key: 'categoria', width: 20 },
      { header: 'Descripcion', key: 'descripcion', width: 40 },
      { header: 'Monto (Q)', key: 'montoQ', width: 15 },
    ];
    detalle.addRows(reporte.gastos);
    detalle.getRow(1).font = { bold: true };

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
  }
}
