import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CrearConceptoPagoDto {
  @ApiProperty({ example: 'Alquiler de equipo' })
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  nombre: string;
}

export class ActualizarConceptoPagoDto {
  @ApiPropertyOptional({ example: 'Alquiler de equipo' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  nombre?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
