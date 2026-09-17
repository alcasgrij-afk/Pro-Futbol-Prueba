import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsString } from 'class-validator';

export class MarcarAsistenciaDto {
  @ApiProperty({ example: 'alumno-uuid' })
  @IsString()
  alumnoId: string;

  @ApiProperty({ example: '2026-07-30' })
  @IsDateString()
  fecha: string;

  @ApiProperty({ example: true })
  @IsBoolean()
  presente: boolean;
}
