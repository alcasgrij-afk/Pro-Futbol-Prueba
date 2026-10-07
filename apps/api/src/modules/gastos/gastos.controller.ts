import { Body, Controller, Delete, Get, Param, Post, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RolUsuario } from '@profutbol/shared-types';
import type { Response } from 'express';
import { GastosService } from './gastos.service';
import { CrearGastoDto } from './dto/crear-gasto.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { ExcelExportService } from '../reportes/exportacion/excel-export.service';
import { PdfExportService } from '../reportes/exportacion/pdf-export.service';

@ApiTags('gastos')
@ApiBearerAuth()
@Roles(RolUsuario.ADMIN, RolUsuario.RECEPCION)
@Controller('gastos')
export class GastosController {
  constructor(
    private readonly gastosService: GastosService,
    private readonly excelExport: ExcelExportService,
    private readonly pdfExport: PdfExportService,
  ) {}

  @Post()
  crear(@Body() dto: CrearGastoDto) {
    return this.gastosService.crear(dto);
  }

  @Get()
  listar(@Query('desde') desde?: string, @Query('hasta') hasta?: string) {
    return this.gastosService.listar({ desde, hasta });
  }

  @Get('resumen')
  resumen(@Query('desde') desde: string, @Query('hasta') hasta: string) {
    return this.gastosService.resumen(desde, hasta);
  }

  @Roles(RolUsuario.ADMIN)
  @Delete(':id')
  eliminar(@Param('id') id: string) {
    return this.gastosService.eliminar(id);
  }

  @Roles(RolUsuario.ADMIN)
  @Get('exportar')
  async exportar(
    @Query('desde') desde: string,
    @Query('hasta') hasta: string,
    @Query('formato') formato: 'excel' | 'pdf' = 'excel',
    @Res() res: Response,
  ) {
    const [gastos, resumen] = await Promise.all([
      this.gastosService.listar({ desde, hasta }),
      this.gastosService.resumen(desde, hasta),
    ]);
    const reporte = {
      desde,
      hasta,
      totalQ: resumen.totalQ,
      porCategoria: resumen.porCategoria,
      gastos: gastos.map((g) => ({
        fecha: g.fecha.toISOString().slice(0, 10),
        categoria: g.categoria,
        descripcion: g.descripcion ?? '',
        montoQ: Number(g.montoQ),
      })),
    };
    // Nombre pedido por el usuario: "Reporte de Gastos <fecha de HOY>", no el
    // rango desde/hasta del contenido. Fecha LOCAL (mismo criterio que
    // ReportesService.finDelDia) para que coincida con la fecha que ve el
    // usuario en Guatemala, no la fecha UTC.
    const hoy = new Date();
    const fechaHoy = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
    const nombreArchivo = `Reporte de Gastos ${fechaHoy}`;

    if (formato === 'pdf') {
      const buffer = await this.pdfExport.generarReporteGastos(reporte);
      this.enviarArchivo(res, buffer, `${nombreArchivo}.pdf`, 'application/pdf');
    } else {
      const buffer = await this.excelExport.generarReporteGastos(reporte);
      this.enviarArchivo(
        res,
        buffer,
        `${nombreArchivo}.xlsx`,
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
