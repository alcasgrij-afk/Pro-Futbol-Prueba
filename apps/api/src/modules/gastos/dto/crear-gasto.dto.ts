import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GastoCategoria } from '@profutbol/shared-types';
import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CrearGastoDto {
  @ApiProperty({ enum: GastoCategoria, example: GastoCategoria.SUMINISTROS })
  @IsEnum(GastoCategoria)
  categoria: GastoCategoria;

  @ApiProperty({ example: 150 })
  @IsNumber()
  @Min(0)
  montoQ: number;

  @ApiPropertyOptional({ example: 'Balones y conos nuevos' })
  @IsOptional()
  @IsString()
  descripcion?: string;

  @ApiProperty({ example: '2026-07-20' })
  @IsDateString({}, { message: 'La fecha debe tener formato YYYY-MM-DD.' })
  fecha: string;
}
