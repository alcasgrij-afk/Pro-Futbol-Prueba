import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { EstadoReserva, RolUsuario, TipoReserva } from '@prisma/client';
import { ReservasService } from './reservas.service';
import { CrearReservaDto } from './dto/crear-reserva.dto';
import { CrearReservaRecurrenteDto } from './dto/crear-reserva-recurrente.dto';
import { ReprogramarReservaDto } from './dto/reprogramar-reserva.dto';
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
  // Fuerza tipo=NORMAL e ignora horaFin: un cliente publico nunca puede crear
  // un bloqueo (Especial/Academia) ni estirar la duracion pagando un solo
  // bloque. Eso solo vive en /reservas/bloqueo, protegido por rol de staff.
  @Public()
  @Post()
  crear(@Body() dto: CrearReservaDto) {
    return this.reservasService.crearReserva({ ...dto, tipo: TipoReserva.NORMAL, horaFin: undefined });
  }

  // Staff: crea un bloqueo de horario puntual (Reserva Especial/Academia),
  // confirmado de una vez y sin cobro. Ver ReservasService.crearReserva.
  @ApiBearerAuth()
  @Roles(RolUsuario.ADMIN, RolUsuario.RECEPCION)
  @Post('bloqueo')
  crearBloqueo(@Body() dto: CrearReservaDto) {
    if (!dto.tipo || dto.tipo === TipoReserva.NORMAL) {
      throw new BadRequestException('tipo debe ser ESPECIAL o ACADEMIA.');
    }
    return this.reservasService.crearReserva(dto);
  }

  // Staff: crea una regla de reserva recurrente semanal (academia o cliente
  // especial) y materializa de una vez sus proximas ocurrencias.
  @ApiBearerAuth()
  @Roles(RolUsuario.ADMIN, RolUsuario.RECEPCION)
  @Post('recurrentes')
  crearRecurrente(@Body() dto: CrearReservaRecurrenteDto) {
    return this.reservasService.crearReservaRecurrente(dto);
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

  // Modulo de Caja: reagenda cancha/fecha/hora de una reserva existente
  // (right-click "Modificar" en la grilla).
  @ApiBearerAuth()
  @Roles(RolUsuario.ADMIN, RolUsuario.RECEPCION)
  @Patch(':id')
  async reprogramar(@Param('id') id: string, @Body() dto: ReprogramarReservaDto) {
    return this.aDTO(await this.reservasService.reprogramar(id, dto));
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
