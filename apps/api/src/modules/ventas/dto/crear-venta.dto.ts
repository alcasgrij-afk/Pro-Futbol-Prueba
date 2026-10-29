import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GatewayPago } from '@profutbol/shared-types';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsIn, IsInt, IsOptional, IsString, Matches, Min, ValidateIf, ValidateNested } from 'class-validator';

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

  @ApiPropertyOptional({ example: GatewayPago.EFECTIVO, enum: [GatewayPago.EFECTIVO, GatewayPago.TARJETA] })
  @IsOptional()
  @IsIn([GatewayPago.EFECTIVO, GatewayPago.TARJETA], { message: 'metodoPago debe ser EFECTIVO o TARJETA.' })
  metodoPago?: GatewayPago.EFECTIVO | GatewayPago.TARJETA;

  @ApiPropertyOptional({ example: '123456' })
  @ValidateIf((o) => o.metodoPago === GatewayPago.TARJETA)
  @Matches(/^\d{6,12}$/, { message: 'Código POS debe tener entre 6 y 12 dígitos.' })
  codigoAutorizacion?: string;
}
