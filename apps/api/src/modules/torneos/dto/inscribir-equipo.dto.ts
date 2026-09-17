import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, MaxLength } from 'class-validator';

export class InscribirEquipoDto {
  @ApiProperty({ example: 'Los Canarios' })
  @IsString()
  @MaxLength(80)
  nombre: string;

  @ApiPropertyOptional({ example: 'Juan Perez' })
  @IsString()
  @IsOptional()
  @MaxLength(80)
  capitanNombre?: string;

  @ApiPropertyOptional({ example: '5555-1234' })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  capitanTelefono?: string;

  @ApiPropertyOptional({ example: ['Juan', 'Pedro'], description: 'Lista de jugadores' })
  @IsArray()
  @IsOptional()
  jugadores?: string[];
}
