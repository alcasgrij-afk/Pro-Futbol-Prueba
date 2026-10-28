import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class ActualizarClienteDto {
  @ApiPropertyOptional({ example: 'Juan Perez' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  nombre?: string;

  @ApiPropertyOptional({ example: '+502 5555 1234' })
  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'El telefono no parece valido.' })
  telefono?: string;

  @ApiPropertyOptional({ example: 'juan@example.com' })
  @IsOptional()
  @IsEmail({}, { message: 'El email no parece valido.' })
  email?: string;

  @ApiPropertyOptional({ example: '1234567890101' })
  @IsOptional()
  @Matches(/^\d{13}$/, { message: 'El DPI debe tener 13 digitos.' })
  dpi?: string;
}
