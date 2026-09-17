import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RolUsuario } from '@prisma/client';
import { TorneosService } from './torneos.service';
import { EquiposService } from './equipos.service';
import { FixtureService } from './fixture.service';
import { PartidosService } from './partidos.service';
import { PosicionesService } from './posiciones.service';
import { CrearTorneoDto } from './dto/crear-torneo.dto';
import { InscribirEquipoDto } from './dto/inscribir-equipo.dto';
import { CapturarResultadoDto } from './dto/capturar-resultado.dto';
import { CambiarEstadoDto } from './dto/cambiar-estado.dto';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('torneos')
@Controller('torneos')
export class TorneosController {
  constructor(
    private readonly torneosService: TorneosService,
    private readonly equiposService: EquiposService,
    private readonly fixtureService: FixtureService,
    private readonly partidosService: PartidosService,
    private readonly posicionesService: PosicionesService,
  ) {}

  // ---- Publico (sitio web) ----

  @Public()
  @Get()
  listar() {
    return this.torneosService.listarTorneos();
  }

  @Public()
  @Get(':id')
  async detalle(@Param('id') id: string) {
    const [torneo, equipos, tabla] = await Promise.all([
      this.torneosService.obtenerTorneo(id),
      this.equiposService.listarDeTorneo(id),
      this.posicionesService.calcularTabla(id),
    ]);
    return { ...torneo, equipos, tabla };
  }

  @Public()
  @Get(':id/equipos')
  listarEquipos(@Param('id') id: string) {
    return this.equiposService.listarDeTorneo(id);
  }

  @Public()
  @Post(':id/equipos')
  inscribir(@Param('id') id: string, @Body() dto: InscribirEquipoDto) {
    return this.equiposService.inscribir({
      torneoId: id,
      nombre: dto.nombre,
      capitanNombre: dto.capitanNombre,
      capitanTelefono: dto.capitanTelefono,
      jugadores: dto.jugadores,
    });
  }

  // ---- Admin ----

  @ApiBearerAuth()
  @Roles(RolUsuario.ADMIN)
  @Post()
  crear(@Body() dto: CrearTorneoDto) {
    return this.torneosService.crearTorneo(dto);
  }

  @ApiBearerAuth()
  @Roles(RolUsuario.ADMIN)
  @Post(':id/fixture')
  generarFixture(@Param('id') id: string) {
    return this.fixtureService.generarFixture(id);
  }

  @ApiBearerAuth()
  @Roles(RolUsuario.ADMIN)
  @Patch(':id/resultados')
  capturarResultado(@Body() dto: CapturarResultadoDto) {
    return this.partidosService.capturarResultado({
      partidoId: dto.partidoId,
      golesLocal: dto.golesLocal,
      golesVisitante: dto.golesVisitante,
      penalesGanadorId: dto.penalesGanadorId,
    });
  }

  @ApiBearerAuth()
  @Roles(RolUsuario.ADMIN)
  @Patch(':id/estado')
  cambiarEstado(@Param('id') id: string, @Body() dto: CambiarEstadoDto) {
    return this.torneosService.cambiarEstado(id, dto.estado);
  }
}
