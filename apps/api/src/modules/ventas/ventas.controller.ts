import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RolUsuario } from '@profutbol/shared-types';
import { VentasService } from './ventas.service';
import { CrearVentaDto } from './dto/crear-venta.dto';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('ventas')
@ApiBearerAuth()
@Roles(RolUsuario.ADMIN, RolUsuario.RECEPCION)
@Controller('ventas')
export class VentasController {
  constructor(private readonly ventasService: VentasService) {}

  @Post()
  crear(@Body() dto: CrearVentaDto) {
    return this.ventasService.crear(dto);
  }

  @Get()
  listar(@Query('desde') desde?: string, @Query('hasta') hasta?: string) {
    return this.ventasService.listar({ desde, hasta });
  }

  @Get(':id')
  obtener(@Param('id') id: string) {
    return this.ventasService.obtenerPorId(id);
  }

  @Patch(':id/anular')
  anular(@Param('id') id: string) {
    return this.ventasService.anular(id);
  }
}
