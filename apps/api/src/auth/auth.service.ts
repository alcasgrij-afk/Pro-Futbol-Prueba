import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
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

    const passwordValida = await bcrypt.compare(password, usuario.passwordHash);
    if (!passwordValida) {
      throw new UnauthorizedException('Correo o contrasena incorrectos.');
    }

    return this.emitirTokens(usuario.id, usuario.email, usuario.rol);
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
      expiresIn: this.config.get<string>('JWT_ACCESS_EXPIRES_IN', '15m'),
    });
    const refreshToken = this.jwt.sign(payload, {
      secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.config.get<string>('JWT_REFRESH_EXPIRES_IN', '7d'),
    });

    const usuario = await this.prisma.usuario.findUniqueOrThrow({ where: { id: usuarioId } });

    return {
      accessToken,
      refreshToken,
      usuario: { id: usuario.id, nombre: usuario.nombre, rol: usuario.rol },
    };
  }
}
