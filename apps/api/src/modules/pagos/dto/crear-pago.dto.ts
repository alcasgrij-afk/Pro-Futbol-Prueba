import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsString, IsUrl } from 'class-validator';
import { TipoPagoReferencia } from '@profutbol/shared-types';

export class CrearPagoDto {
  @ApiProperty({ enum: TipoPagoReferencia, example: TipoPagoReferencia.RESERVA })
  @IsEnum(TipoPagoReferencia)
  referenciaTipo: TipoPagoReferencia;

  @ApiProperty({ example: 'uuid-de-la-reserva' })
  @IsString()
  referenciaId: string;

  @ApiPropertyOptional({ example: 150 })
  @IsNumber()
  @IsOptional()
  monto?: number;

  @ApiPropertyOptional({ example: 'http://localhost:3000/gracias' })
  @IsUrl({ require_tld: false })
  @IsOptional()
  returnUrl?: string;
}
