import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GatewayPago } from '@profutbol/shared-types';
import { IsIn, IsNumber, IsPositive, Matches, ValidateIf } from 'class-validator';

/** Abono (pago parcial) de una reserva existente, cobrado en Caja. */
export class CobrarAbonoDto {
  @ApiProperty({ example: 100 })
  @IsNumber()
  @IsPositive({ message: 'El abono debe ser mayor a 0.' })
  montoQ: number;

  @ApiProperty({ example: GatewayPago.EFECTIVO, enum: [GatewayPago.EFECTIVO, GatewayPago.TARJETA] })
  @IsIn([GatewayPago.EFECTIVO, GatewayPago.TARJETA], { message: 'metodoPago debe ser EFECTIVO o TARJETA.' })
  metodoPago: GatewayPago.EFECTIVO | GatewayPago.TARJETA;

  @ApiPropertyOptional({ example: '123456' })
  @ValidateIf((o) => o.metodoPago === GatewayPago.TARJETA)
  @Matches(/^\d{6,12}$/, { message: 'Código POS debe tener entre 6 y 12 dígitos.' })
  codigoAutorizacion?: string;
}
