import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marca un endpoint como publico (sin autenticacion).
 * Uso: @Public() encima del metodo del controller.
 * Necesario para: login, webhook del bot, webhooks de pago, health check.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
