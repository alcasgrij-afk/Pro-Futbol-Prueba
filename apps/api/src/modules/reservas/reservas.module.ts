import { Module } from '@nestjs/common';
import { QueueModule } from '../../queue/queue.module';
import { ClientesModule } from '../clientes/clientes.module';
import { CanchasModule } from '../canchas/canchas.module';
import { PricingModule } from '../pricing/pricing.module';
import { ReservasController } from './reservas.controller';
import { ReservasService } from './reservas.service';
import { ReservasProcessor } from './reservas.processor';

@Module({
  imports: [QueueModule, ClientesModule, CanchasModule, PricingModule],
  controllers: [ReservasController],
  providers: [ReservasService, ReservasProcessor],
  exports: [ReservasService],
})
export class ReservasModule {}
