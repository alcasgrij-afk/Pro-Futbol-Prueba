import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FormatoTorneo, PosicionDTO } from '@profutbol/shared-types';

/**
 * Tabla de posiciones de un torneo "todos contra todos" (LIGA).
 * 3 pts por victoria, 1 por empate, 0 por derrota. Desempate por diferencia
 * de gol y luego goles a favor. Para ELIMINACION_DIRECTA devuelve [] (la vista
 * publica no muestra tabla en ese formato).
 */
@Injectable()
export class PosicionesService {
  constructor(private readonly prisma: PrismaService) {}

  async calcularTabla(torneoId: string): Promise<PosicionDTO[]> {
    const torneo = await this.prisma.torneo.findUnique({
      where: { id: torneoId },
      include: {
        equipos: true,
        partidos: { where: { golesLocal: { not: null } } },
      },
    });
    if (!torneo) throw new NotFoundException('Torneo no encontrado.');
    if (torneo.formato !== FormatoTorneo.LIGA) return [];

    const filas = new Map<
      string,
      { equipoId: string; nombre: string; jugados: number; ganados: number; empatados: number; perdidos: number; gf: number; gc: number; dif: number; puntos: number }
    >();
    torneo.equipos.forEach((e) =>
      filas.set(e.id, {
        equipoId: e.id,
        nombre: e.nombre,
        jugados: 0,
        ganados: 0,
        empatados: 0,
        perdidos: 0,
        gf: 0,
        gc: 0,
        dif: 0,
        puntos: 0,
      }),
    );

    for (const p of torneo.partidos) {
      const gl = p.golesLocal ?? 0;
      const gv = p.golesVisitante ?? 0;
      const local = p.localId ? filas.get(p.localId) : undefined;
      const vis = p.visitanteId ? filas.get(p.visitanteId) : undefined;

      if (local) {
        local.jugados++;
        local.gf += gl;
        local.gc += gv;
      }
      if (vis) {
        vis.jugados++;
        vis.gf += gv;
        vis.gc += gl;
      }

      if (gl > gv) {
        if (local) local.ganados++;
        if (vis) vis.perdidos++;
      } else if (gl < gv) {
        if (vis) vis.ganados++;
        if (local) local.perdidos++;
      } else {
        if (local) local.empatados++;
        if (vis) vis.empatados++;
      }
    }

    const lista = [...filas.values()];
    lista.forEach((f) => {
      f.dif = f.gf - f.gc;
      f.puntos = f.ganados * 3 + f.empatados;
    });
    lista.sort((a, b) => b.puntos - a.puntos || b.dif - a.dif || b.gf - a.gf);
    return lista;
  }
}
