import { Body, Controller, Delete, Get, Param, Post, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { Throttle } from '@nestjs/throttler';
import { timingSafeEqual } from 'crypto';
import { Public } from '../../common/decorators/public.decorator';
import { SuperadminAuthGuard } from '../../common/guards/superadmin-auth.guard';
import { SuperadminLoginDto } from './dto/superadmin-login.dto';
import { TerminarConsultaDto } from './dto/terminar-consulta.dto';
import { MarcarPagoDto } from './dto/marcar-pago.dto';
import { SuperadminService } from './superadmin.service';
import { SuperadminHistorialService } from './superadmin-historial.service';
import { SuperadminAccionesService } from './superadmin-acciones.service';
import { SuperadminLogBufferService } from './superadmin-log-buffer.service';

// Excluido de Swagger (no es para los mismos consumidores que el resto de la
// API) y completamente al margen de Usuario/RolUsuario: ver nota en
// SuperadminAuthGuard.
@ApiExcludeController()
@Controller('superadmin')
export class SuperadminController {
  constructor(
    private readonly superadminService: SuperadminService,
    private readonly historialService: SuperadminHistorialService,
    private readonly accionesService: SuperadminAccionesService,
    private readonly logBuffer: SuperadminLogBufferService,
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

  @Public()
  @UseGuards(SuperadminAuthGuard)
  @Get('monitoring/historial')
  historial() {
    return this.historialService.obtenerHistorial();
  }

  @Public()
  @UseGuards(SuperadminAuthGuard)
  @Get('monitoring/logs')
  logs() {
    return this.logBuffer.obtenerUltimas();
  }

  @Public()
  @UseGuards(SuperadminAuthGuard)
  @Post('monitoring/database/terminar-consulta')
  terminarConsulta(@Body() dto: TerminarConsultaDto) {
    return this.accionesService.terminarConsulta(dto.pid);
  }

  @Public()
  @UseGuards(SuperadminAuthGuard)
  @Post('monitoring/colas/:cola/jobs/:jobId/reintentar')
  reintentarJob(@Param('cola') cola: string, @Param('jobId') jobId: string) {
    return this.accionesService.reintentarJob(cola, jobId);
  }

  @Public()
  @UseGuards(SuperadminAuthGuard)
  @Delete('monitoring/colas/:cola/jobs/:jobId')
  eliminarJob(@Param('cola') cola: string, @Param('jobId') jobId: string) {
    return this.accionesService.eliminarJob(cola, jobId);
  }

  @Public()
  @UseGuards(SuperadminAuthGuard)
  @Post('monitoring/pagos/:id/estado')
  marcarPago(@Param('id') id: string, @Body() dto: MarcarPagoDto) {
    return this.accionesService.marcarPago(id, dto.estado);
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
