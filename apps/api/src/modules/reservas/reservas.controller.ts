import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { EstadoReserva, RolUsuario } from '@prisma/client';
import { ReservasService } from './reservas.service';
import { CrearReservaDto } from './dto/crear-reserva.dto';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('reservas')
@Controller('reservas')
export class ReservasController {
  constructor(private readonly reservasService: ReservasService) {}

  // Publico: usado por el sitio web (el bot llama al service directamente).
  @Public()
  @Post()
  crear(@Body() dto: CrearReservaDto) {
    return this.reservasService.crearReserva(dto);
  }

  // Publico: pantalla de "resumen antes de pagar" / confirmacion.
  @Public()
  @Get(':id')
  obtener(@Param('id') id: string) {
    return this.reservasService.obtenerPorId(id);
  }

  @ApiBearerAuth()
  @Roles(RolUsuario.ADMIN, RolUsuario.RECEPCION)
  @Get()
  listar(@Query('fecha') fecha?: string, @Query('estado') estado?: EstadoReserva) {
    return this.reservasService.listar({ fecha, estado });
  }

  @ApiBearerAuth()
  @Roles(RolUsuario.ADMIN, RolUsuario.RECEPCION)
  @Patch(':id/confirmar')
  confirmar(@Param('id') id: string) {
    return this.reservasService.confirmar(id);
  }

  @ApiBearerAuth()
  @Roles(RolUsuario.ADMIN, RolUsuario.RECEPCION)
  @Patch(':id/cancelar')
  cancelar(@Param('id') id: string) {
    return this.reservasService.cancelar(id);
  }
}
