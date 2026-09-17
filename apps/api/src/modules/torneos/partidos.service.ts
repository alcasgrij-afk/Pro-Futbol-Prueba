import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { FormatoTorneo } from '@profutbol/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { FixtureService, ResultadoAvanceBracket } from './fixture.service';

export interface CapturarResultadoInput {
  partidoId: string;
  golesLocal?: number;
  golesVisitante?: number;
  penalesGanadorId?: string;
}

@Injectable()
export class PartidosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fixtureService: FixtureService,
  ) {}

  /**
   * Guarda el marcador (y/o ganador por penales) de un partido. Si es de
   * eliminacion directa y con esto la ronda queda completa, avanza el bracket
   * automaticamente (ver FixtureService.generarRondaSiguiente).
   */
  async capturarResultado(input: CapturarResultadoInput) {
    const { partidoId, golesLocal, golesVisitante, penalesGanadorId } = input;
    const partido = await this.prisma.partido.findUnique({ where: { id: partidoId } });
    if (!partido) throw new NotFoundException('Partido no encontrado.');
    if (golesLocal !== undefined && golesLocal < 0) {
      throw new BadRequestException('Los goles no pueden ser negativos.');
    }
    if (golesVisitante !== undefined && golesVisitante < 0) {
      throw new BadRequestException('Los goles no pueden ser negativos.');
    }
    if (golesLocal === undefined && golesVisitante === undefined && penalesGanadorId === undefined) {
      throw new BadRequestException('Sin datos para guardar: envia goles y/o ganador por penales.');
    }
    if (penalesGanadorId !== undefined && penalesGanadorId !== partido.localId && penalesGanadorId !== partido.visitanteId) {
      throw new BadRequestException('El ganador por penales debe ser local o visitante del partido.');
    }

    const guardado = await this.prisma.partido.update({
      where: { id: partido.id },
      data: {
        ...(golesLocal !== undefined && { golesLocal }),
        ...(golesVisitante !== undefined && { golesVisitante }),
        ...(penalesGanadorId !== undefined && { penalesGanadorId }),
      },
    });

    // Avance automatico del bracket de eliminacion directa. Nunca falla el
    // request si quedan penales por definir: el marcador SI se guardo y la UI
    // apunta al partido (bracket.penalesPendientesEn) para completarlo.
    const torneo = await this.prisma.torneo.findUnique({ where: { id: partido.torneoId } });
    const bracket: ResultadoAvanceBracket =
      torneo?.formato === FormatoTorneo.ELIMINACION_DIRECTA
        ? await this.fixtureService.generarRondaSiguiente(partido.torneoId)
        : { tipo: 'sin_cambios' };

    return { partido: guardado, bracket };
  }
}