import { Body, Controller, Get, Post, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { Throttle } from '@nestjs/throttler';
import { timingSafeEqual } from 'crypto';
import { Public } from '../../common/decorators/public.decorator';
import { SuperadminAuthGuard } from '../../common/guards/superadmin-auth.guard';
import { SuperadminLoginDto } from './dto/superadmin-login.dto';
import { SuperadminService } from './superadmin.service';

// Excluido de Swagger (no es para los mismos consumidores que el resto de la
// API) y completamente al margen de Usuario/RolUsuario: ver nota en
// SuperadminAuthGuard.
@ApiExcludeController()
@Controller('superadmin')
export class SuperadminController {
  constructor(
    private readonly superadminService: SuperadminService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  login(@Body() dto: SuperadminLoginDto) {
    const esperado = this.config.get<string>('SUPERADMIN_PASSWORD');
    if (!esperado || !this.compararConstante(dto.password, esperado)) {
      throw new UnauthorizedException('Contrasena incorrecta.');
    }

    const accessToken = this.jwt.sign(
      { scope: 'superadmin' },
      {
        secret: this.config.get<string>('SUPERADMIN_JWT_SECRET'),
        expiresIn: this.config.get<string>('SUPERADMIN_JWT_EXPIRES_IN', '4h') as JwtSignOptions['expiresIn'],
      },
    );

    return { accessToken };
  }

  @Public()
  @UseGuards(SuperadminAuthGuard)
  @Get('monitoring/overview')
  overview() {
    return this.superadminService.overview();
  }

  private compararConstante(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    // Largo distinto filtraria info por timing si se comparara directo;
    // timingSafeEqual exige buffers del mismo largo, asi que igualamos
    // comparando contra si mismo primero (siempre falla, tiempo constante).
    if (bufA.length !== bufB.length) return timingSafeEqual(bufA, bufA) && false;
    return timingSafeEqual(bufA, bufB);
  }
}
