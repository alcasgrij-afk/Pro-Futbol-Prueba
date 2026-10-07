import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, MinLength } from 'class-validator';

export class CrearAlumnoDto {
  @ApiProperty({ example: 'Mateo Andres' })
  @IsString()
  @MinLength(2)
  nombres: string;

  @ApiProperty({ example: 'Garcia Lopez' })
  @IsString()
  @MinLength(2)
  apellidos: string;

  @ApiProperty({ example: '2016-04-12' })
  @IsDateString()
  fechaNacimiento: string;

  @ApiProperty({ example: 'Sub-10', required: false, description: 'Si se omite, se sugiere automaticamente por edad.' })
  @IsOptional()
  @IsString()
  categoria?: string;

  @ApiProperty({ example: 'Ana Garcia' })
  @IsString()
  @MinLength(2)
  encargadoNombre: string;

  @ApiProperty({ example: '+502 5555 1234' })
  @IsString()
  @MinLength(8)
  encargadoTelefono: string;
}
