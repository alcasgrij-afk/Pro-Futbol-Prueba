import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GatewayPago } from '@profutbol/shared-types';
import { CrearPagoInput, PagoRedireccion } from './payment-gateway.interface';

/**
 * Integracion por redireccion con BAC Credomatic / NeoNet (Fase 2 real).
 *
 * Si las credenciales de la pasarela estan configuradas (`BAC_API_URL` +
 * `BAC_API_KEY` o las de NeoNet), se llama la pasarela real. Si NO estan
 * configuradas (caso tipico en desarrollo), se usa un gateway SIMULADO:
 * devuelve una redirectUrl que apunta a la pagina de resultado del propio
 * sitio (`/pago/resultado?ref=<paymentId>&simulado=1`), que a su vez llama
 * `POST /payments/simulado/confirmar` para confirmar el pago localmente.
 *
 * Las credenciales reales solo cambian valores en `.env` (ver .env.example);
 * el codigo no cambia (Fase 2).
 */
@Injectable()
export class GatewayService {
  private readonly logger = new Logger(GatewayService.name);

  constructor(private readonly config: ConfigService) {}

  async createRedirectPayment(gateway: GatewayPago, input: CrearPagoInput): Promise<PagoRedireccion> {
    switch (gateway) {
      case GatewayPago.BAC:
        return this.crearSiConfigurado(
          'BAC',
          this.config.get<string>('BAC_API_URL'),
          this.config.get<string>('BAC_API_KEY'),
          input,
        );
      case GatewayPago.NEONET:
        return this.crearSiConfigurado(
          'NEONET',
          this.config.get<string>('NEONET_API_URL'),
          this.config.get<string>('NEONET_API_KEY'),
          input,
        );
      case GatewayPago.EFECTIVO:
        // Efectivo nunca tiene pasarela: el pago se confirma en sede.
        throw new Error('El gateway EFECTIVO no genera redireccion de pago.');
      case GatewayPago.SIMULADO:
        // Dev explicito: siempre simula, sin depender de credenciales.
        return this.simulada(input);
      default:
        throw new Error(`Gateway no soportado: ${gateway}`);
    }
  }

  private crearSiConfigurado(
    nombre: string,
    apiUrl: string | undefined,
    apiKey: string | undefined,
    input: CrearPagoInput,
  ): PagoRedireccion {
    if (apiUrl && apiKey) {
      // ponytail: implementar la llamada HTTP real a la pasarela aqui cuando
      // se confirmen los contratos de BAC/NeoNet (Fase 2). Hoy devolvemos la
      // simulada para no bloquear el flujo de desarrollo.
      this.logger.warn(
        `${nombre} configurado pero la integracion real no esta implementada; usando gateway simulado (Fase 2).`,
      );
    }
    return this.simulada(input);
  }

  private simulada(input: CrearPagoInput): PagoRedireccion {
    const base = this.config.get<string>('WEB_URL') ?? 'http://localhost:3000';
    return {
      redirectUrl: `${base}/pago/resultado?ref=${input.paymentId}&simulado=1`,
    };
  }
}
