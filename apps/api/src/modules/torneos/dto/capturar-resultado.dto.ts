import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CapturarResultadoDto {
  @ApiProperty({ example: 'uuid-del-partido' })
  @IsString()
  partidoId: string;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsInt()
  @Min(0)
  golesLocal?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(0)
  golesVisitante?: number;

  /** Ganador por penales (requerido en eliminacion directa si el partido terminó empatado). */
  @ApiPropertyOptional({ example: 'uuid-del-equipo' })
  @IsOptional()
  @IsUUID()
  penalesGanadorId?: string;
}