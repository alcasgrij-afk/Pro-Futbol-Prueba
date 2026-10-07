import { Injectable } from '@nestjs/common';
import { EstadoPago, EstadoReserva, TipoPagoReferencia } from '@profutbol/shared-types';
import { PrismaService } from '../../prisma/prisma.service';

const ETIQUETA_MODULO: Record<string, string> = {
  RESERVA: 'Reservas de cancha',
  EQUIPO: 'Cuotas de torneo',
  MENSUALIDAD: 'Mensualidades de academia',
  VENTA: 'Venta de productos',
};

@Injectable()
export class ReportesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Reporte de ingresos CONSOLIDADO (ver Plan Tecnico, Fase 5 / Sprint 1):
   * a diferencia de la version de la Fase 2, que solo sumaba reservas, este
   * suma todos los pagos COMPLETADOS sin importar el modulo (reserva, cuota
   * de equipo, mensualidad de academia) y desglosa por modulo ademas de por
   * dia. La fecha de agrupacion es `confirmadoEn` del Pago (cuando se
   * confirmo el cobro), no la fecha del evento en si — es la fecha correcta
   * para un reporte financiero: cuando el dinero efectivamente entro.
   */
  async ingresos(desde: string, hasta: string) {
    const pagos = await this.prisma.pago.findMany({
      where: {
        estado: EstadoPago.COMPLETADO,
        confirmadoEn: { gte: new Date(desde), lte: this.finDelDia(hasta) },
      },
      select: { tipoReferencia: true, montoQ: true, confirmadoEn: true },
    });

    const porDiaMap = new Map<string, number>();
    const porModuloMap = new Map<string, { totalQ: number; cantidad: number }>();
    let totalQ = 0;

    for (const pago of pagos) {
      const monto = Number(pago.montoQ);
      totalQ += monto;

      // Fecha LOCAL, no `toISOString().slice(0,10)`: un pago confirmado entre
      // 18:00 y 23:59 GT (UTC siguiente dia) se agruparia bajo el dia siguiente.
      // Mismo criterio local que `finDelDia()` y los helpers de fecha del resto.
      const confirmado = pago.confirmadoEn!;
      const claveDia =
        `${confirmado.getFullYear()}-${String(confirmado.getMonth() + 1).padStart(2, '0')}-${String(confirmado.getDate()).padStart(2, '0')}`;
      porDiaMap.set(claveDia, (porDiaMap.get(claveDia) ?? 0) + monto);

      const actual = porModuloMap.get(pago.tipoReferencia) ?? { totalQ: 0, cantidad: 0 };
      porModuloMap.set(pago.tipoReferencia, { totalQ: actual.totalQ + monto, cantidad: actual.cantidad + 1 });
    }

    const porDia = Array.from(porDiaMap.entries())
      .map(([fecha, totalQ]) => ({ fecha, totalQ }))
      .sort((a, b) => a.fecha.localeCompare(b.fecha));

    const porModulo = Array.from(porModuloMap.entries()).map(([tipoReferencia, datos]) => ({
      tipoReferencia,
      etiqueta: ETIQUETA_MODULO[tipoReferencia] ?? tipoReferencia,
      ...datos,
    }));

    return { desde, hasta, totalQ, cantidadPagos: pagos.length, porDia, porModulo };
  }

  async ocupacion(desde: string, hasta: string) {
    const canchas = await this.prisma.cancha.findMany({ where: { activa: true } });
    const { semana, finde } = this.contarDiasPorTipo(desde, hasta);

    const porCancha = await Promise.all(
      canchas.map(async (cancha) => {
        const bloquesPorDiaSemana = Math.floor(
          (cancha.horaCierreMinSemana - cancha.horaAperturaMinSemana) / cancha.duracionBloqueMin,
        );
        const bloquesPorDiaFinde = Math.floor(
          (cancha.horaCierreMinFinde - cancha.horaAperturaMinFinde) / cancha.duracionBloqueMin,
        );
        const bloquesTotales = bloquesPorDiaSemana * semana + bloquesPorDiaFinde * finde;

        const bloquesOcupados = await this.prisma.reserva.count({
          where: {
            canchaId: cancha.id,
            estado: EstadoReserva.CONFIRMADA,
            fecha: { gte: new Date(desde), lte: new Date(hasta) },
          },
        });

        return {
          canchaId: cancha.id,
          canchaNombre: cancha.nombre,
          bloquesOcupados,
          bloquesTotales,
          porcentajeOcupacion: bloquesTotales > 0 ? Math.round((bloquesOcupados / bloquesTotales) * 1000) / 10 : 0,
        };
      }),
    );

    return { desde, hasta, porCancha };
  }

  /**
   * Reporte de morosidad (ver Plan Tecnico, Fase 5): pagos PENDIENTES que
   * llevan mas de `diasVencimiento` dias sin resolverse, sin importar el
   * modulo. Util para que el personal sepa a quien darle seguimiento sin
   * revisar reservas, equipos y alumnos por separado.
   */
  async morosidad(diasVencimiento = 7) {
    const limite = new Date();
    limite.setDate(limite.getDate() - diasVencimiento);

    const pendientes = await this.prisma.pago.findMany({
      where: { estado: EstadoPago.PENDIENTE, creadoEn: { lte: limite } },
      orderBy: { creadoEn: 'asc' },
    });

    const detalle = await Promise.all(
      pendientes.map(async (pago) => ({
        pagoId: pago.id,
        tipoReferencia: pago.tipoReferencia,
        etiqueta: ETIQUETA_MODULO[pago.tipoReferencia] ?? pago.tipoReferencia,
        montoQ: Number(pago.montoQ),
        diasVencido: Math.floor((Date.now() - pago.creadoEn.getTime()) / (24 * 60 * 60 * 1000)),
        descripcion: await this.describirReferencia(pago.tipoReferencia, pago.referenciaId),
      })),
    );

    const totalQ = detalle.reduce((acc, d) => acc + d.montoQ, 0);

    return { diasVencimiento, totalQ, cantidad: detalle.length, detalle };
  }

  private async describirReferencia(tipo: string, referenciaId: string): Promise<string> {
    switch (tipo) {
      case TipoPagoReferencia.RESERVA: {
        const reserva = await this.prisma.reserva.findUnique({
          where: { id: referenciaId },
          include: { cliente: true, cancha: true },
        });
        return reserva ? `${reserva.cancha?.nombre} · ${reserva.cliente?.nombre} (${reserva.cliente?.telefono})` : 'Reserva no encontrada';
      }
      case TipoPagoReferencia.EQUIPO: {
        const equipo = await this.prisma.equipo.findUnique({ where: { id: referenciaId } });
        return equipo ? `Equipo ${equipo.nombre} (${equipo.capitanNombre ?? 'sin capitan'} · ${equipo.capitanTelefono ?? 'sin telefono'})` : 'Equipo no encontrado';
      }
      case TipoPagoReferencia.MENSUALIDAD: {
        const mensualidad = await this.prisma.academiaMensualidad.findUnique({
          where: { id: referenciaId },
          include: { alumno: true },
        });
        return mensualidad
          ? `Mensualidad ${mensualidad.mes}/${mensualidad.anio} · ${mensualidad.alumno?.nombres} ${mensualidad.alumno?.apellidos} (${mensualidad.alumno?.encargadoTelefono})`
          : 'Mensualidad no encontrada';
      }
      default:
        return 'Referencia desconocida';
    }
  }

  private finDelDia(fecha: string): Date {
    // new Date(fecha) parsea como medianoche UTC; setHours() opera en hora
    // LOCAL, asi que en un servidor con TZ distinto de UTC (America/Guatemala)
    // terminaba fijando el fin del dia ANTERIOR. Construir desde componentes
    // Y/M/D evita la mezcla UTC/local.
    const [anio, mes, dia] = fecha.split('-').map(Number);
    return new Date(anio, mes - 1, dia, 23, 59, 59, 999);
  }

  private contarDiasPorTipo(desde: string, hasta: string): { semana: number; finde: number } {
    const [anioD, mesD, diaD] = desde.split('-').map(Number);
    const [anioH, mesH, diaH] = hasta.split('-').map(Number);
    const inicio = new Date(anioD, mesD - 1, diaD);
    const fin = new Date(anioH, mesH - 1, diaH);

    let semana = 0;
    let finde = 0;
    for (let d = inicio; d <= fin; d.setDate(d.getDate() + 1)) {
      const diaSemana = d.getDay();
      if (diaSemana === 0 || diaSemana === 6) finde++;
      else semana++;
    }
    if (semana + finde === 0) semana = 1; // rango invalido: no dividir entre 0
    return { semana, finde };
  }
}
