import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RolUsuario } from '@prisma/client';
import { ClientesService } from './clientes.service';
import { ActualizarClienteDto } from './dto/actualizar-cliente.dto';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('clientes')
@ApiBearerAuth()
@Controller('clientes')
export class ClientesController {
  constructor(private readonly clientesService: ClientesService) {}

  // Caja: busca por telefono y devuelve el estado de Cliente Valorado (VIP)
  // para mostrar el badge de "siguiente reserva gratis". No tocar la forma
  // de esta respuesta: Caja depende de ella tal cual.
  @Roles(RolUsuario.ADMIN, RolUsuario.RECEPCION)
  @Get('buscar')
  buscar(@Query('telefono') telefono?: string) {
    if (!telefono) throw new BadRequestException('telefono es requerido.');
    return this.clientesService.buscarConEstadoValorado(telefono);
  }

  // /admin/clientes: lista con buscador (nombre o telefono) y filtro de activos.
  @Roles(RolUsuario.ADMIN, RolUsuario.RECEPCION)
  @Get()
  listar(@Query('q') q?: string, @Query('activo') activo?: string) {
    return this.clientesService.listar({ q, activo: activo === undefined ? undefined : activo === 'true' });
  }

  @Roles(RolUsuario.ADMIN, RolUsuario.RECEPCION)
  @Get(':id')
  obtener(@Param('id') id: string) {
    return this.clientesService.obtenerPorId(id);
  }

  @Roles(RolUsuario.ADMIN, RolUsuario.RECEPCION)
  @Patch(':id')
  actualizar(@Param('id') id: string, @Body() dto: ActualizarClienteDto) {
    return this.clientesService.actualizar(id, dto);
  }

  @Roles(RolUsuario.ADMIN)
  @Patch(':id/desactivar')
  desactivar(@Param('id') id: string) {
    return this.clientesService.desactivar(id);
  }

  @Roles(RolUsuario.ADMIN)
  @Patch(':id/activar')
  activar(@Param('id') id: string) {
    return this.clientesService.activar(id);
  }

  // Otorga/quita manualmente el estatus de Cliente Valorado (promo "6ta
  // reserva gratis"). Hoy no existe ningun otro lugar en el sistema que
  // cree este registro.
  @Roles(RolUsuario.ADMIN)
  @Patch(':id/valorado')
  otorgarValorado(@Param('id') id: string) {
    return this.clientesService.otorgarValorado(id);
  }

  @Roles(RolUsuario.ADMIN)
  @Delete(':id/valorado')
  quitarValorado(@Param('id') id: string) {
    return this.clientesService.quitarValorado(id);
  }
}
