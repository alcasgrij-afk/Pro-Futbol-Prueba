import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, MinLength } from 'class-validator';

export class ActualizarAlumnoDto {
  @ApiProperty({ example: 'Mateo Andres', required: false })
  @IsOptional()
  @IsString()
  @MinLength(2)
  nombres?: string;

  @ApiProperty({ example: 'Garcia Lopez', required: false })
  @IsOptional()
  @IsString()
  @MinLength(2)
  apellidos?: string;

  @ApiProperty({ example: '2016-04-12', required: false })
  @IsOptional()
  @IsDateString()
  fechaNacimiento?: string;

  @ApiProperty({ example: 'Sub-10', required: false })
  @IsOptional()
  @IsString()
  categoria?: string;

  @ApiProperty({ example: 'Ana Garcia', required: false })
  @IsOptional()
  @IsString()
  @MinLength(2)
  encargadoNombre?: string;

  @ApiProperty({ example: '+502 5555 1234', required: false })
  @IsOptional()
  @IsString()
  @MinLength(8)
  encargadoTelefono?: string;
}
