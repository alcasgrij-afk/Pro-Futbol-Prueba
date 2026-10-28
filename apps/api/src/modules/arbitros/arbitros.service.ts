import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ActualizarArbitroDto, CrearArbitroDto } from './dto/arbitro.dto';

@Injectable()
export class ArbitrosService {
  constructor(private readonly prisma: PrismaService) {}

  listar(soloActivos = false) {
    return this.prisma.arbitro.findMany({
      where: soloActivos ? { activo: true } : {},
      orderBy: { nombre: 'asc' },
    });
  }

  async obtenerPorId(id: string) {
    const arbitro = await this.prisma.arbitro.findUnique({ where: { id } });
    if (!arbitro) throw new NotFoundException('Arbitro no encontrado.');
    return arbitro;
  }

  crear(dto: CrearArbitroDto) {
    return this.prisma.arbitro.create({ data: dto });
  }

  async actualizar(id: string, dto: ActualizarArbitroDto) {
    await this.obtenerPorId(id);
    return this.prisma.arbitro.update({ where: { id }, data: dto });
  }
}
