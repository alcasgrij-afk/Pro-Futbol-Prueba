'use client';

import { useState } from 'react';
import { GatewayPago, type ReservaDTO } from '@profutbol/shared-types';
import { api, ApiError, type PagoDetalle } from '../lib/api-client';

/**
 * Cobro del saldo pendiente de una reserva abonada (clic derecho en Caja).
 * El default es cobrar todo lo que falta; se puede cobrar menos y dejar saldo
 * otra vez. El saldo real lo valida el backend, aqui solo se evita mandar un
 * monto imposible.
 */
export default function CobrarSaldoModal({
  reserva,
  onClose,
  onCobrado,
}: {
  reserva: ReservaDTO;
  onClose: () => void;
  onCobrado: (detalle: PagoDetalle, nota?: string) => void;
}) {
  const saldoQ = reserva.saldoQ ?? 0;
  const [monto, setMonto] = useState(String(saldoQ));
  const [metodoPago, setMetodoPago] = useState<GatewayPago.EFECTIVO | GatewayPago.TARJETA>(GatewayPago.EFECTIVO);
  const [codigoAutorizacion, setCodigoAutorizacion] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const montoNumero = Number(monto);
  const tarjetaValida = metodoPago !== GatewayPago.TARJETA || /^\d{6,12}$/.test(codigoAutorizacion);
  const valido = montoNumero > 0 && montoNumero <= saldoQ && tarjetaValida && !cargando;

  async function cobrar() {
    if (!valido) return;
    setCargando(true);
    setError(null);
    try {
      const detalle = await api.cobrarAbonoReserva(reserva.id, {
        montoQ: montoNumero,
        metodoPago,
        ...(metodoPago === GatewayPago.TARJETA ? { codigoAutorizacion } : {}),
      });
      const restante = Math.round((saldoQ - montoNumero) * 100) / 100;
      onCobrado(detalle, restante > 0 ? `Saldo pendiente: Q${restante}` : 'Reserva pagada por completo.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cobrar el saldo.');
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4 space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-bold text-navy">Cobrar saldo pendiente</h2>

        <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm">
          <p className="font-semibold">{reserva.cliente?.nombre ?? 'Cliente'}</p>
          <p className="text-xs text-gray-600">
            {reserva.cancha?.nombre ?? ''} · {reserva.horaInicio}–{reserva.horaFin}
          </p>
          <p className="text-xs text-gray-600 mt-1">
            Precio Q{reserva.precioTotalQ} · Abonado Q{reserva.pagadoQ ?? 0} ·{' '}
            <span className="font-bold text-red-700">Saldo Q{saldoQ}</span>
          </p>
        </div>

        <label className="block text-xs font-medium text-gray-600">
          Monto a cobrar (Q)
          <input
            type="number"
            inputMode="decimal"
            min="0"
            max={saldoQ}
            step="0.01"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            className="mt-1 w-full min-h-11 rounded-md border border-gray-400 px-3 text-sm"
          />
        </label>
        {montoNumero > saldoQ && <p className="text-xs text-red-600">No puede ser mayor al saldo (Q{saldoQ}).</p>}

        <label className="block text-xs font-medium text-gray-600">
          Método de pago
          <div className="mt-1 flex gap-1 bg-gray-50 border border-gray-300 rounded-md p-1">
            {([GatewayPago.EFECTIVO, GatewayPago.TARJETA] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMetodoPago(m)}
                className={`flex-1 min-h-9 text-xs font-semibold rounded ${metodoPago === m ? 'bg-navy text-white' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                {m === GatewayPago.EFECTIVO ? 'Efectivo' : 'Tarjeta'}
              </button>
            ))}
          </div>
        </label>

        {metodoPago === GatewayPago.TARJETA && (
          <label className="block text-xs font-medium text-gray-600">
            Código POS (autorización)
            <input
              type="text"
              inputMode="numeric"
              value={codigoAutorizacion}
              onChange={(e) => setCodigoAutorizacion(e.target.value.replace(/\D/g, '').slice(0, 12))}
              className="mt-1 w-full min-h-11 rounded-md border border-gray-400 px-3 text-sm"
            />
          </label>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            disabled={cargando}
            className="min-h-11 px-3 text-sm font-medium text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            onClick={cobrar}
            disabled={!valido}
            className="min-h-11 px-4 text-sm font-semibold text-white bg-navy rounded-md disabled:opacity-40"
          >
            {cargando ? 'Cobrando...' : 'Cobrar e imprimir'}
          </button>
        </div>
      </div>
    </div>
  );
}
