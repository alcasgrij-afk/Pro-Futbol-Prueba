import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RolUsuario } from '@profutbol/shared-types';
import { ConceptosPagoService } from './conceptos-pago.service';
import { ActualizarConceptoPagoDto, CrearConceptoPagoDto } from './dto/concepto-pago.dto';
import { Roles } from '../../common/decorators/roles.decorator';

/**
 * Catalogo editable de conceptos de cobro manual ("Pago especial" y los otros
 * por definir). No hay DELETE a proposito: se desactiva, porque los Pago
 * historicos apuntan a estos ids.
 */
@ApiTags('conceptos-pago')
@ApiBearerAuth()
@Controller('conceptos-pago')
export class ConceptosPagoController {
  constructor(private readonly conceptosService: ConceptosPagoService) {}

  @Roles(RolUsuario.ADMIN, RolUsuario.RECEPCION)
  @Get()
  listar(@Query('activo') activo?: string) {
    return this.conceptosService.listar(activo === 'true');
  }

  @Roles(RolUsuario.ADMIN)
  @Post()
  crear(@Body() dto: CrearConceptoPagoDto) {
    return this.conceptosService.crear(dto);
  }

  @Roles(RolUsuario.ADMIN)
  @Patch(':id')
  actualizar(@Param('id') id: string, @Body() dto: ActualizarConceptoPagoDto) {
    return this.conceptosService.actualizar(id, dto);
  }
}
