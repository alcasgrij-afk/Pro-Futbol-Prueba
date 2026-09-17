import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { EstadoTorneo } from '@profutbol/shared-types';

export class CambiarEstadoDto {
  @ApiProperty({ enum: EstadoTorneo, example: EstadoTorneo.EN_CURSO })
  @IsEnum(EstadoTorneo)
  estado: EstadoTorneo;
}
