import { ApiProperty } from '@nestjs/swagger';
import { FormaPago } from '@prisma/client';
import { IsDateString, IsEnum, IsString, Matches, MinLength } from 'class-validator';

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
}
