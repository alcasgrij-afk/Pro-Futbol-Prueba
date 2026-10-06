import { Module } from '@nestjs/common';
import { GastosController } from './gastos.controller';
import { GastosService } from './gastos.service';
import { ExcelExportService } from '../reportes/exportacion/excel-export.service';
import { PdfExportService } from '../reportes/exportacion/pdf-export.service';

@Module({
  controllers: [GastosController],
  providers: [GastosService, ExcelExportService, PdfExportService],
})
export class GastosModule {}
