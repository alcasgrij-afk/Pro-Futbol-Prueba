import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProductoCategoria } from '@profutbol/shared-types';
import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CrearProductoDto {
  @ApiProperty({ example: 'Camiseta Academia' })
  @IsString()
  @MinLength(2)
  nombre: string;

  @ApiProperty({ enum: ProductoCategoria, example: ProductoCategoria.TIENDA })
  @IsEnum(ProductoCategoria)
  categoria: ProductoCategoria;

  @ApiProperty({ example: 75 })
  @IsNumber()
  @Min(0)
  precioQ: number;
}

export class ActualizarProductoDto {
  @ApiPropertyOptional({ example: 'Camiseta Academia' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  nombre?: string;

  @ApiPropertyOptional({ example: 80 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  precioQ?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
