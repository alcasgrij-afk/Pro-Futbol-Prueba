'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { EstadoReserva, FormaPago, GatewayPago, TipoCancha, TipoReserva, type CanchaDTO, type ReservaDTO } from '@profutbol/shared-types';
import { api, ApiError, type PagoDetalle } from '../../../lib/api-client';
import { hoyISO } from '../../../lib/fechas';
import ConfirmarModal from '../../../components/ConfirmarModal';
import ReciboImprimible from '../../../components/ReciboImprimible';

// La cancha en este endpoint trae mas campos que CanchaDTO (horario de
// operacion); se piden directo con fetch (igual que WeekDatePicker, que ya
// consume /api/canchas sin pasar por api-client) en vez de ampliar el DTO
// compartido solo para esta pantalla.
type CanchaConHorario = CanchaDTO & {
  horaAperturaMinSemana: number;
  horaCierreMinSemana: number;
  horaAperturaMinFinde: number;
  horaCierreMinFinde: number;
  duracionBloqueMin: number;
};

// Sabado/domingo usan el horario de finde; lunes-viernes el de semana (ver
// mismo criterio en apps/api/.../disponibilidad.util.ts resolverHorario).
function esFinde(fecha: string): boolean {
  const [y, m, d] = fecha.split('-').map(Number);
  const dia = new Date(y, m - 1, d).getDay();
  return dia === 0 || dia === 6;
}

function resolverHorario(cancha: CanchaConHorario, fecha: string): { aperturaMin: number; cierreMin: number } {
  return esFinde(fecha)
    ? { aperturaMin: cancha.horaAperturaMinFinde, cierreMin: cancha.horaCierreMinFinde }
    : { aperturaMin: cancha.horaAperturaMinSemana, cierreMin: cancha.horaCierreMinSemana };
}

const ESTADOS_VISIBLES: EstadoReserva[] = [EstadoReserva.PENDIENTE_SEDE, EstadoReserva.PENDIENTE_PAGO, EstadoReserva.CONFIRMADA];

const ROW_MIN = 30;
const ROW_PX = 28;

const COLOR_ESTADO: Record<string, string> = {
  [EstadoReserva.CONFIRMADA]: 'bg-green-100 border-green-400 text-green-900',
  [EstadoReserva.PENDIENTE_SEDE]: 'bg-blue-100 border-blue-400 text-blue-900',
  [EstadoReserva.PENDIENTE_PAGO]: 'bg-yellow-100 border-yellow-400 text-yellow-900',
};

// ESPECIAL/ACADEMIA son bloqueos, no reservas pagadas: color propio para que
// el staff los distinga de un vistazo, sin importar su estado (siempre CONFIRMADA).
const COLOR_TIPO: Record<string, string> = {
  [TipoReserva.ESPECIAL]: 'bg-purple-100 border-purple-400 text-purple-900',
  [TipoReserva.ACADEMIA]: 'bg-orange-100 border-orange-400 text-orange-900',
};

const ETIQUETA_TIPO: Record<string, string> = {
  [TipoReserva.ESPECIAL]: 'Especial',
  [TipoReserva.ACADEMIA]: 'Academia',
};

const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

function minutosAHora(min: number): string {
  const h = Math.floor(min / 60).toString().padStart(2, '0');
  const m = (min % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

function horaAMinutos(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function minutosAhora(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

// Franjas de 30 min entre apertura y cierre de la cancha, dejando espacio
// para que el bloque completo (duracionBloqueMin) entre antes de cerrar.
// Un <select> con estas opciones (en vez de <input type="time">) es la
// forma mas simple de evitar que se elija un minuto fuera de la grilla.
// Si fecha es hoy, se descartan los horarios que ya pasaron (no se puede
// cobrar/reprogramar en sede para una hora que ya quedo atras).
function generarSlots(cancha: CanchaConHorario | undefined, fecha?: string): string[] {
  if (!cancha) return [];
  const { aperturaMin, cierreMin } = resolverHorario(cancha, fecha ?? hoyISO());
  const limiteMin = fecha === hoyISO() ? minutosAhora() : -1;
  const slots: string[] = [];
  for (let m = aperturaMin; m + cancha.duracionBloqueMin <= cierreMin; m += ROW_MIN) {
    if (m < limiteMin) continue;
    slots.push(minutosAHora(m));
  }
  return slots;
}

type Vista = 'F5' | 'F7' | 'AMBAS';

export default function CajaPage() {
  const [canchas, setCanchas] = useState<CanchaConHorario[] | null>(null);
  const [vista, setVista] = useState<Vista>('AMBAS');
  const [fecha, setFecha] = useState(hoyISO());
  const [reservas, setReservas] = useState<ReservaDTO[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [cobroModal, setCobroModal] = useState<{ canchaId: string; horaInicio: string } | null>(null);
  const [bloqueoModal, setBloqueoModal] = useState<TipoReserva.ESPECIAL | TipoReserva.ACADEMIA | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; reserva: ReservaDTO } | null>(null);
  const [modificarModal, setModificarModal] = useState<ReservaDTO | null>(null);
  const [eliminarModal, setEliminarModal] = useState<ReservaDTO | null>(null);
  const [accionCargando, setAccionCargando] = useState(false);
  const [recibo, setRecibo] = useState<PagoDetalle | null>(null);

  useEffect(() => {
    fetch('/api/canchas')
      .then((r) => r.json())
      .then(setCanchas)
      .catch(() => setError('No se pudieron cargar las canchas.'));
  }, []);

  const cargarReservas = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      setReservas(await api.listarReservas({ fecha }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudieron cargar las reservas.');
    } finally {
      setCargando(false);
    }
  }, [fecha]);

  useEffect(() => {
    cargarReservas();
  }, [cargarReservas]);

  useEffect(() => {
    if (!menu) return;
    const cerrar = () => setMenu(null);
    document.addEventListener('click', cerrar);
    return () => document.removeEventListener('click', cerrar);
  }, [menu]);

  useEffect(() => {
    if (recibo) window.print();
  }, [recibo]);

  const canchasMostradas = useMemo(() => {
    if (!canchas) return [];
    if (vista === 'AMBAS') return canchas;
    const tipo = vista === 'F5' ? TipoCancha.FUTBOL_5 : TipoCancha.FUTBOL_7;
    return canchas.filter((c) => c.tipo === tipo);
  }, [canchas, vista]);

  const { aperturaMin, filas } = useMemo(() => {
    if (canchasMostradas.length === 0) return { aperturaMin: 8 * 60, cierreMin: 22 * 60, filas: 0 };
    const horarios = canchasMostradas.map((c) => resolverHorario(c, fecha));
    const apertura = Math.min(...horarios.map((h) => h.aperturaMin));
    const cierre = Math.max(...horarios.map((h) => h.cierreMin));
    return { aperturaMin: apertura, cierreMin: cierre, filas: Math.round((cierre - apertura) / ROW_MIN) };
  }, [canchasMostradas, fecha]);

  const reservasPorCancha = useMemo(() => {
    const mapa = new Map<string, ReservaDTO[]>();
    for (const r of reservas) {
      if (!ESTADOS_VISIBLES.includes(r.estado)) continue;
      const lista = mapa.get(r.canchaId) ?? [];
      lista.push(r);
      mapa.set(r.canchaId, lista);
    }
    return mapa;
  }, [reservas]);

  function abrirCobroDesdeClick(canchaId: string, offsetY: number) {
    const bloque = Math.floor(offsetY / ROW_PX);
    const minutos = aperturaMin + bloque * ROW_MIN;
    if (fecha === hoyISO() && minutos < minutosAhora()) return; // hora ya pasada, no abrir el modal
    setCobroModal({ canchaId, horaInicio: minutosAHora(minutos) });
  }

  async function confirmarDesdeMenu(reserva: ReservaDTO) {
    setMenu(null);
    try {
      await api.confirmarReserva(reserva.id);
      await cargarReservas();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo confirmar la reserva.');
    }
  }

  async function ejecutarEliminar() {
    if (!eliminarModal) return;
    setAccionCargando(true);
    try {
      await api.cancelarReserva(eliminarModal.id);
      setEliminarModal(null);
      await cargarReservas();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cancelar la reserva.');
    } finally {
      setAccionCargando(false);
    }
  }

  const horasEje = Array.from({ length: filas }, (_, i) => aperturaMin + i * ROW_MIN);

  return (
    <>
    {/* Todo el contenido normal de la pantalla va aqui, oculto al imprimir;
        el recibo (fuera de este div) es lo unico que debe aparecer en el
        print — si el recibo estuviera anidado DENTRO de este print:hidden,
        un ancestro display:none se lo lleva con el, sin importar su propio
        print:block (ver ReciboImprimible). */}
    <div className="space-y-4 -mx-6 px-6 max-w-none print:hidden">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-bold text-navy">Caja — Cobro en sede</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setBloqueoModal(TipoReserva.ESPECIAL)}
            className="min-h-9 px-3 text-xs font-semibold rounded-md border border-purple-300 text-purple-700 hover:bg-purple-50"
          >
            Reserva Especial
          </button>
          <button
            onClick={() => setBloqueoModal(TipoReserva.ACADEMIA)}
            className="min-h-9 px-3 text-xs font-semibold rounded-md border border-orange-300 text-orange-700 hover:bg-orange-50"
          >
            Reserva Academia
          </button>
          <div className="flex gap-1 bg-white border border-gray-300 rounded-md p-1">
            {(['F5', 'F7', 'AMBAS'] as Vista[]).map((v) => (
              <button
                key={v}
                onClick={() => setVista(v)}
                className={`min-h-9 px-3 text-xs font-semibold rounded ${vista === v ? 'bg-navy text-white' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                {v === 'AMBAS' ? 'Ambas' : v}
              </button>
            ))}
          </div>
          <input
            type="date"
            aria-label="Fecha"
            value={fecha}
            min={hoyISO()}
            onChange={(e) => setFecha(e.target.value)}
            suppressHydrationWarning
            className="min-h-11 rounded-md border border-gray-500 px-3 text-sm"
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {cargando || !canchas ? (
        <p className="text-sm text-gray-500">Cargando...</p>
      ) : canchasMostradas.length === 0 ? (
        <p className="text-sm text-gray-500">No hay canchas activas de este tipo.</p>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-x-auto">
          <div className="flex" style={{ minWidth: canchasMostradas.length > 1 ? 640 : 340 }}>
            {/* Regla de horas */}
            <div className="flex-none w-14 border-r border-gray-200">
              <div className="h-10 border-b border-gray-200" />
              {horasEje.map((min) => (
                <div
                  key={min}
                  className={`flex items-center justify-end pr-1.5 border-b ${min % 60 === 0 ? 'border-gray-200' : 'border-gray-100'}`}
                  style={{ height: ROW_PX }}
                >
                  <span className={`text-[10px] ${min % 60 === 0 ? 'font-semibold text-gray-600' : 'text-gray-400'}`}>
                    {minutosAHora(min)}
                  </span>
                </div>
              ))}
            </div>

            {canchasMostradas.map((cancha) => {
              const bloques = reservasPorCancha.get(cancha.id) ?? [];
              return (
                <div key={cancha.id} className="flex-1 border-r border-gray-200 last:border-r-0 min-w-[220px]">
                  <div className="h-10 border-b border-gray-200 flex items-center justify-center font-semibold text-sm text-navy">
                    {cancha.nombre}
                  </div>
                  <div
                    className="relative cursor-pointer"
                    style={{ height: filas * ROW_PX }}
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      abrirCobroDesdeClick(cancha.id, e.clientY - rect.top);
                    }}
                  >
                    {horasEje.map((min, i) => (
                      <div
                        key={min}
                        className={`absolute left-0 right-0 border-b ${min % 60 === 0 ? 'border-gray-200' : 'border-gray-100'}`}
                        style={{ top: i * ROW_PX, height: ROW_PX }}
                      />
                    ))}

                    {bloques.map((r) => {
                      const horaInicioMin = horaAMinutos(r.horaInicio);
                      const horaFinMin = horaAMinutos(r.horaFin);
                      const top = ((horaInicioMin - aperturaMin) / ROW_MIN) * ROW_PX;
                      const alto = ((horaFinMin - horaInicioMin) / ROW_MIN) * ROW_PX;
                      return (
                        <div
                          key={r.id}
                          onClick={(e) => e.stopPropagation()}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setMenu({ x: e.clientX, y: e.clientY, reserva: r });
                          }}
                          className={`absolute left-0.5 right-0.5 rounded border px-1.5 py-0.5 text-[11px] leading-tight overflow-hidden ${COLOR_TIPO[r.tipo] ?? COLOR_ESTADO[r.estado] ?? 'bg-gray-100 border-gray-300'}`}
                          style={{ top, height: Math.max(alto, ROW_PX - 2) }}
                          title={`${r.cliente?.nombre ?? ''} · ${r.horaInicio}–${r.horaFin}${ETIQUETA_TIPO[r.tipo] ? ` · ${ETIQUETA_TIPO[r.tipo]}` : ''}`}
                        >
                          <div className="font-semibold truncate">
                            {ETIQUETA_TIPO[r.tipo] ? `${ETIQUETA_TIPO[r.tipo]} · ` : ''}{r.cliente?.nombre ?? '—'}
                          </div>
                          <div className="truncate opacity-80">{r.horaInicio}–{r.horaFin}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <p className="text-xs text-gray-500">Click en un espacio libre para cobrar en sede. Click derecho en una reserva para confirmar, modificar o eliminar.</p>

      {/* Menu contextual */}
      {menu && (
        <div
          className="fixed z-40 bg-white border border-gray-300 rounded-md shadow-lg text-sm py-1 min-w-[160px]"
          style={{ top: menu.y, left: menu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          {menu.reserva.estado !== EstadoReserva.CONFIRMADA && (
            <button onClick={() => confirmarDesdeMenu(menu.reserva)} className="w-full text-left px-3 py-2 hover:bg-gray-100">
              Confirmar
            </button>
          )}
          <button onClick={() => { setModificarModal(menu.reserva); setMenu(null); }} className="w-full text-left px-3 py-2 hover:bg-gray-100">
            Modificar
          </button>
          <button onClick={() => { setEliminarModal(menu.reserva); setMenu(null); }} className="w-full text-left px-3 py-2 hover:bg-red-50 text-red-600">
            Eliminar
          </button>
        </div>
      )}

      {cobroModal && (
        <CobrarSedeModal
          canchaId={cobroModal.canchaId}
          horaInicio={cobroModal.horaInicio}
          fecha={fecha}
          canchas={canchasMostradas}
          onClose={() => setCobroModal(null)}
          onCobrado={(detalle) => {
            setCobroModal(null);
            setRecibo(detalle);
            cargarReservas();
          }}
        />
      )}

      {bloqueoModal && (
        <BloqueoModal
          tipo={bloqueoModal}
          canchas={canchasMostradas}
          fecha={fecha}
          onClose={() => setBloqueoModal(null)}
          onCreado={() => {
            setBloqueoModal(null);
            cargarReservas();
          }}
        />
      )}

      {modificarModal && (
        <ModificarReservaModal
          reserva={modificarModal}
          canchas={canchas}
          onClose={() => setModificarModal(null)}
          onGuardado={() => {
            setModificarModal(null);
            cargarReservas();
          }}
        />
      )}

      {eliminarModal && (
        <ConfirmarModal
          titulo="Eliminar reserva"
          mensaje={`Vas a cancelar la reserva de ${eliminarModal.cliente?.nombre ?? 'este cliente'} a las ${eliminarModal.horaInicio}. Esta accion no se puede deshacer.`}
          onConfirmar={ejecutarEliminar}
          onCancelar={() => setEliminarModal(null)}
          cargando={accionCargando}
          variante="peligro"
        />
      )}
    </div>

    {recibo && (
        <>
          <ReciboImprimible
            titulo="Recibo de cobro — Cancha"
            subtitulo={`${recibo.canchaNombre ?? ''} · ${recibo.fecha?.slice(0, 10) ?? fecha} ${recibo.horaInicio ?? ''}`}
            cliente={{ nombre: recibo.clienteNombre ?? undefined, telefono: recibo.clienteTelefono ?? undefined }}
            metodoPago={recibo.gateway === GatewayPago.TARJETA ? `Tarjeta · autorización ${recibo.codigoAutorizacion ?? ''}` : 'Efectivo'}
            numeroRecibo={recibo.numeroRecibo}
            lineas={[{ label: recibo.canchaNombre ?? 'Reserva de cancha', detalle: 'Reserva de cancha', valor: `Q${recibo.montoQ}` }]}
            totalQ={recibo.montoQ}
          />
          <div className="print:hidden fixed bottom-4 right-4 flex gap-2 z-50">
            <button onClick={() => window.print()} className="min-h-11 px-4 bg-navy text-white rounded-md text-sm font-semibold shadow-lg">
              Imprimir recibo
            </button>
            <button onClick={() => setRecibo(null)} className="min-h-11 px-4 bg-white border border-gray-300 rounded-md text-sm font-semibold shadow-lg">
              Cerrar
            </button>
          </div>
        </>
      )}
    </>
  );
}

function CobrarSedeModal({
  canchaId,
  horaInicio,
  fecha,
  canchas,
  onClose,
  onCobrado,
}: {
  canchaId: string;
  horaInicio: string;
  fecha: string;
  canchas: CanchaConHorario[];
  onClose: () => void;
  onCobrado: (detalle: PagoDetalle) => void;
}) {
  const [form, setForm] = useState({
    canchaId,
    horaInicio,
    clienteNombre: '',
    clienteTelefono: '',
    metodoPago: GatewayPago.EFECTIVO as GatewayPago.EFECTIVO | GatewayPago.TARJETA,
    codigoAutorizacion: '',
  });
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vip, setVip] = useState<{ esValorado: boolean; siguienteEsGratis: boolean } | null>(null);
  const [aplicarGratis, setAplicarGratis] = useState(false);

  // Cliente Valorado (VIP): al completar el telefono (8 digitos) se consulta
  // si le toca la reserva gratis del ciclo (cada 6ta). Numero nuevo/sin VIP
  // simplemente no muestra nada (404 es el caso normal, se ignora).
  useEffect(() => {
    if (form.clienteTelefono.length !== 8) {
      setVip(null);
      setAplicarGratis(false);
      return;
    }
    let vigente = true;
    const t = setTimeout(async () => {
      try {
        const estado = await api.buscarClientePorTelefono(form.clienteTelefono);
        if (vigente) setVip({ esValorado: estado.esValorado, siguienteEsGratis: estado.siguienteEsGratis });
      } catch {
        if (vigente) setVip(null);
      }
    }, 400);
    return () => {
      vigente = false;
      clearTimeout(t);
    };
  }, [form.clienteTelefono]);

  const slots = useMemo(() => generarSlots(canchas.find((c) => c.id === form.canchaId), fecha), [canchas, form.canchaId, fecha]);

  function cambiarCancha(id: string) {
    const nuevosSlots = generarSlots(canchas.find((c) => c.id === id), fecha);
    setForm((f) => ({ ...f, canchaId: id, horaInicio: nuevosSlots.includes(f.horaInicio) ? f.horaInicio : (nuevosSlots[0] ?? f.horaInicio) }));
  }

  async function cobrar() {
    if (!form.clienteNombre.trim() || form.clienteTelefono.length < 8) {
      setError('Nombre y telefono son requeridos.');
      return;
    }
    if (form.metodoPago === GatewayPago.TARJETA && !/^\d{6,12}$/.test(form.codigoAutorizacion)) {
      setError('El código POS debe tener entre 6 y 12 dígitos.');
      return;
    }
    setCargando(true);
    setError(null);
    try {
      const detalle = await api.cobrarReservaSede({
        canchaId: form.canchaId,
        clienteNombre: form.clienteNombre.trim(),
        clienteTelefono: form.clienteTelefono.trim(),
        fecha,
        horaInicio: form.horaInicio,
        metodoPago: form.metodoPago,
        ...(form.metodoPago === GatewayPago.TARJETA ? { codigoAutorizacion: form.codigoAutorizacion } : {}),
        ...(aplicarGratis ? { gratis: true } : {}),
      });
      onCobrado(detalle);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cobrar la reserva.');
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4 space-y-3" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-base font-bold text-navy">Cobrar en sede</h2>

        <label className="block text-xs font-medium text-gray-600">
          Cancha
          <select
            value={form.canchaId}
            onChange={(e) => cambiarCancha(e.target.value)}
            className="mt-1 w-full min-h-11 rounded-md border border-gray-400 px-3 text-sm"
          >
            {canchas.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
        </label>

        <label className="block text-xs font-medium text-gray-600">
          Hora
          <select
            value={form.horaInicio}
            onChange={(e) => setForm({ ...form, horaInicio: e.target.value })}
            className="mt-1 w-full min-h-11 rounded-md border border-gray-400 px-3 text-sm bg-white"
          >
            {!slots.includes(form.horaInicio) && <option value={form.horaInicio}>{form.horaInicio}</option>}
            {slots.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>

        <label className="block text-xs font-medium text-gray-600">
          Nombre del cliente
          <input
            type="text"
            value={form.clienteNombre}
            onChange={(e) => setForm({ ...form, clienteNombre: e.target.value })}
            className="mt-1 w-full min-h-11 rounded-md border border-gray-400 px-3 text-sm"
          />
        </label>

        <label className="block text-xs font-medium text-gray-600">
          Telefono
          <input
            type="tel"
            inputMode="numeric"
            placeholder="XXXX-XXXX"
            value={form.clienteTelefono.length > 4 ? `${form.clienteTelefono.slice(0, 4)}-${form.clienteTelefono.slice(4)}` : form.clienteTelefono}
            onChange={(e) => setForm({ ...form, clienteTelefono: e.target.value.replace(/\D/g, '').slice(0, 8) })}
            className="mt-1 w-full min-h-11 rounded-md border border-gray-400 px-3 text-sm"
          />
        </label>

        {vip?.esValorado && vip.siguienteEsGratis && (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-2 space-y-1">
            <p className="text-xs font-semibold text-amber-800">Cliente VIP · esta reservación es GRATIS (6/6)</p>
            <label className="flex items-center gap-2 text-xs text-amber-800">
              <input type="checkbox" checked={aplicarGratis} onChange={(e) => setAplicarGratis(e.target.checked)} />
              Aplicar reservación gratis
            </label>
          </div>
        )}

        <label className="block text-xs font-medium text-gray-600">
          Metodo de pago
          <div className="mt-1 flex gap-1 bg-gray-50 border border-gray-300 rounded-md p-1">
            {([GatewayPago.EFECTIVO, GatewayPago.TARJETA] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setForm({ ...form, metodoPago: m })}
                className={`flex-1 min-h-9 text-xs font-semibold rounded ${form.metodoPago === m ? 'bg-navy text-white' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                {m === GatewayPago.EFECTIVO ? 'Efectivo' : 'Tarjeta'}
              </button>
            ))}
          </div>
        </label>

        {form.metodoPago === GatewayPago.TARJETA && (
          <label className="block text-xs font-medium text-gray-600">
            Código POS (autorización)
            <input
              type="text"
              inputMode="numeric"
              value={form.codigoAutorizacion}
              onChange={(e) => setForm({ ...form, codigoAutorizacion: e.target.value.replace(/\D/g, '').slice(0, 12) })}
              className="mt-1 w-full min-h-11 rounded-md border border-gray-400 px-3 text-sm"
            />
          </label>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} disabled={cargando} className="min-h-11 px-3 text-sm font-medium text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50">
            Cancelar
          </button>
          <button onClick={cobrar} disabled={cargando} className="min-h-11 px-3 text-sm font-medium text-white bg-navy rounded-md disabled:opacity-50">
            {cargando ? 'Cobrando...' : 'Cobrar'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ModificarReservaModal({
  reserva,
  canchas,
  onClose,
  onGuardado,
}: {
  reserva: ReservaDTO;
  canchas: CanchaConHorario[] | null;
  onClose: () => void;
  onGuardado: () => void;
}) {
  const [form, setForm] = useState({ canchaId: reserva.canchaId, fecha: reserva.fecha.slice(0, 10), horaInicio: reserva.horaInicio });
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const slots = useMemo(() => generarSlots((canchas ?? []).find((c) => c.id === form.canchaId), form.fecha), [canchas, form.canchaId, form.fecha]);

  function cambiarCancha(id: string) {
    const nuevosSlots = generarSlots((canchas ?? []).find((c) => c.id === id), form.fecha);
    setForm((f) => ({ ...f, canchaId: id, horaInicio: nuevosSlots.includes(f.horaInicio) ? f.horaInicio : (nuevosSlots[0] ?? f.horaInicio) }));
  }

  async function guardar() {
    setCargando(true);
    setError(null);
    try {
      await api.reprogramarReserva(reserva.id, form);
      onGuardado();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo reprogramar la reserva.');
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4 space-y-3" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-base font-bold text-navy">Modificar reserva</h2>
        <p className="text-xs text-gray-500">{reserva.cliente?.nombre}</p>

        <label className="block text-xs font-medium text-gray-600">
          Cancha
          <select
            value={form.canchaId}
            onChange={(e) => cambiarCancha(e.target.value)}
            className="mt-1 w-full min-h-11 rounded-md border border-gray-400 px-3 text-sm"
          >
            {(canchas ?? []).map((c) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
        </label>

        <label className="block text-xs font-medium text-gray-600">
          Fecha
          <input
            type="date"
            value={form.fecha}
            min={hoyISO()}
            onChange={(e) => setForm({ ...form, fecha: e.target.value })}
            className="mt-1 w-full min-h-11 rounded-md border border-gray-400 px-3 text-sm"
          />
        </label>

        <label className="block text-xs font-medium text-gray-600">
          Hora
          <select
            value={form.horaInicio}
            onChange={(e) => setForm({ ...form, horaInicio: e.target.value })}
            className="mt-1 w-full min-h-11 rounded-md border border-gray-400 px-3 text-sm bg-white"
          >
            {!slots.includes(form.horaInicio) && <option value={form.horaInicio}>{form.horaInicio}</option>}
            {slots.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} disabled={cargando} className="min-h-11 px-3 text-sm font-medium text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50">
            Cancelar
          </button>
          <button onClick={guardar} disabled={cargando} className="min-h-11 px-3 text-sm font-medium text-white bg-navy rounded-md disabled:opacity-50">
            {cargando ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}

function BloqueoModal({
  tipo,
  canchas,
  fecha,
  onClose,
  onCreado,
}: {
  tipo: TipoReserva.ESPECIAL | TipoReserva.ACADEMIA;
  canchas: CanchaConHorario[];
  fecha: string;
  onClose: () => void;
  onCreado: () => void;
}) {
  const [modo, setModo] = useState<'unico' | 'recurrente'>('unico');
  const [form, setForm] = useState({
    canchaId: canchas[0]?.id ?? '',
    clienteNombre: '',
    clienteTelefono: '',
    fecha,
    horaInicio: '08:00',
    horaFin: '09:00',
    diaSemana: new Date(`${fecha}T00:00:00`).getDay(),
    fechaInicio: fecha,
    fechaFin: '',
    indefinido: true,
  });
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const titulo = tipo === TipoReserva.ACADEMIA ? 'Reserva Academia' : 'Reserva Especial';

  async function guardar() {
    if (!form.clienteNombre.trim() || form.clienteTelefono.length < 8) {
      setError('Nombre y telefono son requeridos.');
      return;
    }
    if (form.horaFin <= form.horaInicio) {
      setError('La hora fin debe ser mayor que la hora de inicio.');
      return;
    }
    setCargando(true);
    setError(null);
    try {
      if (modo === 'unico') {
        await api.crearReservaBloqueo({
          canchaId: form.canchaId,
          clienteNombre: form.clienteNombre.trim(),
          clienteTelefono: form.clienteTelefono.trim(),
          fecha: form.fecha,
          horaInicio: form.horaInicio,
          horaFin: form.horaFin,
          tipo,
          formaPago: FormaPago.EN_SEDE,
        });
      } else {
        await api.crearReservaRecurrente({
          canchaId: form.canchaId,
          clienteNombre: form.clienteNombre.trim(),
          clienteTelefono: form.clienteTelefono.trim(),
          tipo,
          diaSemana: form.diaSemana,
          horaInicio: form.horaInicio,
          horaFin: form.horaFin,
          fechaInicio: form.fechaInicio,
          ...(!form.indefinido && form.fechaFin ? { fechaFin: form.fechaFin } : {}),
        });
      }
      onCreado();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo crear la reserva.');
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4 space-y-3" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-base font-bold text-navy">{titulo}</h2>

        <div className="flex gap-1 bg-gray-50 border border-gray-300 rounded-md p-1">
          {([['unico', 'Un día'], ['recurrente', 'Recurrente']] as const).map(([v, etiqueta]) => (
            <button
              key={v}
              type="button"
              onClick={() => setModo(v)}
              className={`flex-1 min-h-9 text-xs font-semibold rounded ${modo === v ? 'bg-navy text-white' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              {etiqueta}
            </button>
          ))}
        </div>

        <label className="block text-xs font-medium text-gray-600">
          Cancha
          <select
            value={form.canchaId}
            onChange={(e) => setForm({ ...form, canchaId: e.target.value })}
            className="mt-1 w-full min-h-11 rounded-md border border-gray-400 px-3 text-sm bg-white"
          >
            {canchas.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
        </label>

        {modo === 'unico' ? (
          <label className="block text-xs font-medium text-gray-600">
            Fecha
            <input
              type="date"
              value={form.fecha}
              min={hoyISO()}
              onChange={(e) => setForm({ ...form, fecha: e.target.value })}
              className="mt-1 w-full min-h-11 rounded-md border border-gray-400 px-3 text-sm"
            />
          </label>
        ) : (
          <>
            <label className="block text-xs font-medium text-gray-600">
              Día de la semana
              <select
                value={form.diaSemana}
                onChange={(e) => setForm({ ...form, diaSemana: Number(e.target.value) })}
                className="mt-1 w-full min-h-11 rounded-md border border-gray-400 px-3 text-sm bg-white"
              >
                {DIAS_SEMANA.map((d, i) => (
                  <option key={i} value={i}>{d}</option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-medium text-gray-600">
              Desde
              <input
                type="date"
                value={form.fechaInicio}
                min={hoyISO()}
                onChange={(e) => setForm({ ...form, fechaInicio: e.target.value })}
                className="mt-1 w-full min-h-11 rounded-md border border-gray-400 px-3 text-sm"
              />
            </label>
            <label className="flex items-center gap-2 text-xs font-medium text-gray-600">
              <input
                type="checkbox"
                checked={form.indefinido}
                onChange={(e) => setForm({ ...form, indefinido: e.target.checked })}
              />
              Indefinido (sin fecha de fin)
            </label>
            {!form.indefinido && (
              <label className="block text-xs font-medium text-gray-600">
                Hasta
                <input
                  type="date"
                  value={form.fechaFin}
                  min={form.fechaInicio}
                  onChange={(e) => setForm({ ...form, fechaFin: e.target.value })}
                  className="mt-1 w-full min-h-11 rounded-md border border-gray-400 px-3 text-sm"
                />
              </label>
            )}
          </>
        )}

        <div className="grid grid-cols-2 gap-2">
          <label className="block text-xs font-medium text-gray-600">
            Hora inicio
            <input
              type="time"
              step={1800}
              value={form.horaInicio}
              onChange={(e) => setForm({ ...form, horaInicio: e.target.value })}
              className="mt-1 w-full min-h-11 rounded-md border border-gray-400 px-3 text-sm"
            />
          </label>
          <label className="block text-xs font-medium text-gray-600">
            Hora fin
            <input
              type="time"
              step={1800}
              value={form.horaFin}
              onChange={(e) => setForm({ ...form, horaFin: e.target.value })}
              className="mt-1 w-full min-h-11 rounded-md border border-gray-400 px-3 text-sm"
            />
          </label>
        </div>

        <label className="block text-xs font-medium text-gray-600">
          Nombre del cliente
          <input
            type="text"
            value={form.clienteNombre}
            onChange={(e) => setForm({ ...form, clienteNombre: e.target.value })}
            className="mt-1 w-full min-h-11 rounded-md border border-gray-400 px-3 text-sm"
          />
        </label>

        <label className="block text-xs font-medium text-gray-600">
          Telefono
          <input
            type="tel"
            inputMode="numeric"
            placeholder="XXXX-XXXX"
            value={form.clienteTelefono.length > 4 ? `${form.clienteTelefono.slice(0, 4)}-${form.clienteTelefono.slice(4)}` : form.clienteTelefono}
            onChange={(e) => setForm({ ...form, clienteTelefono: e.target.value.replace(/\D/g, '').slice(0, 8) })}
            className="mt-1 w-full min-h-11 rounded-md border border-gray-400 px-3 text-sm"
          />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} disabled={cargando} className="min-h-11 px-3 text-sm font-medium text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50">
            Cancelar
          </button>
          <button onClick={guardar} disabled={cargando} className="min-h-11 px-3 text-sm font-medium text-white bg-navy rounded-md disabled:opacity-50">
            {cargando ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}
