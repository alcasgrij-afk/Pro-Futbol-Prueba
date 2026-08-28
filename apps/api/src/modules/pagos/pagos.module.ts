import { Module } from '@nestjs/common';
import { ReservasModule } from '../reservas/reservas.module';
import { PagosController } from './pagos.controller';
import { PagosService } from './pagos.service';
import { GatewayService } from './gateways/gateway.service';

@Module({
  imports: [ReservasModule],
  controllers: [PagosController],
  providers: [PagosService, GatewayService],
  exports: [PagosService],
})
export class PagosModule {}
