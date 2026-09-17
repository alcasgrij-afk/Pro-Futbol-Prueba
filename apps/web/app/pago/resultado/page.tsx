'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';

type EstadoPago = 'CARGANDO' | 'PENDIENTE' | 'COMPLETADO' | 'FALLIDO' | 'ERROR';

/**
 * Pagina de resultado de pago. `?ref=<paymentId>&simulado=1` apunta a un pago
 * del gateway. En desarrollo (simulado) se confirma localmente; luego se hace
 * polling del estado hasta que el pago quede COMPLETADO o FALLIDO.
 */
function Resultado() {
  const params = useSearchParams();
  const ref = params.get('ref');
  const simulado = params.get('simulado') === '1';

  const [estado, setEstado] = useState<EstadoPago>('CARGANDO');
  const [detalle, setDetalle] = useState<{ montoQ: number; canchaNombre?: string; tipoReferencia?: string; descripcion?: string } | null>(null);

  useEffect(() => {
    if (!ref) {
      setEstado('ERROR');
      return;
    }

    let cancelado = false;
    let tiempo: number | undefined;
    let reintentos = 0;
    const MAX_INTENTOS = 15;

    async function confirmarSimulado() {
      const r = await fetch('/api/payments/simulado/confirmar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId: ref }),
      });
      if (!r.ok) throw new Error('No se pudo confirmar el pago simulado.');
    }

    async function consultar(): Promise<void> {
      const r = await fetch(`/api/payments/${ref}`);
      if (!r.ok) throw new Error('No se encontro el pago.');
      const pago = await r.json();
      if (cancelado) return;
      setDetalle({ montoQ: pago.montoQ, canchaNombre: pago.canchaNombre, tipoReferencia: pago.tipoReferencia, descripcion: pago.descripcion });

      if (pago.estado === 'COMPLETADO') return setEstado('COMPLETADO');
      if (pago.estado === 'FALLIDO' || pago.estado === 'CANCELADO') return setEstado('FALLIDO');

      if (reintentos++ >= MAX_INTENTOS) return setEstado('PENDIENTE');
      tiempo = window.setTimeout(consultar, 2000);
    }

    (async () => {
      try {
        if (simulado) await confirmarSimulado();
        await consultar();
      } catch {
        if (!cancelado) setEstado('ERROR');
      }
    })();

    return () => {
      cancelado = true;
      if (tiempo) window.clearTimeout(tiempo);
    };
  }, [ref, simulado]);

  if (estado === 'ERROR') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-navy px-4">
        <Card title="Pago no encontrado">
          <p className="text-sm text-gray-600">
            No pudimos verificar tu pago. Volve a la pagina de reservas e intentalo de nuevo.
          </p>
          <BotonVolver />
        </Card>
      </div>
    );
  }

  if (estado === 'CARGANDO') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-navy px-4">
        <Card title="Procesando pago">
          <p className="text-sm text-gray-500">Espera un momento, estamos confirmando tu reserva...</p>
        </Card>
      </div>
    );
  }

  const titulo =
    estado === 'COMPLETADO' ? '¡Pago confirmado!' : estado === 'PENDIENTE' ? 'Pago pendiente' : 'El pago no se completo';

  return (
    <div className="min-h-screen flex items-center justify-center bg-navy px-4">
      <Card title={titulo}>
        {detalle && (
          <div className="text-sm text-gray-600 space-y-1">
            {detalle.descripcion && <p>{detalle.descripcion}</p>}
            {!detalle.descripcion && detalle.canchaNombre && <p>Cancha: <span className="font-medium">{detalle.canchaNombre}</span></p>}
            <p>Monto: <span className="font-medium">Q{detalle.montoQ}</span></p>
          </div>
        )}
        {estado === 'PENDIENTE' ? (
          <p className="text-sm text-gray-500 mt-2">
            Sigue pendiente. Te avisamos por el chat cuando se confirme.
          </p>
        ) : (
          <p className="text-sm text-gray-600 mt-2">
            {estado === 'COMPLETADO'
              ? (detalle?.tipoReferencia === 'EQUIPO'
                  ? 'Tu inscripcion al torneo esta confirmada.'
                  : 'Tu reserva quedo confirmada. ¡Nos vemos en la cancha!')
              : 'No se registro un cargo. Intenta pagar de nuevo o elegi pagar en sede.'}
          </p>
        )}
        <BotonVolver />
      </Card>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center space-y-3">
      <h1 className="text-xl font-bold text-navy">{title}</h1>
      {children}
    </div>
  );
}

function BotonVolver() {
  return (
    <Link
      href="/"
      className="inline-block mt-3 text-sm font-semibold text-white bg-navy rounded px-4 py-2"
    >
      Volver al inicio
    </Link>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-navy" />}>
      <Resultado />
    </Suspense>
  );
}
