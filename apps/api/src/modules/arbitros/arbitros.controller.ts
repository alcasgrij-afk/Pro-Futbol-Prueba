import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RolUsuario } from '@profutbol/shared-types';
import { ArbitrosService } from './arbitros.service';
import { ActualizarArbitroDto, CrearArbitroDto } from './dto/arbitro.dto';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('arbitros')
@ApiBearerAuth()
@Controller('arbitros')
export class ArbitrosController {
  constructor(private readonly arbitrosService: ArbitrosService) {}

  @Roles(RolUsuario.ADMIN, RolUsuario.RECEPCION)
  @Get()
  listar(@Query('activo') activo?: string) {
    return this.arbitrosService.listar(activo === 'true');
  }

  // Recepcion tambien puede darlo de alta: al cobrar un arbitraje en el
  // momento, no se puede depender de que un admin cree el registro primero.
  @Roles(RolUsuario.ADMIN, RolUsuario.RECEPCION)
  @Post()
  crear(@Body() dto: CrearArbitroDto) {
    return this.arbitrosService.crear(dto);
  }

  @Roles(RolUsuario.ADMIN)
  @Patch(':id')
  actualizar(@Param('id') id: string, @Body() dto: ActualizarArbitroDto) {
    return this.arbitrosService.actualizar(id, dto);
  }
}
