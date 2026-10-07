import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

/**
 * Guard aislado del sistema de auth de negocio (JwtAuthGuard/RolesGuard):
 * el panel /superadmin es para dev/infra, no para Usuario/RolUsuario, asi
 * que verifica su propio token firmado con SUPERADMIN_JWT_SECRET en vez de
 * pasar por JwtStrategy (que busca un Usuario en la base y rechazaria este
 * token). Se aplica explicitamente con @UseGuards() en SuperadminController,
 * cuyos endpoints tambien llevan @Public() para saltar el guard global.
 */
@Injectable()
export class SuperadminAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const header = request.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    if (!token) {
      throw new UnauthorizedException('Token de superadmin requerido.');
    }

    try {
      const payload = this.jwt.verify<{ scope: string }>(token, {
        secret: this.config.get<string>('SUPERADMIN_JWT_SECRET'),
      });
      if (payload.scope !== 'superadmin') {
        throw new UnauthorizedException();
      }
    } catch {
      throw new UnauthorizedException('Token de superadmin invalido o expirado.');
    }

    return true;
  }
}
