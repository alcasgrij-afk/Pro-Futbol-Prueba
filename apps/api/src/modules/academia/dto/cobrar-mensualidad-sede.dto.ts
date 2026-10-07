import { ApiProperty } from '@nestjs/swagger';
import { GatewayPago } from '@profutbol/shared-types';
import { IsIn, Matches, ValidateIf } from 'class-validator';

export class CobrarMensualidadSedeDto {
  @ApiProperty({ example: GatewayPago.EFECTIVO, enum: [GatewayPago.EFECTIVO, GatewayPago.TARJETA] })
  @IsIn([GatewayPago.EFECTIVO, GatewayPago.TARJETA], { message: 'metodoPago debe ser EFECTIVO o TARJETA.' })
  metodoPago: GatewayPago.EFECTIVO | GatewayPago.TARJETA;

  @ApiProperty({ example: '123456', required: false })
  @ValidateIf((o) => o.metodoPago === GatewayPago.TARJETA)
  @Matches(/^\d{6,12}$/, { message: 'Código POS debe tener entre 6 y 12 dígitos.' })
  codigoAutorizacion?: string;
}
