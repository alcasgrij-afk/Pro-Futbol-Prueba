'use client';

import { useEffect, useId, useRef } from 'react';

/**
 * Modal de confirmacion accesible, compartido por todo el panel admin.
 * Reemplaza a los confirm() nativos (m13): foco inicial, trampa de Tab y
 * cierre con Escape o click en el fondo. En modo oscuro del panel admin
 * los controles viven dentro del panel blanco, que ya tiene contraste.
 *
 * `variante="peligro"` pinta el boton de confirmar rojo para acciones
 * irreversibles (cancelar reserva, desactivar alumno), distinguiendolas de
 * las confirmaciones benignas.
 */
export default function ConfirmarModal({
  titulo,
  mensaje,
  onConfirmar,
  onCancelar,
  cargando,
  variante = 'primario',
}: {
  titulo: string;
  mensaje: string;
  onConfirmar: () => void;
  onCancelar: () => void;
  cargando: boolean;
  variante?: 'primario' | 'peligro';
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const prevRef = useRef<HTMLElement | null>(null);
  const ids = useId();

  // Refs con el valor actual: el listener se registra UNA vez (deps vacias) y
  // no se re-ejecuta en cada re-render del padre (ej. el refresco silencioso
  // de 30s del dashboard), que romperia el foco del teclado a mitad de dialogo.
  const cancelarRef = useRef(onCancelar);
  cancelarRef.current = onCancelar;
  const cargandoRef = useRef(cargando);
  cargandoRef.current = cargando;

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const activo = document.activeElement as HTMLElement | null;
    if (activo && !panel.contains(activo)) prevRef.current = activo;
    panel.focus();

    function key(e: KeyboardEvent) {
      if (e.key === 'Escape' && !cargandoRef.current) cancelarRef.current();
      // Trap de Tab simple: hace loop entre el primer y ultimo control del dialogo.
      if (e.key === 'Tab' && panel) {
        const f = panel.querySelectorAll<HTMLElement>('button, [href]');
        const first = f[0];
        const last = f[f.length - 1];
        if (!first || !last) return;
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }

    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('keydown', key);
      prevRef.current?.focus();
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={() => !cargando && onCancelar()}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${ids}-titulo`}
        aria-describedby={`${ids}-descripcion`}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4 space-y-3 outline-none"
      >
        <h2 id={`${ids}-titulo`} className="text-base font-bold text-navy">{titulo}</h2>
        <p id={`${ids}-descripcion`} className="text-sm text-gray-600">{mensaje}</p>
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onCancelar}
            disabled={cargando}
            className="min-h-11 px-3 text-sm font-medium text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirmar}
            disabled={cargando}
            className={`min-h-11 px-3 text-sm font-medium text-white rounded-md disabled:opacity-50 flex items-center gap-2 ${
              variante === 'peligro' ? 'bg-red hover:bg-red/90' : 'bg-navy hover:bg-navy/90'
            }`}
          >
            {cargando && (
              <span className="inline-block h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}