import { Injectable, NotFoundException } from '@nestjs/common';
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

  private normalizarTelefono(telefono: string): string {
    // Deja solo digitos (quita espacios, guiones, "+", parentesis).
    return telefono.replace(/[^\d]/g, '');
  }
}
