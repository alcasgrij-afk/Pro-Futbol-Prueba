import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Verifica una firma HMAC-SHA256 de un webhook de pasarela de pago.
 *
 * `firma` puede venir con prefijo "sha256=" (estilo GitHub/Stripe) o ser el
 * hex puro. Se compara en tiempo constante para evitar ataques de
 * temporizacion.
 */
export function verificarFirmaHmac(
  firma: string | undefined,
  secreto: string,
  cuerpo: Buffer,
): boolean {
  if (!firma) return false;

  const firmaHex = firma.replace(/^sha256=/, '').toLowerCase();
  const esperado = createHmac('sha256', secreto).update(cuerpo).digest('hex');

  const a = Buffer.from(firmaHex, 'hex');
  const b = Buffer.from(esperado, 'hex');
  if (a.length !== b.length) return false;

  return timingSafeEqual(a, b);
}
