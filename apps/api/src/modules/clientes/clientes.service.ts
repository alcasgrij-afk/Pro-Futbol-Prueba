import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

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

  private normalizarTelefono(telefono: string): string {
    // Deja solo digitos (quita espacios, guiones, "+", parentesis).
    return telefono.replace(/[^\d]/g, '');
  }
}
