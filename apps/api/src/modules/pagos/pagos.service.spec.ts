import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GatewayPago, TipoPagoReferencia } from '@profutbol/shared-types';
import { PagosService } from './pagos.service';

/**
 * Camino de dinero de los cobros en sede: saldo de una reserva, abonos (pago
 * parcial) y cobros manuales (arbitraje / conceptos del catalogo). Son las
 * reglas que no pueden fallar: cobrar mas de lo que se debe, cobrar sobre un
 * concepto inactivo, o dejar una reserva apartada sin cobro.
 */
describe('PagosService — cobros en sede', () => {
  let service: PagosService;
  let prisma: any;
  let reservasService: any;

  const reserva = { id: 'reserva-1', precioTotalQ: '250', cancha: { nombre: 'Cancha F5' } };

  beforeEach(() => {
    prisma = {
      pago: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { montoQ: null } }),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'pago-nuevo', ...data })),
        findUnique: jest.fn().mockResolvedValue({
          id: 'pago-nuevo',
          tipoReferencia: TipoPagoReferencia.RESERVA,
          referenciaId: 'reserva-1',
          estado: 'COMPLETADO',
          montoQ: '100',
          gateway: GatewayPago.EFECTIVO,
          numeroRecibo: 'REC-2026-000001',
          confirmadoEn: new Date(),
          codigoAutorizacion: null,
          conceptoSnapshot: null,
          nota: null,
          reserva: null,
        }),
      },
      reciboContador: { upsert: jest.fn().mockResolvedValue({ anio: 2026, ultimoNumero: 1 }) },
      arbitro: { findUnique: jest.fn() },
      conceptoPago: { findUnique: jest.fn() },
      academiaMensualidad: { findMany: jest.fn().mockResolvedValue([]) },
    };
    reservasService = {
      obtenerPorId: jest.fn().mockResolvedValue(reserva),
      confirmar: jest.fn().mockResolvedValue(reserva),
      cancelar: jest.fn().mockResolvedValue(reserva),
      crearReserva: jest.fn().mockResolvedValue(reserva),
    };
    service = new PagosService(prisma, reservasService, {} as any, new ConfigService({}));
  });

  describe('saldoReserva', () => {
    it('sin pagos, el saldo es el precio completo', async () => {
      const saldo = await service.saldoReserva('reserva-1');

      expect(saldo).toEqual({ reservaId: 'reserva-1', precioTotalQ: 250, pagadoQ: 0, saldoQ: 250 });
    });

    it('con abonos cobrados, descuenta lo pagado', async () => {
      prisma.pago.aggregate.mockResolvedValue({ _sum: { montoQ: '100' } });

      const saldo = await service.saldoReserva('reserva-1');

      expect(saldo.pagadoQ).toBe(100);
      expect(saldo.saldoQ).toBe(150);
    });

    it('nunca devuelve saldo negativo', async () => {
      prisma.pago.aggregate.mockResolvedValue({ _sum: { montoQ: '300' } });

      expect((await service.saldoReserva('reserva-1')).saldoQ).toBe(0);
    });
  });

  describe('cobrarAbonoReserva', () => {
    it('cobra el abono y confirma la reserva (queda apartada con saldo)', async () => {
      await service.cobrarAbonoReserva('reserva-1', { montoQ: 100, metodoPago: GatewayPago.EFECTIVO });

      expect(prisma.pago.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tipoReferencia: TipoPagoReferencia.RESERVA,
            referenciaId: 'reserva-1',
            montoQ: 100,
            estado: 'COMPLETADO',
            numeroRecibo: 'REC-2026-000001',
          }),
        }),
      );
      expect(reservasService.confirmar).toHaveBeenCalledWith('reserva-1', expect.any(String));
    });

    it('rechaza un abono mayor al saldo pendiente', async () => {
      prisma.pago.aggregate.mockResolvedValue({ _sum: { montoQ: '200' } }); // saldo 50

      await expect(
        service.cobrarAbonoReserva('reserva-1', { montoQ: 60, metodoPago: GatewayPago.EFECTIVO }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.pago.create).not.toHaveBeenCalled();
    });

    it('rechaza cobrar sobre una reserva ya pagada', async () => {
      prisma.pago.aggregate.mockResolvedValue({ _sum: { montoQ: '250' } });

      await expect(
        service.cobrarAbonoReserva('reserva-1', { montoQ: 10, metodoPago: GatewayPago.EFECTIVO }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('cobrarReservaSede con abono', () => {
    it('cobra solo el abono enviado, no el precio completo', async () => {
      await service.cobrarReservaSede({
        canchaId: 'cancha-1',
        clienteTelefono: '55551234',
        clienteNombre: 'Juan',
        fecha: '2026-10-27',
        horaInicio: '18:00',
        metodoPago: GatewayPago.EFECTIVO,
        montoQ: 100,
      });

      expect(prisma.pago.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ montoQ: 100 }) }),
      );
    });

    it('si el abono excede el precio, cancela la reserva recien creada (no deja el horario ocupado)', async () => {
      await expect(
        service.cobrarReservaSede({
          canchaId: 'cancha-1',
          clienteTelefono: '55551234',
          clienteNombre: 'Juan',
          fecha: '2026-10-27',
          horaInicio: '18:00',
          metodoPago: GatewayPago.EFECTIVO,
          montoQ: 400,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(reservasService.cancelar).toHaveBeenCalledWith('reserva-1');
      expect(prisma.pago.create).not.toHaveBeenCalled();
    });
  });

  describe('cobrarManual', () => {
    it('snapshotea el nombre del arbitro en el pago', async () => {
      prisma.arbitro.findUnique.mockResolvedValue({ id: 'arb-1', nombre: 'Carlos Ramirez', activo: true });

      await service.cobrarManual({
        tipo: TipoPagoReferencia.ARBITRO,
        referenciaId: 'arb-1',
        montoQ: 200,
        metodoPago: GatewayPago.EFECTIVO,
        nota: 'Partido F7 18:00',
      });

      expect(prisma.pago.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tipoReferencia: TipoPagoReferencia.ARBITRO,
            montoQ: 200,
            conceptoSnapshot: 'Arbitraje — Carlos Ramirez',
            nota: 'Partido F7 18:00',
            reservaId: null,
          }),
        }),
      );
      // Un cobro manual no toca reservas.
      expect(reservasService.confirmar).not.toHaveBeenCalled();
    });

    it('usa el nombre del concepto del catalogo', async () => {
      prisma.conceptoPago.findUnique.mockResolvedValue({ id: 'con-1', nombre: 'Pago especial', activo: true });

      await service.cobrarManual({
        tipo: TipoPagoReferencia.MANUAL,
        referenciaId: 'con-1',
        montoQ: 75,
        metodoPago: GatewayPago.TARJETA,
        codigoAutorizacion: '123456',
      });

      expect(prisma.pago.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ conceptoSnapshot: 'Pago especial', gateway: GatewayPago.TARJETA }),
        }),
      );
    });

    it('no cobra sobre un arbitro inactivo ni sobre uno que no existe', async () => {
      prisma.arbitro.findUnique.mockResolvedValue({ id: 'arb-1', nombre: 'Viejo', activo: false });
      await expect(
        service.cobrarManual({
          tipo: TipoPagoReferencia.ARBITRO,
          referenciaId: 'arb-1',
          montoQ: 100,
          metodoPago: GatewayPago.EFECTIVO,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);

      prisma.arbitro.findUnique.mockResolvedValue(null);
      await expect(
        service.cobrarManual({
          tipo: TipoPagoReferencia.ARBITRO,
          referenciaId: 'no-existe',
          montoQ: 100,
          metodoPago: GatewayPago.EFECTIVO,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(prisma.pago.create).not.toHaveBeenCalled();
    });

    it('no cobra sobre un concepto desactivado', async () => {
      prisma.conceptoPago.findUnique.mockResolvedValue({ id: 'con-1', nombre: 'Otro 1', activo: false });

      await expect(
        service.cobrarManual({
          tipo: TipoPagoReferencia.MANUAL,
          referenciaId: 'con-1',
          montoQ: 50,
          metodoPago: GatewayPago.EFECTIVO,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
