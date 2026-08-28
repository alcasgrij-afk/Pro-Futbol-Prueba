import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'admin@profutbolantigua.com' })
  @IsEmail({}, { message: 'El correo no es valido.' })
  email: string;

  @ApiProperty({ example: 'CambiarEsta123!' })
  @IsString()
  @MinLength(8, { message: 'La contrasena debe tener al menos 8 caracteres.' })
  password: string;
}
