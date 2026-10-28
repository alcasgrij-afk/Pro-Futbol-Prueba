import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class CrearArbitroDto {
  @ApiProperty({ example: 'Carlos Ramirez' })
  @IsString()
  @MinLength(2)
  nombre: string;

  @ApiPropertyOptional({ example: '55551234' })
  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'El telefono no parece valido.' })
  telefono?: string;
}

export class ActualizarArbitroDto {
  @ApiPropertyOptional({ example: 'Carlos Ramirez' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  nombre?: string;

  @ApiPropertyOptional({ example: '55551234' })
  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'El telefono no parece valido.' })
  telefono?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
