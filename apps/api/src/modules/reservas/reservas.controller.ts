import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { EstadoReserva, RolUsuario } from '@prisma/client';
import { ReservasService } from './reservas.service';
import { CrearReservaDto } from './dto/crear-reserva.dto';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { minutosAHora } from '../canchas/disponibilidad.util';

@ApiTags('reservas')
@Controller('reservas')
export class ReservasController {
  constructor(private readonly reservasService: ReservasService) {}

  // La entidad guarda el horario en minutos; el contrato ReservaDTO expone
  // horaInicio/horaFin como "HH:MM". aDTO alinea la respuesta con el contrato
  // (conserva los minutos tambien por compatibilidad).
  private aDTO(r: any) {
    if (!r) return r;
    return {
      ...r,
      horaInicio: minutosAHora(Number(r.horaInicioMin)),
      horaFin: minutosAHora(Number(r.horaFinMin)),
    };
  }

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
    return this.reservasService.obtenerPorId(id).then((r) => this.aDTO(r));
  }

  @ApiBearerAuth()
  @Roles(RolUsuario.ADMIN, RolUsuario.RECEPCION)
  @Get()
  async listar(@Query('fecha') fecha?: string, @Query('estado') estado?: EstadoReserva) {
    const rs = await this.reservasService.listar({ fecha, estado });
    return rs.map((r) => this.aDTO(r));
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
