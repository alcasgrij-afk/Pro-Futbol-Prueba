import { Injectable, NotFoundException } from '@nestjs/common';
import { GastoCategoria } from '@profutbol/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { CrearGastoDto } from './dto/crear-gasto.dto';

@Injectable()
export class GastosService {
  constructor(private readonly prisma: PrismaService) {}

  crear(dto: CrearGastoDto) {
    return this.prisma.gasto.create({ data: { ...dto, fecha: new Date(dto.fecha) } });
  }

  async listar(filtros: { desde?: string; hasta?: string }) {
    return this.prisma.gasto.findMany({
      where: {
        ...(filtros.desde ? { fecha: { gte: new Date(filtros.desde) } } : {}),
        ...(filtros.hasta ? { fecha: { lte: new Date(filtros.hasta) } } : {}),
      },
      orderBy: { fecha: 'desc' },
    });
  }

  async eliminar(id: string) {
    const gasto = await this.prisma.gasto.findUnique({ where: { id } });
    if (!gasto) throw new NotFoundException('Gasto no encontrado.');
    await this.prisma.gasto.delete({ where: { id } });
    return { ok: true };
  }

  /** Totales por categoria + gran total, para el reporte imprimible. */
  async resumen(desde: string, hasta: string) {
    const gastos = await this.listar({ desde, hasta });

    const porCategoriaMap = new Map<GastoCategoria, { totalQ: number; cantidad: number }>();
    let totalQ = 0;

    for (const gasto of gastos) {
      const monto = Number(gasto.montoQ);
      totalQ += monto;
      const actual = porCategoriaMap.get(gasto.categoria as GastoCategoria) ?? { totalQ: 0, cantidad: 0 };
      porCategoriaMap.set(gasto.categoria as GastoCategoria, { totalQ: actual.totalQ + monto, cantidad: actual.cantidad + 1 });
    }

    const porCategoria = Array.from(porCategoriaMap.entries()).map(([categoria, datos]) => ({
      categoria,
      ...datos,
    }));

    return { desde, hasta, totalQ, porCategoria };
  }
}
