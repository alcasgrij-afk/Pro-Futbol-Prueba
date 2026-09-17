import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { FormatoTorneo } from '@profutbol/shared-types';

export class CrearTorneoDto {
  @ApiProperty({ example: 'Apertura 2026 - Categoria Libre' })
  @IsString()
  @MaxLength(150)
  nombre: string;

  @ApiPropertyOptional({ example: 'Campeonato semestral categoria libre' })
  @IsString()
  @IsOptional()
  descripcion?: string;

  @ApiProperty({ enum: FormatoTorneo, example: FormatoTorneo.LIGA })
  @IsEnum(FormatoTorneo)
  formato: FormatoTorneo;

  @ApiPropertyOptional({ example: 'Libre' })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  categoria?: string;

  @ApiPropertyOptional({ example: 8 })
  @IsInt()
  @Min(2)
  @Max(64)
  @IsOptional()
  maxEquipos?: number;

  @ApiPropertyOptional({ example: 100 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  cuotaInscripcionQ?: number;

  @ApiPropertyOptional({ example: '2026-08-10' })
  @IsDateString()
  @IsOptional()
  fechaLimiteInscripcion?: string;
}
