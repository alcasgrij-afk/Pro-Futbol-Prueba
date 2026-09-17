import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EstadoTorneo, TorneoDTO } from '@profutbol/shared-types';

@Injectable()
export class TorneosService {
  constructor(private readonly prisma: PrismaService) {}

  private aDTO(t: any, equiposInscritos: number): TorneoDTO {
    return {
      id: t.id,
      nombre: t.nombre,
      descripcion: t.descripcion,
      formato: t.formato,
      categoria: t.categoria,
      maxEquipos: t.maxEquipos,
      cuotaInscripcionQ: Number(t.cuotaInscripcionQ),
      fechaInicio: t.fechaInicio?.toISOString().slice(0, 10) ?? null,
      fechaLimiteInscripcion: t.fechaLimiteInscripcion?.toISOString().slice(0, 10) ?? null,
      estado: t.estado,
      equiposInscritos,
      creadoEn: t.creadoEn.toISOString(),
    };
  }

  async crearTorneo(dto: {
    nombre: string;
    descripcion?: string;
    formato: 'LIGA' | 'ELIMINACION_DIRECTA';
    categoria?: string;
    maxEquipos?: number;
    cuotaInscripcionQ?: number;
    fechaLimiteInscripcion?: string;
  }) {
    const torneo = await this.prisma.torneo.create({
      data: {
        nombre: dto.nombre,
        descripcion: dto.descripcion,
        formato: dto.formato,
        categoria: dto.categoria,
        maxEquipos: dto.maxEquipos ?? 16,
        cuotaInscripcionQ: dto.cuotaInscripcionQ ?? 0,
        fechaLimiteInscripcion: dto.fechaLimiteInscripcion ? new Date(dto.fechaLimiteInscripcion) : undefined,
      },
    });
    return this.aDTO(torneo, 0);
  }

  async listarTorneos() {
    const torneos = await this.prisma.torneo.findMany({
      orderBy: { creadoEn: 'desc' },
      include: { _count: { select: { equipos: true } } },
    });
    return torneos.map((t) => this.aDTO(t, t._count.equipos));
  }

  async obtenerTorneo(id: string) {
    const torneo = await this.prisma.torneo.findUnique({
      where: { id },
      include: {
        equipos: { orderBy: { creadoEn: 'asc' } },
        partidos: {
          orderBy: [{ jornada: 'asc' }, { ronda: 'asc' }, { posicion: 'asc' }],
          include: { local: true, visitante: true, penalesGanador: true },
        },
      },
    });
    if (!torneo) throw new NotFoundException('Torneo no encontrado.');
    return {
      ...this.aDTO(torneo, torneo.equipos.length),
      equipos: torneo.equipos.map((e) => ({
        id: e.id,
        nombre: e.nombre,
        capitanNombre: e.capitanNombre,
        capitanTelefono: e.capitanTelefono,
        cuotaPagada: false, // la pagina compone en vivo desde EquiposService
        creadoEn: e.creadoEn.toISOString(),
      })),
      partidos: torneo.partidos.map((p) => ({
        id: p.id,
        jornada: p.jornada,
        ronda: p.ronda,
        posicion: p.posicion,
        localId: p.localId,
        visitanteId: p.visitanteId,
        localNombre: (p as any).local?.nombre ?? null,
        visitanteNombre: (p as any).visitante?.nombre ?? null,
        golesLocal: p.golesLocal,
        golesVisitante: p.golesVisitante,
        penalesGanadorId: p.penalesGanadorId,
        penalesGanadorNombre: (p as any).penalesGanador?.nombre ?? null,
        jugado: p.golesLocal !== null && p.golesVisitante !== null,
      })),
    };
  }

  async cambiarEstado(id: string, estado: EstadoTorneo) {
    const torneo = await this.prisma.torneo.findUnique({ where: { id } });
    if (!torneo) throw new NotFoundException('Torneo no encontrado.');
    if (torneo.estado === estado) return this.aDTO(torneo, 0);
    if (estado === 'INSCRIPCIONES_ABIERTAS' && torneo.estado === 'EN_CURSO') {
      throw new BadRequestException('No se puede reabrir inscripciones de un torneo en curso.');
    }
    return this.prisma.torneo.update({ where: { id }, data: { estado } }).then((t) => this.aDTO(t, 0));
  }
}