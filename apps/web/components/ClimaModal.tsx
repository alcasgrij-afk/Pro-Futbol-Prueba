'use client';

import type { ReservaDTO } from '@profutbol/shared-types';

/**
 * Caso especial de clima (clic derecho en Caja): lluvia o cancha inservible.
 * Dos salidas, ninguna con penalidad para el cliente:
 *  - Cancelar dejando el motivo CLIMA registrado (no cuenta como no-show).
 *  - Reprogramar a otra fecha disponible, que reusa el flujo de "Modificar".
 *
 * No hay devolucion automatica de dinero: el sistema no maneja reembolsos en
 * ningun modulo, asi que lo que ya se cobro se arregla en sede (se traslada a
 * la nueva fecha al reprogramar).
 */
export default function ClimaModal({
  reserva,
  cargando,
  onClose,
  onCancelar,
  onReprogramar,
}: {
  reserva: ReservaDTO;
  cargando: boolean;
  onClose: () => void;
  onCancelar: () => void;
  onReprogramar: () => void;
}) {
  const pagadoQ = reserva.pagadoQ ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h2 className="text-base font-bold text-navy">Caso especial: clima</h2>
          <p className="text-xs text-gray-500 mt-1">
            {reserva.cliente?.nombre ?? 'Cliente'} · {reserva.cancha?.nombre ?? ''} · {reserva.horaInicio}–
            {reserva.horaFin}
          </p>
        </div>

        <p className="text-sm text-gray-700">
          ¿Qué se hace con esta reserva? Ninguna de las dos opciones aplica penalidad al cliente.
        </p>

        {pagadoQ > 0 && (
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-300 rounded-md p-2">
            Esta reserva ya tiene Q{pagadoQ} cobrados. Si la cancelás, el dinero se arregla en sede (el sistema no hace
            devoluciones); si la reprogramás, el pago se traslada con ella.
          </p>
        )}

        <div className="space-y-2">
          <button
            onClick={onReprogramar}
            disabled={cargando}
            className="w-full min-h-12 px-4 text-sm font-semibold text-white bg-navy rounded-md disabled:opacity-50"
          >
            Reprogramar a otra fecha
          </button>
          <button
            onClick={onCancelar}
            disabled={cargando}
            className="w-full min-h-12 px-4 text-sm font-semibold text-sky-800 bg-sky-50 border border-sky-300 rounded-md hover:bg-sky-100 disabled:opacity-50"
          >
            {cargando ? 'Cancelando...' : 'Cancelar por clima'}
          </button>
          <button
            onClick={onClose}
            disabled={cargando}
            className="w-full min-h-11 px-4 text-sm font-medium text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Volver
          </button>
        </div>
      </div>
    </div>
  );
}
