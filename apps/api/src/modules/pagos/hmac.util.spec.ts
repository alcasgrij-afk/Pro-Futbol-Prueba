import { createHmac } from 'crypto';
import { verificarFirmaHmac } from './hmac.util';
import { UnauthorizedException } from '@nestjs/common';

describe('verificarFirmaHmac', () => {
  const secreto = 'mi-secreto';
  const cuerpo = Buffer.from('{"id":"pago-1"}');

  const firmar = (body: Buffer, secret: string) =>
    `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;

  it('no lanza excepción con una firma correcta', () => {
    expect(() => verificarFirmaHmac(firmar(cuerpo, secreto), secreto, cuerpo)).not.toThrow();
  });

  it('no lanza excepción con una firma sin prefijo sha256=', () => {
    const hex = createHmac('sha256', secreto).update(cuerpo).digest('hex');
    expect(() => verificarFirmaHmac(hex, secreto, cuerpo)).not.toThrow();
  });

  it('lanza UnauthorizedException cuando la firma tiene secreto incorrecto', () => {
    expect(() => verificarFirmaHmac(firmar(cuerpo, 'otro-secreto'), secreto, cuerpo))
      .toThrow(UnauthorizedException);
  });

  it('lanza UnauthorizedException cuando la firma no viene (undefined)', () => {
    expect(() => verificarFirmaHmac(undefined, secreto, cuerpo))
      .toThrow(UnauthorizedException);
  });

  it('lanza UnauthorizedException con un cuerpo manipulado', () => {
    const manipulado = Buffer.from('{"id":"pago-2"}');
    expect(() => verificarFirmaHmac(firmar(cuerpo, secreto), secreto, manipulado))
      .toThrow(UnauthorizedException);
  });
});
