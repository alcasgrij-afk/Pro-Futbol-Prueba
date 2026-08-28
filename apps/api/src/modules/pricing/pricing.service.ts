import { Injectable } from '@nestjs/common';
import { FormaPago, Prisma } from '@prisma/client';

/** Cancha con los precios necesarios para calcular la tarifa. */
export interface CanchaConPrecios {
  precioAnticipadoQ: Prisma.Decimal;
  precioSedeQ: Prisma.Decimal;
}

/**
 * Calcula el precio de una reserva segun la forma de pago. Se extrae aqui
 * para que la fuente sea una sola (reserva.precioTotalQ) y la refuercen
 * pagos y chat por igual.
 */
@Injectable()
export class PricingService {
  calcular(formaPago: FormaPago, cancha: CanchaConPrecios): Prisma.Decimal {
    return formaPago === FormaPago.ANTICIPADO_EN_LINEA
      ? cancha.precioAnticipadoQ
      : cancha.precioSedeQ;
  }
}
