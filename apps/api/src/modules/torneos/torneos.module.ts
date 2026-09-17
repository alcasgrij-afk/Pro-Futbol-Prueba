import { Module } from '@nestjs/common';
import { PagosModule } from '../pagos/pagos.module';
import { TorneosController } from './torneos.controller';
import { TorneosService } from './torneos.service';
import { EquiposService } from './equipos.service';
import { FixtureService } from './fixture.service';
import { PartidosService } from './partidos.service';
import { PosicionesService } from './posiciones.service';

@Module({
  imports: [PagosModule],
  controllers: [TorneosController],
  providers: [TorneosService, EquiposService, FixtureService, PartidosService, PosicionesService],
  exports: [TorneosService, EquiposService],
})
export class TorneosModule {}
