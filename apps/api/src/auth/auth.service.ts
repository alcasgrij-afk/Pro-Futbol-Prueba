import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(email: string, password: string) {
    const usuario = await this.prisma.usuario.findUnique({ where: { email } });

    // Mensaje deliberadamente generico: no revelar si el correo existe o no.
    if (!usuario || !usuario.activo) {
      throw new UnauthorizedException('Correo o contrasena incorrectos.');
    }

    // Bloqueo de cuenta (PENDIENTES.md 3.1): 5 fallos consecutivos -> 15 min.
    // Se revisa antes de comparar el hash para no gastar CPU en una cuenta
    // ya bloqueada.
    const UMBRAL_INTENTOS = 5;
    const DURACION_BLOQUEO_MS = 15 * 60 * 1000;
    const ahora = new Date();
    if (usuario.bloqueadoHasta && usuario.bloqueadoHasta > ahora) {
      throw new UnauthorizedException(
        'Cuenta temporalmente bloqueada por intentos fallidos. Intenta de nuevo mas tarde.',
      );
    }
    // Si un bloqueo previo ya expiro, reiniciar el contador para dar una
    // ventana limpia: evita que el primer fallo tras la expiracion re-bloquee
    // una cuenta con el contador lleno.
    if (usuario.bloqueadoHasta && usuario.bloqueadoHasta <= ahora) {
      await this.prisma.usuario.update({
        where: { id: usuario.id },
        data: { intentosFallidos: 0, bloqueadoHasta: null },
      });
    }

    const passwordValida = await bcrypt.compare(password, usuario.passwordHash);
    if (!passwordValida) {
      // Incremento atomico (increment): dos fallos concurrentes no pierden conteo.
      const trasFallo = await this.prisma.usuario.update({
        where: { id: usuario.id },
        data: { intentosFallidos: { increment: 1 } },
      });
      if (trasFallo.intentosFallidos >= UMBRAL_INTENTOS) {
        await this.prisma.usuario.update({
          where: { id: usuario.id },
          data: { bloqueadoHasta: new Date(ahora.getTime() + DURACION_BLOQUEO_MS) },
        });
      }
      throw new UnauthorizedException('Correo o contrasena incorrectos.');
    }

    // Credenciales validas: limpiar cualquier estado de bloqueo previo.
    await this.prisma.usuario.update({
      where: { id: usuario.id },
      data: { intentosFallidos: 0, bloqueadoHasta: null },
    });

    return this.emitirTokens(usuario.id, usuario.email, usuario.rol);
  }

  /**
   * Cierra el pendiente senalado desde la Fase 1 (ver SECURITY_CHECKLIST.md,
   * A07): antes de este metodo, cambiar una contrasena requeria editar la
   * base de datos directamente. Requiere la contrasena actual para evitar
   * que una sesion robada (access token filtrado) cambie la contrasena sin
   * conocerla.
   */
  async cambiarPassword(usuarioId: string, passwordActual: string, passwordNuevo: string) {
    const usuario = await this.prisma.usuario.findUniqueOrThrow({ where: { id: usuarioId } });

    const passwordValida = await bcrypt.compare(passwordActual, usuario.passwordHash);
    if (!passwordValida) {
      throw new UnauthorizedException('La contrasena actual no es correcta.');
    }

    const nuevoHash = await bcrypt.hash(passwordNuevo, saltRounds);
    await this.prisma.usuario.update({ where: { id: usuarioId }, data: { passwordHash: nuevoHash } });

    return { mensaje: 'Contrasena actualizada correctamente.' };
  }

  async refrescar(refreshToken: string) {
    try {
      const payload = this.jwt.verify(refreshToken, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      });
      const usuario = await this.prisma.usuario.findUnique({ where: { id: payload.sub } });
      if (!usuario || !usuario.activo) {
        throw new UnauthorizedException();
      }
      return this.emitirTokens(usuario.id, usuario.email, usuario.rol);
    } catch {
      throw new UnauthorizedException('Refresh token invalido o expirado.');
    }
  }

  private async emitirTokens(usuarioId: string, email: string, rol: string) {
    const payload = { sub: usuarioId, email, rol };

    const accessToken = this.jwt.sign(payload, {
      secret: this.config.get<string>('JWT_ACCESS_SECRET'),
      // @nestjs/jwt v11 tipa expiresIn como ms.StringValue; el valor de env ('15m') es valido en runtime
      expiresIn: this.config.get<string>('JWT_ACCESS_EXPIRES_IN', '15m') as JwtSignOptions['expiresIn'],
    });
    const refreshToken = this.jwt.sign(payload, {
      secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.config.get<string>('JWT_REFRESH_EXPIRES_IN', '7d') as JwtSignOptions['expiresIn'],
    });

    const usuario = await this.prisma.usuario.findUniqueOrThrow({ where: { id: usuarioId } });

    return {
      accessToken,
      refreshToken,
      usuario: { id: usuario.id, nombre: usuario.nombre, rol: usuario.rol },
    };
  }
}
