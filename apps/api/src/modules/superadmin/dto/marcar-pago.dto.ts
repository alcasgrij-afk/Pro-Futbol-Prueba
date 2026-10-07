import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export class MarcarPagoDto {
  @ApiProperty({ enum: ['COMPLETADO', 'CANCELADO'] })
  @IsIn(['COMPLETADO', 'CANCELADO'])
  estado: 'COMPLETADO' | 'CANCELADO';
}
