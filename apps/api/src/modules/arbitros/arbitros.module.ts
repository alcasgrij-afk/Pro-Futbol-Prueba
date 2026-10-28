import { Module } from '@nestjs/common';
import { ArbitrosController } from './arbitros.controller';
import { ArbitrosService } from './arbitros.service';

@Module({
  controllers: [ArbitrosController],
  providers: [ArbitrosService],
  exports: [ArbitrosService],
})
export class ArbitrosModule {}
