import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RolUsuario } from '@profutbol/shared-types';
import { GastosService } from './gastos.service';
import { CrearGastoDto } from './dto/crear-gasto.dto';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('gastos')
@ApiBearerAuth()
@Roles(RolUsuario.ADMIN, RolUsuario.RECEPCION)
@Controller('gastos')
export class GastosController {
  constructor(private readonly gastosService: GastosService) {}

  @Post()
  crear(@Body() dto: CrearGastoDto) {
    return this.gastosService.crear(dto);
  }

  @Get()
  listar(@Query('desde') desde?: string, @Query('hasta') hasta?: string) {
    return this.gastosService.listar({ desde, hasta });
  }

  @Get('resumen')
  resumen(@Query('desde') desde: string, @Query('hasta') hasta: string) {
    return this.gastosService.resumen(desde, hasta);
  }

  @Roles(RolUsuario.ADMIN)
  @Delete(':id')
  eliminar(@Param('id') id: string) {
    return this.gastosService.eliminar(id);
  }
}
