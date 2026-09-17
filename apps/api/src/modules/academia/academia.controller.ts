import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RolUsuario } from '@profutbol/shared-types';
import { AlumnosService } from './alumnos.service';
import { MensualidadesService } from './mensualidades.service';
import { CrearAlumnoDto } from './dto/crear-alumno.dto';
import { Roles } from '../../common/decorators/roles.decorator';

// Todo el modulo de academia es interno (a diferencia de reservas/torneos,
// no hay auto-registro publico de alumnos: la inscripcion la gestiona el
// personal).
@ApiTags('academia')
@ApiBearerAuth()
@Roles(RolUsuario.ADMIN, RolUsuario.RECEPCION, RolUsuario.ENTRENADOR)
@Controller('academia')
export class AcademiaController {
  constructor(
    private readonly alumnosService: AlumnosService,
    private readonly mensualidadesService: MensualidadesService,
  ) {}

  @Roles(RolUsuario.ADMIN, RolUsuario.RECEPCION)
  @Post('alumnos')
  crearAlumno(@Body() dto: CrearAlumnoDto) {
    return this.alumnosService.crear(dto);
  }

  @Get('alumnos')
  listarAlumnos(@Query('categoria') categoria?: string, @Query('activo') activo?: string) {
    return this.alumnosService.listar({
      categoria,
      activo: activo === undefined ? undefined : activo === 'true',
    });
  }

  @Get('alumnos/:id')
  obtenerAlumno(@Param('id') id: string) {
    return this.alumnosService.obtenerPorId(id);
  }

  @Roles(RolUsuario.ADMIN, RolUsuario.RECEPCION)
  @Patch('alumnos/:id/desactivar')
  desactivarAlumno(@Param('id') id: string) {
    return this.alumnosService.desactivar(id);
  }

  @Get('mensualidades')
  listarMensualidadesDelMes(@Query('mes') mes: string, @Query('anio') anio: string) {
    return this.mensualidadesService.listarDelMes(Number(mes), Number(anio));
  }

  @Get('alumnos/:id/mensualidades')
  listarMensualidadesDeAlumno(@Param('id') alumnoId: string) {
    return this.mensualidadesService.listarPorAlumno(alumnoId);
  }
}
