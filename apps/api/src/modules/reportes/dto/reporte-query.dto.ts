import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsOptional } from 'class-validator';

export class ReporteQueryDto {
  @ApiProperty({ example: '2026-07-01' })
  @IsDateString()
  desde: string;

  @ApiProperty({ example: '2026-07-31' })
  @IsDateString()
  hasta: string;

  // Solo lo usan los endpoints de exportacion; declararlo aqui evita que el
  // ValidationPipe (forbidNonWhitelisted) lo rechace como desconocido.
  @ApiPropertyOptional({ enum: ['excel', 'pdf'], default: 'excel' })
  @IsOptional()
  @IsIn(['excel', 'pdf'])
  formato?: 'excel' | 'pdf';
}
