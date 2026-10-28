import { Module } from '@nestjs/common';
import { ConceptosPagoController } from './conceptos-pago.controller';
import { ConceptosPagoService } from './conceptos-pago.service';

@Module({
  controllers: [ConceptosPagoController],
  providers: [ConceptosPagoService],
  exports: [ConceptosPagoService],
})
export class ConceptosPagoModule {}
