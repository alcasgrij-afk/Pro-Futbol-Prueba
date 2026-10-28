import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { EstadoReserva, TipoReserva } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const RESERVAS_POR_CICLO_VIP = 6;

@Injectable()
export class ClientesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * El bot y el sitio web nunca piden "crear cuenta": el cliente se
   * identifica por su numero de telefono. Si ya existe, se reutiliza (y se
   * actualiza el nombre si vino uno nuevo); si no, se crea.
   */
  async buscarOCrear(telefono: string, nombre: string) {
    const telefonoNormalizado = this.normalizarTelefono(telefono);

    return this.prisma.cliente.upsert({
      where: { telefono: telefonoNormalizado },
      update: nombre ? { nombre } : {},
      create: { telefono: telefonoNormalizado, nombre },
    });
  }

  async buscarPorTelefono(telefono: string) {
    return this.prisma.cliente.findUnique({
      where: { telefono: this.normalizarTelefono(telefono) },
    });
  }

  /**
   * Para Caja: busca el cliente por telefono y, si es "Cliente Valorado"
   * (VIP), calcula si la siguiente reserva (NORMAL, pagada) le toca gratis
   * en el ciclo de 6 (cada 6ta reserva). Solo cuentan reservas CONFIRMADA
   * de tipo NORMAL (los bloqueos Especial/Academia no suman).
   */
  async buscarConEstadoValorado(telefono: string) {
    const cliente = await this.buscarPorTelefono(telefono);
    if (!cliente) throw new NotFoundException('Cliente no encontrado.');

    const valorado = await this.prisma.clienteValorado.findUnique({ where: { clienteId: cliente.id } });
    if (!valorado) {
      return { cliente, esValorado: false, totalReservas: 0, siguienteEsGratis: false };
    }

    const totalReservas = await this.prisma.reserva.count({
      where: { clienteId: cliente.id, estado: EstadoReserva.CONFIRMADA, tipo: TipoReserva.NORMAL },
    });
    const siguienteEsGratis = (totalReservas + 1) % RESERVAS_POR_CICLO_VIP === 0;

    return { cliente, esValorado: true, totalReservas, siguienteEsGratis };
  }

  /**
   * /admin/clientes: lista con buscador (nombre o telefono) y filtro de
   * activos. El estado VIP se adjunta en LOTE (2 consultas para toda la
   * pagina, nunca una por fila) con el mismo criterio de
   * buscarConEstadoValorado: ciclo de 6 sobre reservas CONFIRMADA+NORMAL.
   */
  async listar(filtros: { q?: string; activo?: boolean }) {
    const clientes = await this.prisma.cliente.findMany({
      where: {
        ...(filtros.activo !== undefined ? { activo: filtros.activo } : {}),
        ...(filtros.q
          ? {
              OR: [
                { nombre: { contains: filtros.q, mode: 'insensitive' } },
                { telefono: { contains: filtros.q } },
              ],
            }
          : {}),
      },
      orderBy: { creadoEn: 'desc' },
    });

    return this.adjuntarEstadoValorado(clientes);
  }

  async obtenerPorId(id: string) {
    const cliente = await this.prisma.cliente.findUnique({ where: { id } });
    if (!cliente) throw new NotFoundException('Cliente no encontrado.');
    const [conValorado] = await this.adjuntarEstadoValorado([cliente]);
    return conValorado;
  }

  private async adjuntarEstadoValorado<T extends { id: string }>(clientes: T[]) {
    const ids = clientes.map((c) => c.id);
    if (ids.length === 0) return [];

    const [valorados, conteos] = await Promise.all([
      this.prisma.clienteValorado.findMany({ where: { clienteId: { in: ids } }, select: { clienteId: true } }),
      this.prisma.reserva.groupBy({
        by: ['clienteId'],
        where: { clienteId: { in: ids }, estado: EstadoReserva.CONFIRMADA, tipo: TipoReserva.NORMAL },
        _count: { _all: true },
      }),
    ]);

    const idsValorados = new Set(valorados.map((v) => v.clienteId));
    const conteoPorCliente = new Map(conteos.map((c) => [c.clienteId, c._count._all]));

    return clientes.map((cliente) => {
      const esValorado = idsValorados.has(cliente.id);
      const totalReservas = conteoPorCliente.get(cliente.id) ?? 0;
      return {
        ...cliente,
        esValorado,
        totalReservas,
        siguienteEsGratis: esValorado && (totalReservas + 1) % RESERVAS_POR_CICLO_VIP === 0,
      };
    });
  }

  async actualizar(id: string, dto: { nombre?: string; telefono?: string; email?: string; dpi?: string }) {
    await this.obtenerPorId(id);
    try {
      return await this.prisma.cliente.update({
        where: { id },
        data: {
          ...(dto.nombre !== undefined ? { nombre: dto.nombre } : {}),
          ...(dto.telefono !== undefined ? { telefono: this.normalizarTelefono(dto.telefono) } : {}),
          ...(dto.email !== undefined ? { email: dto.email } : {}),
          ...(dto.dpi !== undefined ? { dpi: dto.dpi } : {}),
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const campo = (err.meta?.target as string[] | undefined)?.includes('dpi') ? 'DPI' : 'telefono';
        throw new BadRequestException(`Ya existe otro cliente con ese ${campo}.`);
      }
      throw err;
    }
  }

  async desactivar(id: string) {
    await this.obtenerPorId(id);
    return this.prisma.cliente.update({ where: { id }, data: { activo: false } });
  }

  async activar(id: string) {
    await this.obtenerPorId(id);
    return this.prisma.cliente.update({ where: { id }, data: { activo: true } });
  }

  /** Otorga el estatus de Cliente Valorado (VIP). Idempotente. */
  async otorgarValorado(id: string) {
    await this.obtenerPorId(id);
    await this.prisma.clienteValorado.upsert({
      where: { clienteId: id },
      create: { clienteId: id },
      update: {},
    });
    return this.obtenerPorId(id);
  }

  /** Quita el estatus VIP. Idempotente: no falla si ya no era VIP. */
  async quitarValorado(id: string) {
    await this.obtenerPorId(id);
    await this.prisma.clienteValorado.deleteMany({ where: { clienteId: id } });
    return this.obtenerPorId(id);
  }

  private normalizarTelefono(telefono: string): string {
    // Deja solo digitos (quita espacios, guiones, "+", parentesis).
    return telefono.replace(/[^\d]/g, '');
  }
}
