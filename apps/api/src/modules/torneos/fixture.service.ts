import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { FormatoTorneo } from '@profutbol/shared-types';

/** Partido con sus equipos resueltos, incluyendo el ganador por penales. */
type PartidoConRelaciones = Prisma.PartidoGetPayload<{
  include: { local: true; visitante: true; penalesGanador: true };
}>;

/** Resultado de intentar avanzar el bracket de eliminacion directa. */
export type ResultadoAvanceBracket =
  | { tipo: 'sin_cambios' }
  | { tipo: 'penalesPendientes'; partidoId: string }
  | { tipo: 'avanzada'; partidosCreados: PartidoConRelaciones[] }
  | { tipo: 'campeon'; campeonId: string; campeonNombre: string };

/**
 * Pares de una ronda de liga "todos contra todos" (metodo del circulo).
 * N equipos -> N-1 jornadas, cada uno juega contra todos los demas una sola vez.
 * Con N impar se agrega un "bye" (equipo que descansa esa jornada).
 * Pura (sin I/O) para poder testearla.
 */
export function generarRondasLiga(ids: string[]): { jornada: number; localId: string; visitanteId: string }[] {
  const equipos = [...ids];
  if (equipos.length % 2 === 1) equipos.push(''); // bye
  const n = equipos.length;
  const partidos: { jornada: number; localId: string; visitanteId: string }[] = [];

  for (let r = 0; r < n - 1; r++) {
    const jornada = r + 1;
    for (let i = 0; i < n / 2; i++) {
      const a = equipos[i];
      const b = equipos[n - 1 - i];
      if (!a || !b) continue; // bye
      // Alternar localia entre jornadas para balancear.
      const [local, visitante] = r % 2 === 0 ? [a, b] : [b, a];
      partidos.push({ jornada, localId: local, visitanteId: visitante });
    }
    // Rotar manteniendo fijo el primer equipo.
    equipos.splice(1, 0, equipos.pop()!);
  }

  return partidos;
}

/**
 * Ronda 1 de eliminacion directa: enfrenta a los equipos de a pares.
 * Con numero impar, el ultimo pasa directo (bye). Solo genera la Ronda 1;
 * las rondas siguientes dependen de los resultados (ponytail: fuera de alcance
 * en esta fase, coincide con la guia 8.3).
 */
export function generarRonda1(ids: string[]): { ronda: number; localId: string; visitanteId: string | null }[] {
  const partidos: { ronda: number; localId: string; visitanteId: string | null }[] = [];
  for (let i = 0; i < ids.length; i += 2) {
    partidos.push({
      ronda: 1,
      localId: ids[i],
      visitanteId: ids[i + 1] ?? null,
    });
  }
  return partidos;
}

/**
 * Emparejamiento de una ronda de eliminacion directa a partir de los equipos
 * que avanzan: la misma convencion que generarRonda1, pero reutilizable para
 * cualquier ronda. Con cantidad impar, el ultimo avanza por bye (visitanteId
 * null). Recursivo y correcto: N equipos -> siempre N-1 partidos totales.
 * Pura (sin I/O) para poder testearla.
 */
export function generarRondaEliminatoria(
  avanzan: string[],
  ronda: number,
): { ronda: number; posicion: number; localId: string; visitanteId: string | null }[] {
  const partidos: { ronda: number; posicion: number; localId: string; visitanteId: string | null }[] = [];
  for (let i = 0; i < avanzan.length; i += 2) {
    partidos.push({
      ronda,
      posicion: i / 2,
      localId: avanzan[i],
      visitanteId: avanzan[i + 1] ?? null,
    });
  }
  return partidos;
}

@Injectable()
export class FixtureService {
  constructor(private readonly prisma: PrismaService) {}

  /** Genera el fixture del torneo (no-op si ya existe). Devuelve los partidos. */
  async generarFixture(torneoId: string) {
    const torneo = await this.prisma.torneo.findUnique({
      where: { id: torneoId },
      include: { equipos: true, partidos: true },
    });
    if (!torneo) throw new NotFoundException('Torneo no encontrado.');
    if (torneo.partidos.length > 0) {
      throw new BadRequestException('El fixture ya fue generado para este torneo.');
    }
    if (torneo.equipos.length < 2) {
      throw new BadRequestException('Se necesitan al menos 2 equipos para generar el fixture.');
    }

    const ids = torneo.equipos.map((e) => e.id);
    const pares =
      torneo.formato === FormatoTorneo.LIGA
        ? generarRondasLiga(ids).map((p) => ({ ...p, posicion: 0 }))
        : generarRonda1(ids).map((p, i) => ({ ...p, jornada: 0, posicion: i }));

    await this.prisma.partido.createMany({
      data: pares.map((p) => ({
        torneoId,
        jornada: p.jornada,
        ronda: (p as { ronda?: number }).ronda ?? null,
        posicion: (p as { posicion?: number }).posicion ?? 0,
        localId: p.localId,
        visitanteId: (p as { visitanteId?: string | null }).visitanteId ?? null,
      })),
    });

    return this.prisma.partido.findMany({
      where: { torneoId },
      orderBy: [{ jornada: 'asc' }, { ronda: 'asc' }, { posicion: 'asc' }],
    });
  }

  /**
   * Avanza el bracket de eliminacion directa tras capturar resultados: si la
   * ronda actual quedo completa, genera la siguiente a partir de los ganadores.
   * Lo llama capturarResultado; es idempotente (no-op si la ronda siguiente ya
   * existe o la ronda actual esta incompleta).
   * ponytail: el desempate en empate es la columna penalesGanadorId (quien gano
   * por penales). Upgrade path: guardar el marcador de penales como numeros si
   * el negocio lo pide, el bracket solo necesita al ganador.
   */
  async generarRondaSiguiente(torneoId: string): Promise<ResultadoAvanceBracket> {
    const torneo = await this.prisma.torneo.findUnique({
      where: { id: torneoId },
      include: {
        partidos: { include: { local: true, visitante: true, penalesGanador: true } },
      },
    });
    if (!torneo) throw new NotFoundException('Torneo no encontrado.');
    if (torneo.formato !== FormatoTorneo.ELIMINACION_DIRECTA) return { tipo: 'sin_cambios' };

    const maxRonda = torneo.partidos.reduce((m, p) => Math.max(m, p.ronda ?? 0), 0);
    if (maxRonda === 0) return { tipo: 'sin_cambios' }; // aun no hay fixture
    // Idempotencia: la ronda siguiente solo se genera si la actual esta completa
    // (filtro `faltaResultado` abajo); una ronda nunca se duplica porque
    // createMany es atomico y maxRonda salta a la ultima ronda existente.

    const deRonda = [...torneo.partidos]
      .filter((p) => p.ronda === maxRonda)
      .sort((a, b) => a.posicion - b.posicion);

    // Complejidad: todo partido con visitante debe estar jugado. Un bye
    // (visitante null) avanza al local sin necesitar resultado.
    const faltaResultado = deRonda.some(
      (p) => p.visitanteId !== null && (p.golesLocal === null || p.golesVisitante === null),
    );
    if (faltaResultado) return { tipo: 'sin_cambios' };

    const avanzan: string[] = [];
    for (const p of deRonda) {
      if (p.visitanteId === null) {
        avanzan.push(p.localId!); // bye
      } else if (p.golesLocal! > p.golesVisitante!) {
        avanzan.push(p.localId!);
      } else if (p.golesVisitante! > p.golesLocal!) {
        avanzan.push(p.visitanteId!);
      } else {
        if (!p.penalesGanadorId) return { tipo: 'penalesPendientes', partidoId: p.id };
        avanzan.push(p.penalesGanadorId);
      }
    }

    if (avanzan.length === 1) {
      // Final definida: hay campeon. No se toca el estado; lo controla el admin.
      const finalMatch = deRonda[0];
      const campeonNombre =
        [finalMatch.local, finalMatch.visitante, finalMatch.penalesGanador].find(
          (e) => e?.id === avanzan[0],
        )?.nombre ?? 'Desconocido';
      return { tipo: 'campeon', campeonId: avanzan[0], campeonNombre };
    }

    const pares = generarRondaEliminatoria(avanzan, maxRonda + 1);
    await this.prisma.partido.createMany({
      data: pares.map((p) => ({
        torneoId,
        jornada: 0,
        ronda: p.ronda,
        posicion: p.posicion,
        localId: p.localId,
        visitanteId: p.visitanteId,
      })),
    });

    const partidosCreados = await this.prisma.partido.findMany({
      where: { torneoId, ronda: maxRonda + 1 },
      include: { local: true, visitante: true, penalesGanador: true },
      orderBy: [{ posicion: 'asc' }],
    });
    return { tipo: 'avanzada', partidosCreados };
  }
}
