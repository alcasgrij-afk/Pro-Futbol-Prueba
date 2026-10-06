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
    const nombreArchivo = `gastos_${desde}_a_${hasta}`;

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
