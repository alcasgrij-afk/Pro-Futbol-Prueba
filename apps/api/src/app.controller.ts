import { Controller, Get } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Public } from './common/decorators/public.decorator';

@ApiExcludeController()
@Controller()
export class AppController {
  @Public()
  @Get('health')
  health() {
    return { status: 'ok', servicio: 'profutbol-antigua-api', timestamp: new Date().toISOString() };
  }
}
