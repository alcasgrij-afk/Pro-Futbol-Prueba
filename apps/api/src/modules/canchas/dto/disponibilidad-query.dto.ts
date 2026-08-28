import { ApiProperty } from '@nestjs/swagger';
import { IsDateString } from 'class-validator';

export class DisponibilidadQueryDto {
  @ApiProperty({ example: '2026-07-20', description: 'Fecha en formato YYYY-MM-DD' })
  @IsDateString({}, { message: 'La fecha debe tener formato YYYY-MM-DD.' })
  fecha: string;
}
