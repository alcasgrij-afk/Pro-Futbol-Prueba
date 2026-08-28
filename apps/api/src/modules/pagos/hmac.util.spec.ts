import { createHmac } from 'crypto';
import { verificarFirmaHmac } from './hmac.util';

describe('verificarFirmaHmac', () => {
  const secreto = 'mi-secreto';
  const cuerpo = Buffer.from('{"id":"pago-1"}');

  const firmar = (body: Buffer, secret: string) =>
    `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;

  it('acepta una firma correcta', () => {
    expect(verificarFirmaHmac(firmar(cuerpo, secreto), secreto, cuerpo)).toBe(true);
  });

  it('acepta una firma sin prefijo sha256=', () => {
    const hex = createHmac('sha256', secreto).update(cuerpo).digest('hex');
    expect(verificarFirmaHmac(hex, secreto, cuerpo)).toBe(true);
  });

  it('rechaza una firma con secreto incorrecto', () => {
    expect(verificarFirmaHmac(firmar(cuerpo, 'otro-secreto'), secreto, cuerpo)).toBe(false);
  });

  it('rechaza cuando la firma no viene (undefined)', () => {
    expect(verificarFirmaHmac(undefined, secreto, cuerpo)).toBe(false);
  });

  it('rechaza un cuerpo manipulado', () => {
    const manipulado = Buffer.from('{"id":"pago-2"}');
    expect(verificarFirmaHmac(firmar(cuerpo, secreto), secreto, manipulado)).toBe(false);
  });
});
