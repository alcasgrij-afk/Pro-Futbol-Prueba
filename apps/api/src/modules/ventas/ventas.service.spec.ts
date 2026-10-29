import { BadRequestException } from '@nestjs/common';
import { GatewayPago } from '@profutbol/shared-types';
import { VentasService } from './ventas.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ClientesService } from '../clientes/clientes.service';
import { PagosService } from '../pagos/pagos.service';

describe('VentasService.crear', () => {
  let service: VentasService;
  let prisma: any;
  let clientesService: any;
  let pagosService: any;

  const producto = { id: 'prod-1', nombre: 'Agua', precioQ: '10' };

  beforeEach(() => {
    prisma = {
      producto: { findMany: jest.fn().mockResolvedValue([producto]) },
      venta: {
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({ id: 'venta-1', clienteId: data.clienteId ?? null, montoTotalQ: data.montoTotalQ, items: [] }),
        ),
      },
    };
    clientesService = { buscarOCrear: jest.fn() };
    pagosService = {
      cobrarEfectivo: jest.fn().mockResolvedValue({
        numeroRecibo: 'REC-2026-000001',
        gateway: GatewayPago.EFECTIVO,
        codigoAutorizacion: null,
      }),
    };
    service = new VentasService(
      prisma as unknown as PrismaService,
      clientesService as unknown as ClientesService,
      pagosService as unknown as PagosService,
    );
  });

  it('cobra en efectivo por defecto cuando no se especifica metodoPago', async () => {
    await service.crear({ items: [{ productoId: 'prod-1', cantidad: 2 }] });

    expect(pagosService.cobrarEfectivo).toHaveBeenCalledWith(
      expect.objectContaining({ montoQ: 20, gateway: undefined, codigoAutorizacion: undefined }),
    );
  });

  it('pasa metodoPago=TARJETA y codigoAutorizacion al cobro, y los expone en la venta devuelta', async () => {
    pagosService.cobrarEfectivo.mockResolvedValue({
      numeroRecibo: 'REC-2026-000002',
      gateway: GatewayPago.TARJETA,
      codigoAutorizacion: '123456',
    });

    const venta = await service.crear({
      items: [{ productoId: 'prod-1', cantidad: 1 }],
      metodoPago: GatewayPago.TARJETA,
      codigoAutorizacion: '123456',
    });

    expect(pagosService.cobrarEfectivo).toHaveBeenCalledWith(
      expect.objectContaining({ gateway: GatewayPago.TARJETA, codigoAutorizacion: '123456' }),
    );
    expect(venta.gateway).toBe(GatewayPago.TARJETA);
    expect(venta.codigoAutorizacion).toBe('123456');
  });

  it('rechaza un item con producto inexistente', async () => {
    await expect(
      service.crear({ items: [{ productoId: 'no-existe', cantidad: 1 }] }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(pagosService.cobrarEfectivo).not.toHaveBeenCalled();
  });
});
