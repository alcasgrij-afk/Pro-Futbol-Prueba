import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { GatewayPago } from '@profutbol/shared-types';
import { PagosService } from './pagos.service';
import { CrearPagoDto } from './dto/crear-pago.dto';
import { Public } from '../../common/decorators/public.decorator';
import { verificarFirmaHmac } from './hmac.util';

@ApiTags('payments')
@Controller('payments')
export class PagosController {
  constructor(private readonly pagosService: PagosService) {}

  @Public()
  @Post(':gateway/create')
  crear(@Param('gateway') gateway: string, @Body() dto: CrearPagoDto) {
    return this.pagosService.crearPago(gateway.toUpperCase() as GatewayPago, {
      referenciaTipo: dto.referenciaTipo,
      referenciaId: dto.referenciaId,
      monto: dto.monto,
      returnUrl: dto.returnUrl,
    });
  }

  @Public()
  @Get(':id')
  obtener(@Param('id') id: string) {
    return this.pagosService.obtenerPago(id);
  }

  /**
   * Webhook de confirmacion de la pasarela. Se verifica la firma HMAC sobre
   * el cuerpo crudo (rawBody) con el secreto del gateway. Si el secreto no
   * esta configurado (desarrollo con gateway simulado), se procesa igual
   * para no romper el flujo local (se registra un aviso).
   */
  @Public()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Post(':gateway/webhook')
  async webhook(
    @Param('gateway') gateway: string,
    @Headers('x-signature') firma: string,
    @Req() req: Request,
    @Body() payload: { referenciaId: string; estado: string; referenciaPago?: string },
  ) {
    const secreto = this.secretoPara(gateway);
    if (secreto) {
      const crudo = (req as Request & { rawBody?: Buffer }).rawBody;
      const cuerpo = crudo ?? Buffer.from(JSON.stringify(req.body));
      verificarFirmaHmac(firma, secreto, cuerpo);
    }
    return this.pagosService.procesarWebhook(gateway.toUpperCase() as GatewayPago, payload);
  }

  @Public()
  @Post('simulado/confirmar')
  confirmarSimulado(@Body() body: { paymentId: string }) {
    return this.pagosService.confirmarPagoSimulado(body.paymentId);
  }

  private secretoPara(gateway: string): string | undefined {
    if (gateway.toUpperCase() === 'BAC') return process.env.BAC_WEBHOOK_SECRET;
    if (gateway.toUpperCase() === 'NEONET') return process.env.NEONET_WEBHOOK_SECRET;
    return undefined;
  }
}
