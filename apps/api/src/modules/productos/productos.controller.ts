import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RolUsuario } from '@profutbol/shared-types';
import { ProductosService } from './productos.service';
import { CrearProductoDto, ActualizarProductoDto } from './dto/producto.dto';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('productos')
@ApiBearerAuth()
@Controller('productos')
export class ProductosController {
  constructor(private readonly productosService: ProductosService) {}

  @Roles(RolUsuario.ADMIN, RolUsuario.RECEPCION)
  @Get()
  listar(@Query('activo') activo?: string) {
    return this.productosService.listar(activo === 'true');
  }

  @Roles(RolUsuario.ADMIN)
  @Post()
  crear(@Body() dto: CrearProductoDto) {
    return this.productosService.crear(dto);
  }

  @Roles(RolUsuario.ADMIN)
  @Patch(':id')
  actualizar(@Param('id') id: string, @Body() dto: ActualizarProductoDto) {
    return this.productosService.actualizar(id, dto);
  }
}
