import { Module } from '@nestjs/common';
import { ClientesModule } from '../clientes/clientes.module';
import { PagosModule } from '../pagos/pagos.module';
import { VentasController } from './ventas.controller';
import { VentasService } from './ventas.service';

@Module({
  imports: [ClientesModule, PagosModule],
  controllers: [VentasController],
  providers: [VentasService],
})
export class VentasModule {}
