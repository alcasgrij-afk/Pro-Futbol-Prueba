import { ApiProperty } from '@nestjs/swagger';
import { TipoReserva } from '@prisma/client';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Matches, Max, Min, MinLength } from 'class-validator';

export class CrearReservaRecurrenteDto {
  @ApiProperty({ example: 'seed-cancha-futbol-5' })
  @IsString()
  canchaId: string;

  @ApiProperty({ example: '5555 1234' })
  @IsString()
  @MinLength(8, { message: 'El telefono no parece valido.' })
  clienteTelefono: string;

  @ApiProperty({ example: 'Academia Pro Futbol' })
  @IsString()
  @MinLength(2)
  clienteNombre: string;

  @ApiProperty({ enum: TipoReserva, example: TipoReserva.ACADEMIA })
  @IsEnum(TipoReserva)
  tipo: TipoReserva;

  @ApiProperty({ example: 1, description: '0=domingo .. 6=sabado' })
  @IsInt()
  @Min(0)
  @Max(6)
  diaSemana: number;

  @ApiProperty({ example: '16:00' })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'horaInicio debe tener formato HH:mm.' })
  horaInicio: string;

  @ApiProperty({ example: '18:00' })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'horaFin debe tener formato HH:mm.' })
  horaFin: string;

  @ApiProperty({ example: '2026-10-13' })
  @IsDateString({}, { message: 'La fecha debe tener formato YYYY-MM-DD.' })
  fechaInicio: string;

  @ApiProperty({ example: '2026-12-31', required: false })
  @IsOptional()
  @IsDateString({}, { message: 'La fecha debe tener formato YYYY-MM-DD.' })
  fechaFin?: string;
}
