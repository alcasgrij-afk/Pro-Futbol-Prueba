import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RolUsuario } from '@prisma/client';
import { ClientesService } from './clientes.service';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('clientes')
@Controller('clientes')
export class ClientesController {
  constructor(private readonly clientesService: ClientesService) {}

  // Caja: busca por telefono y devuelve el estado de Cliente Valorado (VIP)
  // para mostrar el badge de "siguiente reserva gratis".
  @ApiBearerAuth()
  @Roles(RolUsuario.ADMIN, RolUsuario.RECEPCION)
  @Get('buscar')
  buscar(@Query('telefono') telefono?: string) {
    if (!telefono) throw new BadRequestException('telefono es requerido.');
    return this.clientesService.buscarConEstadoValorado(telefono);
  }
}
