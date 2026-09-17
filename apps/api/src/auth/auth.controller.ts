import { Body, Controller, Patch, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { CambiarPasswordDto } from './dto/cambiar-password.dto';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Limite mas estricto que el global (120/min, ver app.module.ts): el login
  // es el objetivo tipico de fuerza bruta, asi que se restringe aparte (ver
  // SECURITY_CHECKLIST.md, A09).
  @ApiOperation({ summary: 'Iniciar sesion' })
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }

  @ApiOperation({ summary: 'Renovar el access token usando el refresh token' })
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('refresh')
  refresh(@Body('refreshToken') refreshToken: string) {
    return this.authService.refrescar(refreshToken);
  }

  // Protegido por el guard global (requiere sesion activa) — req.user lo
  // llena JwtStrategy.validate() a partir del access token.
  @ApiOperation({ summary: 'Cambiar la contrasena propia (requiere la actual)' })
  @ApiBearerAuth()
  @Patch('password')
  cambiarPassword(@Req() req: Request & { user: { id: string } }, @Body() dto: CambiarPasswordDto) {
    return this.authService.cambiarPassword(req.user.id, dto.passwordActual, dto.passwordNuevo);
  }
}
