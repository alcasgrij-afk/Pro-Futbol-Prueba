import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EstadoVenta, TipoPagoReferencia } from '@profutbol/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { ClientesService } from '../clientes/clientes.service';
import { PagosService } from '../pagos/pagos.service';
import { CrearVentaDto } from './dto/crear-venta.dto';

@Injectable()
export class VentasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clientesService: ClientesService,
    private readonly pagosService: PagosService,
  ) {}

  async crear(dto: CrearVentaDto) {
    const cliente = dto.clienteTelefono
      ? await this.clientesService.buscarOCrear(dto.clienteTelefono, dto.clienteNombre ?? '')
      : null;

    const productos = await this.prisma.producto.findMany({
      where: { id: { in: dto.items.map((i) => i.productoId) } },
    });
    const productosPorId = new Map(productos.map((p) => [p.id, p]));

    const lineas = dto.items.map((item) => {
      const producto = productosPorId.get(item.productoId);
      if (!producto) throw new BadRequestException(`Producto ${item.productoId} no encontrado.`);
      const precioUnitarioQ = Number(producto.precioQ);
      return {
        productoId: producto.id,
        nombreSnapshot: producto.nombre,
        cantidad: item.cantidad,
        precioUnitarioQ,
        subtotalQ: precioUnitarioQ * item.cantidad,
      };
    });

    const montoTotalQ = lineas.reduce((acc, l) => acc + l.subtotalQ, 0);

    const venta = await this.prisma.venta.create({
      data: {
        clienteId: cliente?.id,
        montoTotalQ,
        notas: dto.notas,
        items: { create: lineas },
      },
      include: { items: true, cliente: true },
    });

    await this.pagosService.cobrarEfectivo({
      tipoReferencia: TipoPagoReferencia.VENTA,
      referenciaId: venta.id,
      montoQ: montoTotalQ,
    });

    return venta;
  }

  async listar(filtros: { desde?: string; hasta?: string }) {
    return this.prisma.venta.findMany({
      where: {
        ...(filtros.desde || filtros.hasta
          ? {
              creadoEn: {
                ...(filtros.desde ? { gte: new Date(filtros.desde) } : {}),
                ...(filtros.hasta ? { lte: this.finDelDia(filtros.hasta) } : {}),
              },
            }
          : {}),
      },
      include: { items: true, cliente: true },
      orderBy: { creadoEn: 'desc' },
    });
  }

  async obtenerPorId(id: string) {
    const venta = await this.prisma.venta.findUnique({ where: { id }, include: { items: true, cliente: true } });
    if (!venta) throw new NotFoundException('Venta no encontrada.');
    return venta;
  }

  async anular(id: string) {
    await this.obtenerPorId(id);
    return this.prisma.venta.update({ where: { id }, data: { estado: EstadoVenta.ANULADA } });
  }

  private finDelDia(fecha: string): Date {
    const d = new Date(fecha);
    d.setHours(23, 59, 59, 999);
    return d;
  }
}
