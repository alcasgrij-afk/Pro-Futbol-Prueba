import { ApiProperty } from '@nestjs/swagger';
import { FormaPago, TipoReserva } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class CrearReservaDto {
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

  @ApiProperty({ enum: FormaPago, example: FormaPago.ANTICIPADO_EN_LINEA })
  @IsEnum(FormaPago)
  formaPago: FormaPago;

  // Solo honrado por el endpoint de staff /reservas/bloqueo; el endpoint
  // publico /reservas siempre fuerza NORMAL (ver ReservasController.crear).
  @ApiProperty({ enum: TipoReserva, example: TipoReserva.NORMAL, required: false })
  @IsOptional()
  @IsEnum(TipoReserva)
  tipo?: TipoReserva;

  // Fin explicito del bloque (multi-hora), solo para tipo ESPECIAL/ACADEMIA.
  @ApiProperty({ example: '20:00', required: false })
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'horaFin debe tener formato HH:mm.' })
  horaFin?: string;
}
