import { ApiProperty } from '@nestjs/swagger';
import { GatewayPago } from '@profutbol/shared-types';
import { IsBoolean, IsDateString, IsIn, IsOptional, IsString, Matches, MinLength, ValidateIf } from 'class-validator';

export class CobrarSedeDto {
  @ApiProperty({ example: 'seed-cancha-futbol-5' })
  @IsString()
  canchaId: string;

  @ApiProperty({ example: '+502 5555 1234' })
  @IsString()
  @MinLength(8, { message: 'El telefono no parece valido.' })
  clienteTelefono: string;

  @ApiProperty({ example: 'Juan Perez' })
  @IsString()
  @MinLength(2)
  clienteNombre: string;

  @ApiProperty({ example: '2026-07-20' })
  @IsDateString({}, { message: 'La fecha debe tener formato YYYY-MM-DD.' })
  fecha: string;

  @ApiProperty({ example: '18:00' })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'horaInicio debe tener formato HH:mm.' })
  horaInicio: string;

  @ApiProperty({ example: GatewayPago.EFECTIVO, enum: [GatewayPago.EFECTIVO, GatewayPago.TARJETA] })
  @IsIn([GatewayPago.EFECTIVO, GatewayPago.TARJETA], { message: 'metodoPago debe ser EFECTIVO o TARJETA.' })
  metodoPago: GatewayPago.EFECTIVO | GatewayPago.TARJETA;

  @ApiProperty({ example: '123456', required: false })
  @ValidateIf((o) => o.metodoPago === GatewayPago.TARJETA)
  @Matches(/^\d{6,12}$/, { message: 'Código POS debe tener entre 6 y 12 dígitos.' })
  codigoAutorizacion?: string;

  // Beneficio de Cliente Valorado (VIP): staff marca la reserva como gratis
  // (6ta reserva del ciclo). Ver ClientesService.buscarConEstadoValorado.
  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  gratis?: boolean;
}
