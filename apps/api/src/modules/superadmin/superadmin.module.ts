import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { QueueModule } from '../../queue/queue.module';
import { SuperadminController } from './superadmin.controller';
import { SuperadminService } from './superadmin.service';
import { SuperadminHistorialService } from './superadmin-historial.service';
import { SuperadminAccionesService } from './superadmin-acciones.service';
import { SuperadminAuthGuard } from '../../common/guards/superadmin-auth.guard';
import { PagosModule } from '../pagos/pagos.module';
import { SuperadminLogBufferService } from './superadmin-log-buffer.service';

@Module({
  imports: [ConfigModule, JwtModule.register({}), QueueModule, PagosModule],
  controllers: [SuperadminController],
  providers: [
    SuperadminService,
    SuperadminHistorialService,
    SuperadminAccionesService,
    SuperadminAuthGuard,
    SuperadminLogBufferService,
  ],
})
export class SuperadminModule {}
