'use client';

/**
 * Recibo/reporte imprimible generico, reusado por cobro en sede, venta de
 * productos y reporte de gastos. Oculto en pantalla salvo durante la
 * impresion (`print:block`); `window.print()` ya ofrece imprimir a una
 * impresora configurada o "Guardar como PDF", no hace falta generar PDFs.
 */
export default function ReciboImprimible({
  titulo,
  subtitulo,
  cliente,
  metodoPago,
  numeroRecibo,
  lineas,
  totalLabel = 'Total',
  totalQ,
  nota,
}: {
  titulo: string;
  subtitulo?: string;
  cliente?: { nombre?: string; telefono?: string };
  metodoPago?: string;
  numeroRecibo?: string | null;
  lineas: { label: string; detalle?: string; valor: string }[];
  totalLabel?: string;
  totalQ: number;
  nota?: string;
}) {
  return (
    <div className="hidden print:block fixed inset-0 bg-white text-black p-8 text-sm z-[100]">
      <div className="text-center mb-4">
        {/* eslint-disable-next-line @next/next/no-img-element -- recibo solo visible al imprimir, next/image no aplica */}
        <img src="/profutbollogo.png" alt="Pro Fútbol Antigua" className="h-10 mx-auto mb-1 grayscale" />
        <p className="font-black text-lg">Pro Fútbol Antigua</p>
        <p className="text-xs">C. de Chajón 4, Antigua Guatemala</p>
        <p className="font-bold mt-2">{titulo}</p>
        {numeroRecibo && <p className="text-xs">No. {numeroRecibo}</p>}
        {subtitulo && <p className="text-xs">{subtitulo}</p>}
        {cliente?.nombre && <p className="text-xs">Cliente: {cliente.nombre}{cliente.telefono ? ` · ${cliente.telefono}` : ''}</p>}
        {metodoPago && <p className="text-xs">Pago: {metodoPago}</p>}
        <p className="text-xs">{new Date().toLocaleString('es-GT')}</p>
      </div>
      <table className="w-full border-t border-b border-black py-2">
        <tbody>
          {lineas.map((l, i) => (
            <tr key={i} className="border-b border-dashed border-gray-400">
              <td className="py-1.5 align-top">
                <div className="font-medium">{l.label}</div>
                {l.detalle && <div className="text-xs text-gray-600">{l.detalle}</div>}
              </td>
              <td className="py-1.5 text-right align-top whitespace-nowrap">{l.valor}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex justify-between font-bold text-base mt-2">
        <span>{totalLabel}</span>
        <span>Q{totalQ.toLocaleString('es-GT', { minimumFractionDigits: 2 })}</span>
      </div>
      {nota && <p className="text-xs mt-4">{nota}</p>}
      <p className="text-center text-xs mt-6">¡Gracias!</p>
    </div>
  );
}
