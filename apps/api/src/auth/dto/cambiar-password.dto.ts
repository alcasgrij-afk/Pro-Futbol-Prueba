import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class CambiarPasswordDto {
  @ApiProperty({ example: 'CambiarEsta123!' })
  @IsString()
  passwordActual: string;

  @ApiProperty({ example: 'MiNuevaContrasenaSegura456!' })
  @IsString()
  @MinLength(8, { message: 'La contrasena nueva debe tener al menos 8 caracteres.' })
  passwordNuevo: string;
}
