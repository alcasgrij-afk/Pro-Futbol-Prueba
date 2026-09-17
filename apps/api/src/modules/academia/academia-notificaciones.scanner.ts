import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TipoPagoReferencia } from '@profutbol/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { PagosService } from '../pagos/pagos.service';

/**
 * Job "aviso-mensualidad-vencida": revisa mensualidades generadas hace mas de
 * N dias (periodo de gracia) que todavia no se pagaron, y avisa al encargado.
 * Cada mensualidad se avisa una sola vez (ver avisoVencidoEnviado en el
 * schema) para no ser repetitivos dia tras dia.
 *
 * # ponytail: v2 no tiene gateway de WhatsApp/SMS, asi que el "aviso" es un
 * log. Cuando exista un canal real de notificacion (Fase 5+), reemplazar el
 * this.logger.log por el envio a encargadoTelefono.
 */
@Injectable()
export class AcademiaNotificacionesScanner {
  private readonly logger = new Logger(AcademiaNotificacionesScanner.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pagosService: PagosService,
    private readonly config: ConfigService,
  ) {}

  async escanearMensualidadesVencidas(): Promise<number> {
    const diasGracia = this.config.get<number>('ACADEMIA_DIAS_GRACIA_PAGO', 5);
    const limite = new Date();
    limite.setDate(limite.getDate() - diasGracia);

    const candidatas = await this.prisma.academiaMensualidad.findMany({
      where: { avisoVencidoEnviado: false, creadoEn: { lte: limite } },
      include: { alumno: true },
    });

    let avisosEnviados = 0;
    for (const mensualidad of candidatas) {
      const pagada = await this.pagosService.estaPagada(TipoPagoReferencia.MENSUALIDAD, mensualidad.id);

      if (pagada) {
        // Ya se pago (probablemente justo antes de que corriera este job);
        // se marca igual para no seguir evaluandola en cada corrida.
        await this.prisma.academiaMensualidad.update({
          where: { id: mensualidad.id },
          data: { avisoVencidoEnviado: true },
        });
        continue;
      }

      this.logger.log(
        `[aviso-mensualidad-vencida] Pendiente: ${mensualidad.mes}/${mensualidad.anio} ` +
          `${mensualidad.alumno.nombre} (Q${mensualidad.montoQ}) -> encargado ${mensualidad.alumno.encargadoTelefono}`,
      );

      await this.prisma.academiaMensualidad.update({
        where: { id: mensualidad.id },
        data: { avisoVencidoEnviado: true },
      });

      avisosEnviados++;
    }

    if (avisosEnviados > 0) {
      this.logger.log(`Avisos de mensualidad vencida enviados: ${avisosEnviados}`);
    }
    return avisosEnviados;
  }
}
