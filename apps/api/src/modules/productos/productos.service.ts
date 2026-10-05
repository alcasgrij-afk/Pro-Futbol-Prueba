import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CrearProductoDto, ActualizarProductoDto } from './dto/producto.dto';

@Injectable()
export class ProductosService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(soloActivos = false) {
    return this.prisma.producto.findMany({
      where: soloActivos ? { activo: true } : {},
      orderBy: [{ categoria: 'asc' }, { nombre: 'asc' }],
    });
  }

  async obtenerPorId(id: string) {
    const producto = await this.prisma.producto.findUnique({ where: { id } });
    if (!producto) throw new NotFoundException('Producto no encontrado.');
    return producto;
  }

  crear(dto: CrearProductoDto) {
    return this.prisma.producto.create({ data: dto });
  }

  async actualizar(id: string, dto: ActualizarProductoDto) {
    await this.obtenerPorId(id);
    return this.prisma.producto.update({ where: { id }, data: dto });
  }
}
