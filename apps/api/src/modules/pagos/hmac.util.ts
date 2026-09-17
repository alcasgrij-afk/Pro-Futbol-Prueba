import { createHmac, timingSafeEqual } from 'crypto';

import { UnauthorizedException } from '@nestjs/common';

/**
 * Verifica una firma HMAC-SHA256 de un webhook de pasarela de pago.
 *
 * `firma` puede venir con prefijo "sha256=" (estilo GitHub/Stripe) o ser el
 * hex puro. Se compara en tiempo constante para evitar ataques de
 * temporizacion.
 *
 * Lanza UnauthorizedException si la firma es invalida para evitar fallos silenciosos.
 */
export function verificarFirmaHmac(
  firma: string | undefined,
  secreto: string,
  cuerpo: Buffer,
): void {
  if (!firma) {
    throw new UnauthorizedException('Firma HMAC ausente');
  }

  const firmaHex = firma.replace(/^sha256=/, '').toLowerCase();
  const esperado = createHmac('sha256', secreto).update(cuerpo).digest('hex');

  const a = Buffer.from(firmaHex, 'hex');
  const b = Buffer.from(esperado, 'hex');
  if (a.length !== b.length) {
    throw new UnauthorizedException('Firma HMAC invalida: longitud incorrecta');
  }

  if (!timingSafeEqual(a, b)) {
    throw new UnauthorizedException('Firma HMAC invalida');
  }
}
