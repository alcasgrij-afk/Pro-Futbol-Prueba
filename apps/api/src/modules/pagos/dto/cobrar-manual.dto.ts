import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GatewayPago, TipoPagoReferencia } from '@profutbol/shared-types';
import { IsIn, IsNumber, IsOptional, IsPositive, IsString, Matches, MaxLength, ValidateIf } from 'class-validator';

/**
 * Cobro manual en sede (/admin/pagos). Solo arbitraje y conceptos del catalogo:
 * las reservas se cobran unicamente desde Caja y las mensualidades por el
 * endpoint de academia (que las ata al alumno).
 */
export class CobrarManualDto {
  @ApiProperty({ enum: [TipoPagoReferencia.ARBITRO, TipoPagoReferencia.MANUAL] })
  @IsIn([TipoPagoReferencia.ARBITRO, TipoPagoReferencia.MANUAL], {
    message: 'tipo debe ser ARBITRO o MANUAL.',
  })
  tipo: TipoPagoReferencia.ARBITRO | TipoPagoReferencia.MANUAL;

  @ApiProperty({ description: 'Id del Arbitro (tipo=ARBITRO) o del ConceptoPago (tipo=MANUAL).' })
  @IsString()
  referenciaId: string;

  @ApiProperty({ example: 150 })
  @IsNumber()
  @IsPositive({ message: 'El monto debe ser mayor a 0.' })
  montoQ: number;

  @ApiProperty({ example: GatewayPago.EFECTIVO, enum: [GatewayPago.EFECTIVO, GatewayPago.TARJETA] })
  @IsIn([GatewayPago.EFECTIVO, GatewayPago.TARJETA], { message: 'metodoPago debe ser EFECTIVO o TARJETA.' })
  metodoPago: GatewayPago.EFECTIVO | GatewayPago.TARJETA;

  @ApiPropertyOptional({ example: '123456' })
  @ValidateIf((o) => o.metodoPago === GatewayPago.TARJETA)
  @Matches(/^\d{6,12}$/, { message: 'Código POS debe tener entre 6 y 12 dígitos.' })
  codigoAutorizacion?: string;

  @ApiPropertyOptional({ example: 'Partido F7 18:00 — liga interna' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  nota?: string;
}
