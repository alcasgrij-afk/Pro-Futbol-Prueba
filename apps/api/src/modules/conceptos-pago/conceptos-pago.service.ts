import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ActualizarConceptoPagoDto, CrearConceptoPagoDto } from './dto/concepto-pago.dto';

@Injectable()
export class ConceptosPagoService {
  constructor(private readonly prisma: PrismaService) {}

  listar(soloActivos = false) {
    return this.prisma.conceptoPago.findMany({
      where: soloActivos ? { activo: true } : {},
      orderBy: { creadoEn: 'asc' },
    });
  }

  async obtenerPorId(id: string) {
    const concepto = await this.prisma.conceptoPago.findUnique({ where: { id } });
    if (!concepto) throw new NotFoundException('Concepto de pago no encontrado.');
    return concepto;
  }

  crear(dto: CrearConceptoPagoDto) {
    return this.prisma.conceptoPago.create({ data: dto });
  }

  async actualizar(id: string, dto: ActualizarConceptoPagoDto) {
    await this.obtenerPorId(id);
    return this.prisma.conceptoPago.update({ where: { id }, data: dto });
  }
}
