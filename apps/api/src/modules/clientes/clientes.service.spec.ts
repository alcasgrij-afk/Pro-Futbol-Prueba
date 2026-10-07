import { NotFoundException } from '@nestjs/common';
import { EstadoReserva, TipoReserva } from '@prisma/client';
import { ClientesService } from './clientes.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('ClientesService.buscarConEstadoValorado', () => {
  let service: ClientesService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      cliente: { findUnique: jest.fn() },
      clienteValorado: { findUnique: jest.fn() },
      reserva: { count: jest.fn() },
    };
    service = new ClientesService(prisma as unknown as PrismaService);
  });

  it('lanza NotFoundException si el telefono no tiene cliente', async () => {
    prisma.cliente.findUnique.mockResolvedValue(null);
    await expect(service.buscarConEstadoValorado('55551234')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('cliente normal (no valorado) nunca tiene reserva gratis', async () => {
    prisma.cliente.findUnique.mockResolvedValue({ id: 'c1' });
    prisma.clienteValorado.findUnique.mockResolvedValue(null);
    const r = await service.buscarConEstadoValorado('55551234');
    expect(r).toEqual({ cliente: { id: 'c1' }, esValorado: false, totalReservas: 0, siguienteEsGratis: false });
    expect(prisma.reserva.count).not.toHaveBeenCalled();
  });

  it('VIP con 5 reservas confirmadas: la 6ta es gratis', async () => {
    prisma.cliente.findUnique.mockResolvedValue({ id: 'c1' });
    prisma.clienteValorado.findUnique.mockResolvedValue({ id: 'v1', clienteId: 'c1' });
    prisma.reserva.count.mockResolvedValue(5);
    const r = await service.buscarConEstadoValorado('55551234');
    expect(prisma.reserva.count).toHaveBeenCalledWith({
      where: { clienteId: 'c1', estado: EstadoReserva.CONFIRMADA, tipo: TipoReserva.NORMAL },
    });
    expect(r.esValorado).toBe(true);
    expect(r.totalReservas).toBe(5);
    expect(r.siguienteEsGratis).toBe(true);
  });

  it('VIP con 6 reservas confirmadas: la 7ma no es gratis (ciclo ya se aplico)', async () => {
    prisma.cliente.findUnique.mockResolvedValue({ id: 'c1' });
    prisma.clienteValorado.findUnique.mockResolvedValue({ id: 'v1', clienteId: 'c1' });
    prisma.reserva.count.mockResolvedValue(6);
    const r = await service.buscarConEstadoValorado('55551234');
    expect(r.siguienteEsGratis).toBe(false);
  });
});
