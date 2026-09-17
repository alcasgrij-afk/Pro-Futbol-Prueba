import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MarcarAsistenciaDto } from './dto/marcar-asistencia.dto';

@Injectable()
export class AsistenciaService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Marca (o corrige) la asistencia de un alumno en una fecha dada.
   * Si el entrenador se equivoca y vuelve a marcar el mismo alumno el
   * mismo dia, se actualiza el registro existente en vez de duplicarlo
   * (indice unico alumnoId+fecha, ver schema.prisma).
   */
  async marcar(dto: MarcarAsistenciaDto) {
    return this.prisma.asistencia.upsert({
      where: { alumnoId_fecha: { alumnoId: dto.alumnoId, fecha: new Date(dto.fecha) } },
      update: { presente: dto.presente },
      create: { alumnoId: dto.alumnoId, fecha: new Date(dto.fecha), presente: dto.presente },
    });
  }

  async listarPorFecha(fecha: string) {
    return this.prisma.asistencia.findMany({
      where: { fecha: new Date(fecha) },
      include: { alumno: true },
    });
  }

  async listarPorAlumno(alumnoId: string) {
    return this.prisma.asistencia.findMany({
      where: { alumnoId },
      orderBy: { fecha: 'desc' },
    });
  }
}
