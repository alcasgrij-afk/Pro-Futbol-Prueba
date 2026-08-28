/** Datos necesarios para crear un pago por redireccion en la pasarela. */
export interface CrearPagoInput {
  paymentId: string;
  montoQ: number;
  descripcion: string;
  returnUrl?: string;
}

/** Resultado de crear el pago: URL a la que se redirige al cliente. */
export interface PagoRedireccion {
  redirectUrl: string;
  gatewayOrderId?: string;
}
