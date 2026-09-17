import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolUsuario } from '@prisma/client';
import type { Response } from 'express';
import { ReportesService } from './reportes.service';
import { ReporteQueryDto } from './dto/reporte-query.dto';
import { ExcelExportService } from './exportacion/excel-export.service';
import { PdfExportService } from './exportacion/pdf-export.service';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('reportes')
@ApiBearerAuth()
@Roles(RolUsuario.ADMIN)
@Controller('reportes')
export class ReportesController {
  constructor(
    private readonly reportesService: ReportesService,
    private readonly excelExport: ExcelExportService,
    private readonly pdfExport: PdfExportService,
  ) {}

  @ApiOperation({ summary: 'Ingresos del periodo (reservas + torneos + academia)' })
  @Get('ingresos')
  ingresos(@Query() query: ReporteQueryDto) {
    return this.reportesService.ingresos(query.desde, query.hasta);
  }

  @ApiOperation({ summary: 'Ocupacion por cancha en el periodo' })
  @Get('ocupacion')
  ocupacion(@Query() query: ReporteQueryDto) {
    return this.reportesService.ocupacion(query.desde, query.hasta);
  }

  @ApiOperation({ summary: 'Pagos pendientes vencidos (morosidad)' })
  @Get('morosidad')
  morosidad(@Query('diasVencimiento') diasVencimiento?: string) {
    return this.reportesService.morosidad(diasVencimiento ? Number(diasVencimiento) : undefined);
  }

  @ApiOperation({ summary: 'Exportar ingresos a Excel o PDF' })
  @Get('ingresos/exportar')
  async exportarIngresos(
    @Query() query: ReporteQueryDto,
    @Query('formato') formato: 'excel' | 'pdf' = 'excel',
    @Res() res: Response,
  ) {
    const reporte = await this.reportesService.ingresos(query.desde, query.hasta);
    const nombreArchivo = `ingresos_${query.desde}_a_${query.hasta}`;

    if (formato === 'pdf') {
      const buffer = await this.pdfExport.generarReporteIngresos(reporte);
      this.enviarArchivo(res, buffer, `${nombreArchivo}.pdf`, 'application/pdf');
    } else {
      const buffer = await this.excelExport.generarReporteIngresos(reporte);
      this.enviarArchivo(
        res,
        buffer,
        `${nombreArchivo}.xlsx`,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
    }
  }

  @ApiOperation({ summary: 'Exportar morosidad a Excel o PDF' })
  @Get('morosidad/exportar')
  async exportarMorosidad(
    @Query('diasVencimiento') diasVencimiento: string | undefined,
    @Query('formato') formato: 'excel' | 'pdf' = 'excel',
    @Res() res: Response,
  ) {
    const reporte = await this.reportesService.morosidad(diasVencimiento ? Number(diasVencimiento) : undefined);

    if (formato === 'pdf') {
      const buffer = await this.pdfExport.generarReporteMorosidad(reporte);
      this.enviarArchivo(res, buffer, 'morosidad.pdf', 'application/pdf');
    } else {
      const buffer = await this.excelExport.generarReporteMorosidad(reporte);
      this.enviarArchivo(
        res,
        buffer,
        'morosidad.xlsx',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
    }
  }

  private enviarArchivo(res: Response, buffer: Buffer, nombreArchivo: string, contentType: string) {
    res.set({
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${nombreArchivo}"`,
      'Content-Length': buffer.length,
    });
    res.send(buffer);
  }
}
