import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, Matches } from 'class-validator';

export class ReprogramarReservaDto {
  @ApiPropertyOptional({ example: 'seed-cancha-futbol-7' })
  @IsOptional()
  @IsString()
  canchaId?: string;

  @ApiPropertyOptional({ example: '2026-07-20' })
  @IsOptional()
  @IsDateString({}, { message: 'La fecha debe tener formato YYYY-MM-DD.' })
  fecha?: string;

  @ApiPropertyOptional({ example: '19:00' })
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'horaInicio debe tener formato HH:mm.' })
  horaInicio?: string;
}
