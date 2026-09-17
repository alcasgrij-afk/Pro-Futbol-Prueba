import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GatewayPago, TipoPagoReferencia } from '@profutbol/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { PagosService } from '../pagos/pagos.service';

@Injectable()
export class MensualidadesService {
  private readonly logger = new Logger(MensualidadesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pagosService: PagosService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Job "cobro-mensualidad-academia": genera el cargo del mes actual para cada
   * alumno activo que todavia no lo tenga, y de una vez genera el link de
   * cobro. Es SEGURO correrlo mas de una vez en el mismo mes: el indice unico
   * (alumnoId, mes, anio) evita duplicar el cargo, y este metodo lo revisa
   * antes de intentar crear uno.
   */
  async generarParaMesActual(fechaReferencia: Date = new Date()): Promise<number> {
    const mes = fechaReferencia.getMonth() + 1;
    const anio = fechaReferencia.getFullYear();
    const montoQ = this.config.get<number>('ACADEMIA_MENSUALIDAD_Q', 150);

    const alumnosActivos = await this.prisma.alumno.findMany({ where: { activo: true } });

    let generadas = 0;
    for (const alumno of alumnosActivos) {
      const yaExiste = await this.prisma.academiaMensualidad.findUnique({
        where: { alumnoId_mes_anio: { alumnoId: alumno.id, mes, anio } },
      });

      if (yaExiste) {
        // Si una corrida anterior dejo la mensualidad creada pero sin link de
        // pago (p.ej. gateway caido), lo generamos aqui en vez de dejarla
        // sin cobro para siempre.
        const tienePago = await this.prisma.pago.findFirst({
          where: { tipoReferencia: TipoPagoReferencia.MENSUALIDAD, referenciaId: yaExiste.id },
          select: { id: true },
        });
        if (!tienePago) await this.generarLinkDePago(yaExiste.id, mes, anio, alumno.nombre, montoQ);
        continue;
      }

      const mensualidad = await this.prisma.academiaMensualidad.create({
        data: { alumnoId: alumno.id, mes, anio, montoQ },
      });
      await this.generarLinkDePago(mensualidad.id, mes, anio, alumno.nombre, montoQ);
      generadas++;
    }

    if (generadas > 0) {
      this.logger.log(`Mensualidades generadas para ${mes}/${anio}: ${generadas}`);
    }
    return generadas;
  }

  private async generarLinkDePago(
    mensualidadId: string,
    mes: number,
    anio: number,
    alumnoNombre: string,
    montoQ: number,
  ) {
    await this.pagosService.crearPagoMensualidad(GatewayPago.BAC, {
      mensualidadId,
      montoQ,
      descripcion: `Mensualidad academia ${mes}/${anio} - ${alumnoNombre}`,
    });
  }

  async listarPorAlumno(alumnoId: string) {
    const mensualidades = await this.prisma.academiaMensualidad.findMany({
      where: { alumnoId },
      orderBy: [{ anio: 'desc' }, { mes: 'desc' }],
    });
    return this.adjuntarEstadoPago(mensualidades);
  }

  async listarDelMes(mes: number, anio: number) {
    const mensualidades = await this.prisma.academiaMensualidad.findMany({
      where: { mes, anio },
      include: { alumno: true },
      orderBy: { creadoEn: 'asc' },
    });
    return this.adjuntarEstadoPago(mensualidades);
  }

  private async adjuntarEstadoPago<T extends { id: string; montoQ: any }>(mensualidades: T[]) {
    const ids = mensualidades.map((m) => m.id);
    const pagadas = await this.pagosService.obtenerPagadas(TipoPagoReferencia.MENSUALIDAD, ids);
    return mensualidades.map((m) => ({
      ...m,
      montoQ: Number(m.montoQ), // Decimal → number para cumplir el DTO compartido
      pagada: pagadas.has(m.id),
    }));
  }
}
