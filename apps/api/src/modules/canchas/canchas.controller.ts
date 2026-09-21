import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CanchasService } from './canchas.service';
import { DisponibilidadQueryDto } from './dto/disponibilidad-query.dto';
import { Public } from '../../common/decorators/public.decorator';

// Publico: el bot de WhatsApp y el sitio web consultan esto sin login.
@ApiTags('canchas')
@Controller('canchas')
export class CanchasController {
  constructor(private readonly canchasService: CanchasService) {}

  @Public()
  @Get()
  listar() {
    return this.canchasService.listar();
  }

  // Registrada antes de ':id/disponibilidad' para que Nest no intente
  // resolver "disponibilidad" como un :id de cancha.
  @Public()
  @Get('disponibilidad')
  disponibilidadTodas(@Query() query: DisponibilidadQueryDto) {
    return this.canchasService.disponibilidadTodas(query.fecha);
  }

  @Public()
  @Get(':id/disponibilidad')
  disponibilidad(@Param('id') id: string, @Query() query: DisponibilidadQueryDto) {
    return this.canchasService.disponibilidad(id, query.fecha);
  }
}
