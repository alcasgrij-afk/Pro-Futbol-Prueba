import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { QueueModule } from './queue/queue.module';
import { AuthModule } from './auth/auth.module';
import { CanchasModule } from './modules/canchas/canchas.module';
import { ClientesModule } from './modules/clientes/clientes.module';
import { ReservasModule } from './modules/reservas/reservas.module';
import { PagosModule } from './modules/pagos/pagos.module';
import { ChatModule } from './modules/chat/chat.module';
import { TorneosModule } from './modules/torneos/torneos.module';
import { AcademiaModule } from './modules/academia/academia.module';
import { ReportesModule } from './modules/reportes/reportes.module';
import { AppController } from './app.controller';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Limite general de peticiones para mitigar abuso (ver Plan Tecnico, sec. 8).
    // Los endpoints publicos sensibles (webhook, creacion de reserva) pueden
    // ajustar su propio limite mas estricto con @Throttle() si hace falta.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    PrismaModule,
    RedisModule,
    QueueModule,
    AuthModule,
    CanchasModule,
    ClientesModule,
    ReservasModule,
    PagosModule,
    ChatModule,
    TorneosModule,
    AcademiaModule,
    ReportesModule,
  ],
  controllers: [AppController],
  providers: [
    // Guard global: protege todo por defecto, excepto lo marcado @Public().
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
