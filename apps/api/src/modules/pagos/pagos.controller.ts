import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { GatewayPago, RolUsuario, TipoPagoReferencia } from '@profutbol/shared-types';
import { PagosService } from './pagos.service';
import { CrearPagoDto } from './dto/crear-pago.dto';
import { CobrarManualDto } from './dto/cobrar-manual.dto';
import { CobrarAbonoDto } from './dto/cobrar-abono.dto';
import { CobrarSedeDto } from '../reservas/dto/cobrar-sede.dto';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
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

  // Modulo de Caja: bitacora de pagos (ventas, reservas, cuotas, mensualidades)
  // para el reporte imprimible de /admin/pagos.
  @ApiBearerAuth()
  @Roles(RolUsuario.ADMIN, RolUsuario.RECEPCION)
  @Get()
  listar(
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Query('tipoReferencia') tipoReferencia?: TipoPagoReferencia,
    @Query('referenciaId') referenciaId?: string,
  ) {
    return this.pagosService.listar({ desde, hasta, tipoReferencia, referenciaId });
  }

  // Modulo de Caja: cobra una reserva walk-in en efectivo (crea la reserva
  // y la confirma en el mismo paso).
  @ApiBearerAuth()
  @Roles(RolUsuario.ADMIN, RolUsuario.RECEPCION)
  @Post('reservas/cobrar-sede')
  cobrarReservaSede(@Body() dto: CobrarSedeDto) {
    return this.pagosService.cobrarReservaSede(dto);
  }

  // Modulo de Caja: saldo pendiente de una reserva (precio - abonos cobrados).
  @ApiBearerAuth()
  @Roles(RolUsuario.ADMIN, RolUsuario.RECEPCION)
  @Get('reservas/:id/saldo')
  saldoReserva(@Param('id') id: string) {
    return this.pagosService.saldoReserva(id);
  }

  // Modulo de Caja: cobra un abono (pago parcial) sobre una reserva existente.
  @ApiBearerAuth()
  @Roles(RolUsuario.ADMIN, RolUsuario.RECEPCION)
  @Post('reservas/:id/abono')
  cobrarAbono(@Param('id') id: string, @Body() dto: CobrarAbonoDto) {
    return this.pagosService.cobrarAbonoReserva(id, dto);
  }

  // /admin/pagos: cobro manual en sede (arbitraje y conceptos del catalogo).
  // Las reservas no pasan por aqui — se cobran solo desde Caja.
  @ApiBearerAuth()
  @Roles(RolUsuario.ADMIN, RolUsuario.RECEPCION)
  @Post('manual')
  cobrarManual(@Body() dto: CobrarManualDto) {
    return this.pagosService.cobrarManual(dto);
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
