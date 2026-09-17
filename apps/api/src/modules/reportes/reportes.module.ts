import { Module } from '@nestjs/common';
import { ReportesController } from './reportes.controller';
import { ReportesService } from './reportes.service';
import { ExcelExportService } from './exportacion/excel-export.service';
import { PdfExportService } from './exportacion/pdf-export.service';

@Module({
  controllers: [ReportesController],
  providers: [ReportesService, ExcelExportService, PdfExportService],
})
export class ReportesModule {}
