import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { QueueModule } from '../../queue/queue.module';
import { SuperadminController } from './superadmin.controller';
import { SuperadminService } from './superadmin.service';
import { SuperadminAuthGuard } from '../../common/guards/superadmin-auth.guard';

@Module({
  imports: [ConfigModule, JwtModule.register({}), QueueModule],
  controllers: [SuperadminController],
  providers: [SuperadminService, SuperadminAuthGuard],
})
export class SuperadminModule {}
