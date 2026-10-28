import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import {
  ReporteCierreParaExportar,
  ReporteGastosParaExportar,
  ReporteIngresosParaExportar,
  ReporteMorosidadParaExportar,
} from './excel-export.service';

const NAVY = '#00205B';
const RED = '#E4032C';
const GRAY = '#4A4A4A';

/**
 * Genera PDFs con pdfkit (libreria pura de Node, sin necesidad de un
 * navegador/Chromium como requeriria Puppeteer) — mas liviano y mas simple
 * de desplegar en un servidor pequeno (ver Plan Tecnico, Fase 5).
 */
@Injectable()
export class PdfExportService {
  async generarReporteIngresos(reporte: ReporteIngresosParaExportar): Promise<Buffer> {
    return this.construirDocumento((doc) => {
      this.encabezado(doc, 'Reporte de Ingresos');
      doc.fontSize(10).fillColor(GRAY).text(`Periodo: ${reporte.desde} a ${reporte.hasta}`);
      doc.moveDown(1);

      doc.fontSize(20).fillColor(NAVY).text(`Q${reporte.totalQ.toLocaleString('es-GT')}`, { continued: false });
      doc.fontSize(10).fillColor(GRAY).text(`${reporte.cantidadPagos} pagos confirmados en el periodo`);
      doc.moveDown(1.5);

      doc.fontSize(13).fillColor(NAVY).text('Ingresos por modulo');
      doc.moveDown(0.3);
      reporte.porModulo.forEach((m) => {
        doc
          .fontSize(10)
          .fillColor(GRAY)
          .text(`${m.etiqueta}: Q${m.totalQ.toLocaleString('es-GT')} (${m.cantidad} pagos)`);
      });
      doc.moveDown(1.5);

      doc.fontSize(13).fillColor(NAVY).text('Ingresos por dia');
      doc.moveDown(0.3);
      reporte.porDia.forEach((d) => {
        doc.fontSize(10).fillColor(GRAY).text(`${d.fecha}: Q${d.totalQ.toLocaleString('es-GT')}`);
      });
    });
  }

  async generarReporteMorosidad(reporte: ReporteMorosidadParaExportar): Promise<Buffer> {
    return this.construirDocumento((doc) => {
      this.encabezado(doc, 'Reporte de Morosidad');
      doc
        .fontSize(10)
        .fillColor(GRAY)
        .text(`Pagos pendientes con mas de ${reporte.diasVencimiento} dias sin resolverse`);
      doc.moveDown(1);

      doc.fontSize(20).fillColor(RED).text(`Q${reporte.totalQ.toLocaleString('es-GT')}`);
      doc.fontSize(10).fillColor(GRAY).text(`${reporte.cantidad} pagos pendientes`);
      doc.moveDown(1.5);

      reporte.detalle.forEach((d) => {
        doc
          .fontSize(10)
          .fillColor(NAVY)
          .text(`${d.etiqueta} — Q${d.montoQ} — ${d.diasVencido} dias vencido`, { continued: false });
        doc.fontSize(9).fillColor(GRAY).text(d.descripcion);
        doc.moveDown(0.5);
      });

      if (reporte.detalle.length === 0) {
        doc.fontSize(10).fillColor(GRAY).text('No hay pagos vencidos en este momento.');
      }
    });
  }

  async generarReporteGastos(reporte: ReporteGastosParaExportar): Promise<Buffer> {
    return this.construirDocumento((doc) => {
      this.encabezado(doc, 'Reporte de Gastos');
      doc.fontSize(10).fillColor(GRAY).text(`Periodo: ${reporte.desde} a ${reporte.hasta}`);
      doc.moveDown(1);

      doc.fontSize(20).fillColor(RED).text(`Q${reporte.totalQ.toLocaleString('es-GT')}`);
      doc.moveDown(1.5);

      doc.fontSize(13).fillColor(NAVY).text('Gastos por categoria');
      doc.moveDown(0.3);
      reporte.porCategoria.forEach((c) => {
        doc
          .fontSize(10)
          .fillColor(GRAY)
          .text(`${c.categoria}: Q${c.totalQ.toLocaleString('es-GT')} (${c.cantidad} gastos)`);
      });
      doc.moveDown(1.5);

      doc.fontSize(13).fillColor(NAVY).text('Detalle');
      doc.moveDown(0.3);
      reporte.gastos.forEach((g) => {
        doc.fontSize(10).fillColor(GRAY).text(`${g.fecha} — ${g.categoria} — Q${g.montoQ} — ${g.descripcion}`);
      });
    });
  }

  private encabezado(doc: PDFKit.PDFDocument, titulo: string) {
    doc.fontSize(18).fillColor(NAVY).text('Pro Futbol Antigua', { continued: false });
    doc.fontSize(14).fillColor(RED).text(titulo);
    doc.moveDown(0.5);
  }

  /**
   * Cierre de caja (dia/semana/mes) en una hoja: ingresos por categoria y
   * metodo, gastos, tienda y el neto. Es el PDF que el personal comparte por
   * WhatsApp/correo al cerrar.
   */
  async generarReporteCierre(reporte: ReporteCierreParaExportar): Promise<Buffer> {
    return this.construirDocumento((doc) => {
      this.encabezado(doc, 'Cierre de Caja');
      doc.fontSize(10).fillColor(GRAY).text(`Periodo: ${reporte.desde} a ${reporte.hasta}`);
      doc.moveDown(1);

      doc.fontSize(20).fillColor(NAVY).text(`Neto: Q${reporte.netoQ.toLocaleString('es-GT')}`);
      doc
        .fontSize(10)
        .fillColor(GRAY)
        .text(
          `Ingresos Q${reporte.ingresos.totalQ.toLocaleString('es-GT')} (${reporte.ingresos.cantidad} pagos) — ` +
            `Gastos Q${reporte.gastos.totalQ.toLocaleString('es-GT')}`,
        );
      doc.moveDown(1.5);

      doc.fontSize(13).fillColor(NAVY).text('Ingresos por categoria');
      doc.moveDown(0.3);
      reporte.ingresos.porCategoria.forEach((c) => {
        doc
          .fontSize(10)
          .fillColor(GRAY)
          .text(`${c.etiqueta}: Q${c.totalQ.toLocaleString('es-GT')} (${c.cantidad} pagos)`);
      });
      doc.moveDown(1);

      doc.fontSize(13).fillColor(NAVY).text('Por metodo de pago');
      doc.moveDown(0.3);
      reporte.ingresos.porMetodo.forEach((m) => {
        doc
          .fontSize(10)
          .fillColor(GRAY)
          .text(`${m.gateway}: Q${m.totalQ.toLocaleString('es-GT')} (${m.cantidad} pagos)`);
      });
      doc.moveDown(1);

      doc.fontSize(13).fillColor(NAVY).text('Gastos por categoria');
      doc.moveDown(0.3);
      if (reporte.gastos.porCategoria.length === 0) {
        doc.fontSize(10).fillColor(GRAY).text('Sin gastos registrados en el periodo.');
      }
      reporte.gastos.porCategoria.forEach((c) => {
        doc
          .fontSize(10)
          .fillColor(RED)
          .text(`${c.categoria}: Q${c.totalQ.toLocaleString('es-GT')} (${c.cantidad} gastos)`);
      });
      doc.moveDown(1);

      doc
        .fontSize(13)
        .fillColor(NAVY)
        .text(`Tienda — Q${reporte.ventas.totalQ.toLocaleString('es-GT')} en ${reporte.ventas.cantidad} ventas`);
      doc.moveDown(0.3);
      // Aclaracion explicita en el papel: el total de tienda ya esta contado
      // dentro de los ingresos, no se vuelve a sumar en el neto.
      doc.fontSize(8).fillColor(GRAY).text('(ya incluido en los ingresos de arriba)');
      doc.moveDown(0.3);
      reporte.ventas.porProducto.forEach((pr) => {
        doc
          .fontSize(10)
          .fillColor(GRAY)
          .text(`${pr.cantidad}x ${pr.nombre}: Q${pr.totalQ.toLocaleString('es-GT')}`);
      });
    });
  }

  private construirDocumento(dibujar: (doc: PDFKit.PDFDocument) => void): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      dibujar(doc);

      doc.end();
    });
  }
}
