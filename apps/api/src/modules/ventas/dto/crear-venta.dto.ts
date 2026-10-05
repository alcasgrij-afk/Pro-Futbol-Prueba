import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

export class VentaItemInputDto {
  @ApiProperty({ example: 'uuid-del-producto' })
  @IsString()
  productoId: string;

  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(1)
  cantidad: number;
}

export class CrearVentaDto {
  @ApiPropertyOptional({ example: '+502 5555 1234' })
  @IsOptional()
  @IsString()
  clienteTelefono?: string;

  @ApiPropertyOptional({ example: 'Juan Perez' })
  @IsOptional()
  @IsString()
  clienteNombre?: string;

  @ApiProperty({ type: [VentaItemInputDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => VentaItemInputDto)
  items: VentaItemInputDto[];

  @ApiPropertyOptional({ example: 'Pago con billete de Q500' })
  @IsOptional()
  @IsString()
  notas?: string;
}
