import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class SuperadminLoginDto {
  @ApiProperty({ example: 'CambiarEsta123!' })
  @IsString()
  @MinLength(1, { message: 'La contrasena es requerida.' })
  password: string;
}
