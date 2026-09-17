import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RolUsuario } from '@profutbol/shared-types';
import { AsistenciaService } from './asistencia.service';
import { MarcarAsistenciaDto } from './dto/marcar-asistencia.dto';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('academia')
@ApiBearerAuth()
@Roles(RolUsuario.ADMIN, RolUsuario.RECEPCION, RolUsuario.ENTRENADOR)
@Controller('asistencia')
export class AsistenciaController {
  constructor(private readonly asistenciaService: AsistenciaService) {}

  @Post()
  marcar(@Body() dto: MarcarAsistenciaDto) {
    return this.asistenciaService.marcar(dto);
  }

  @Get()
  listarPorFecha(@Query('fecha') fecha: string) {
    return this.asistenciaService.listarPorFecha(fecha);
  }

  @Get('alumnos/:id')
  listarPorAlumno(@Param('id') alumnoId: string) {
    return this.asistenciaService.listarPorAlumno(alumnoId);
  }
}
