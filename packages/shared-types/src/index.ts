// =============================================================================
// Tipos y contratos compartidos entre apps/api y apps/web.
// Cualquier cambio en la forma de los datos que viaja entre el backend y el
// panel admin debe reflejarse aqui primero.
// =============================================================================

// ---------- Enums de negocio (deben coincidir con prisma/schema.prisma) ----------

export enum TipoCancha {
  FUTBOL_5 = 'FUTBOL_5',
  FUTBOL_7 = 'FUTBOL_7',
}

export enum EstadoReserva {
  PENDIENTE_PAGO = 'PENDIENTE_PAGO', // eligio pagar en linea, esperando webhook/confirmacion
  PENDIENTE_SEDE = 'PENDIENTE_SEDE', // eligio pagar en sede, esperando 30 min
  CONFIRMADA = 'CONFIRMADA',
  LIBERADA = 'LIBERADA', // timeout sin pago, horario liberado
  CANCELADA = 'CANCELADA', // cancelada por el cliente o el admin
}

export enum FormaPago {
  ANTICIPADO_EN_LINEA = 'ANTICIPADO_EN_LINEA',
  EN_SEDE = 'EN_SEDE',
}

// NORMAL = reserva pagada de un cliente. ESPECIAL/ACADEMIA = bloqueo de
// horario pre-arreglado (sin cobro), creado por staff en /admin/caja.
export enum TipoReserva {
  NORMAL = 'NORMAL',
  ESPECIAL = 'ESPECIAL',
  ACADEMIA = 'ACADEMIA',
}

export enum RolUsuario {
  ADMIN = 'ADMIN',
  RECEPCION = 'RECEPCION',
  ENTRENADOR = 'ENTRENADOR',
}

export enum EstadoPago {
  PENDIENTE = 'PENDIENTE',
  COMPLETADO = 'COMPLETADO',
  FALLIDO = 'FALLIDO',
  CANCELADO = 'CANCELADO',
}

export enum GatewayPago {
  BAC = 'BAC',
  NEONET = 'NEONET',
  EFECTIVO = 'EFECTIVO',
  // Cobro con POS fisico en sede (no pasa por un gateway de redireccion).
  TARJETA = 'TARJETA',
  // Gateway de desarrollo explicito: siempre genera la redireccion simulada.
  SIMULADO = 'SIMULADO',
}

export enum TipoPagoReferencia {
  RESERVA = 'RESERVA',
  EQUIPO = 'EQUIPO',
  MENSUALIDAD = 'MENSUALIDAD',
  VENTA = 'VENTA',
}

export enum ProductoCategoria {
  TIENDA = 'TIENDA',
  ACADEMIA = 'ACADEMIA',
}

export enum EstadoVenta {
  COMPLETADA = 'COMPLETADA',
  ANULADA = 'ANULADA',
}

export enum GastoCategoria {
  MANTENIMIENTO = 'MANTENIMIENTO',
  SUMINISTROS = 'SUMINISTROS',
  SERVICIOS = 'SERVICIOS',
  NOMINA = 'NOMINA',
  OTROS = 'OTROS',
}

export enum FormatoTorneo {
  LIGA = 'LIGA',
  ELIMINACION_DIRECTA = 'ELIMINACION_DIRECTA',
}

export enum EstadoTorneo {
  PROXIMO = 'PROXIMO',
  INSCRIPCIONES_ABIERTAS = 'INSCRIPCIONES_ABIERTAS',
  EN_CURSO = 'EN_CURSO',
  FINALIZADO = 'FINALIZADO',
  CANCELADO = 'CANCELADO',
}

// ---------- Bot: estados de la maquina de conversacion (ver Diagrama 3) ----------

export enum BotEstado {
  INICIO = 'INICIO',
  MENU_CANCHA = 'MENU_CANCHA',
  MENU_HORARIO = 'MENU_HORARIO',
  CONFIRMA_PRECIO = 'CONFIRMA_PRECIO',
  PEDIR_CONTACTO = 'PEDIR_CONTACTO',
  ESPERA_PAGO = 'ESPERA_PAGO',
  RESERVA_PENDIENTE = 'RESERVA_PENDIENTE',
  RESERVA_CONFIRMADA = 'RESERVA_CONFIRMADA',
  RESERVA_LIBERADA = 'RESERVA_LIBERADA',
  CANCELADA = 'CANCELADA',
}

// ---------- Chat: mensajes y sesion del chatbot web (transport Socket.IO) ----------

/** Tipo de mensaje saliente que puede producir la maquina de estados. */
export type MensajeSaliente =
  | { tipo: 'texto'; texto: string }
  | { tipo: 'lista'; texto: string; opciones: { id: string; titulo: string }[] }
  | { tipo: 'botones'; texto: string; opciones: { id: string; titulo: string }[] }
  | { tipo: 'pago'; texto: string; gateway: GatewayPago; reservaId: string; montoQ: number }
  | { tipo: 'pedir_contacto'; texto: string };

/** Sesion de chat persistida en Redis bajo la llave `session:{sessionId}`. */
export interface SesionChat {
  sessionId: string;
  nombre?: string;
  telefono?: string;
  estado: BotEstado;
  canchaId?: string;
  canchaNombre?: string;
  fecha?: string; // YYYY-MM-DD
  horaInicio?: string; // HH:mm
  formaPago?: FormaPago;
  reservaId?: string;
  actualizadoEn: string; // ISO timestamp
}

// ---------- DTOs / formas de datos que cruzan la red ----------

export interface CanchaDTO {
  id: string;
  nombre: string;
  tipo: TipoCancha;
  precioAnticipadoQ: number;
  precioSedeQ: number;
  activa: boolean;
}

export interface BloqueHorario {
  horaInicio: string; // "18:00"
  horaFin: string; // "19:00"
  disponible: boolean;
}

export interface DisponibilidadResponse {
  canchaId: string;
  fecha: string; // "2026-07-20"
  bloques: BloqueHorario[];
}

export interface ClienteDTO {
  id: string;
  nombre: string;
  telefono: string;
  email?: string | null;
}

/** Caja: resultado de buscar un cliente por telefono + su estado VIP. */
export interface EstadoClienteValoradoDTO {
  cliente: ClienteDTO;
  esValorado: boolean;
  totalReservas: number;
  siguienteEsGratis: boolean;
}

export interface ReservaDTO {
  id: string;
  canchaId: string;
  cancha?: CanchaDTO;
  clienteId: string;
  cliente?: ClienteDTO;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  estado: EstadoReserva;
  tipo: TipoReserva;
  formaPago: FormaPago;
  precioTotalQ: number;
  creadoEn: string;
  expiraEn?: string | null;
}

export interface CrearReservaInput {
  canchaId: string;
  clienteTelefono: string;
  clienteNombre: string;
  fecha: string;
  horaInicio: string;
  formaPago: FormaPago;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  usuario: {
    id: string;
    nombre: string;
    rol: RolUsuario;
  };
}

export interface ApiErrorResponse {
  statusCode: number;
  message: string | string[];
  error?: string;
}

// ---------- Reportes (Fase 5) ----------

export interface ReporteIngresosDTO {
  desde: string;
  hasta: string;
  totalQ: number;
  cantidadPagos: number;
  porDia: { fecha: string; totalQ: number }[];
  porModulo: { tipoReferencia: string; etiqueta: string; totalQ: number; cantidad: number }[];
}

export interface ReporteOcupacionDTO {
  desde: string;
  hasta: string;
  porCancha: {
    canchaId: string;
    canchaNombre: string;
    bloquesOcupados: number;
    bloquesTotales: number;
    porcentajeOcupacion: number;
  }[];
}

export interface ReporteMorosidadDTO {
  diasVencimiento: number;
  totalQ: number;
  cantidad: number;
  detalle: {
    pagoId: string;
    tipoReferencia: string;
    etiqueta: string;
    montoQ: number;
    diasVencido: number;
    descripcion: string;
  }[];
}

// ---------- Torneos (Fase 3) ----------

export interface TorneoDTO {
  id: string;
  nombre: string;
  descripcion?: string | null;
  formato: FormatoTorneo;
  categoria?: string | null;
  maxEquipos: number;
  cuotaInscripcionQ: number;
  fechaInicio?: string | null;
  fechaLimiteInscripcion?: string | null;
  estado: EstadoTorneo;
  equiposInscritos: number;
  creadoEn: string;
}

export interface EquipoDTO {
  id: string;
  torneoId: string;
  nombre: string;
  capitanNombre?: string | null;
  capitanTelefono?: string | null;
  cuotaPagada: boolean;
  creadoEn: string;
}

export interface PartidoDTO {
  id: string;
  jornada: number;
  ronda?: number | null;
  posicion?: number;
  localId?: string | null;
  visitanteId?: string | null;
  localNombre?: string | null;
  visitanteNombre?: string | null;
  golesLocal?: number | null;
  golesVisitante?: number | null;
  /** Ganador por penales de un partido de eliminacion directa empatado. */
  penalesGanadorId?: string | null;
  penalesGanadorNombre?: string | null;
  jugado: boolean;
}

export interface PosicionDTO {
  equipoId: string;
  nombre: string;
  jugados: number;
  ganados: number;
  empatados: number;
  perdidos: number;
  gf: number;
  gc: number;
  dif: number;
  puntos: number;
}

// ---------- Academia (Fase 4) ----------

export interface AlumnoDTO {
  id: string;
  nombres: string;
  apellidos: string;
  fechaNacimiento: string;
  categoria: string;
  encargadoNombre: string;
  encargadoTelefono: string;
  activo: boolean;
  creadoEn: string;
}

export interface AcademiaMensualidadDTO {
  id: string;
  alumnoId: string;
  alumno?: { id: string; nombres: string; apellidos: string } | null;
  mes: number;
  anio: number;
  montoQ: number;
  avisoVencidoEnviado: boolean;
  creadoEn: string;
  pagada: boolean;
}

export interface AsistenciaDTO {
  id: string;
  alumnoId: string;
  fecha: string;
  presente: boolean;
  creadoEn: string;
}

// ---------- Caja: productos, ventas y gastos (Fase 6) ----------

export interface ProductoDTO {
  id: string;
  nombre: string;
  categoria: ProductoCategoria;
  precioQ: number;
  activo: boolean;
  creadoEn: string;
}

export interface VentaItemDTO {
  id: string;
  productoId?: string | null;
  nombreSnapshot: string;
  cantidad: number;
  precioUnitarioQ: number;
  subtotalQ: number;
}

export interface VentaDTO {
  id: string;
  clienteId?: string | null;
  cliente?: ClienteDTO | null;
  estado: EstadoVenta;
  montoTotalQ: number;
  notas?: string | null;
  items: VentaItemDTO[];
  creadoEn: string;
  numeroRecibo?: string | null;
}

export interface CrearVentaInput {
  clienteTelefono?: string;
  clienteNombre?: string;
  items: { productoId: string; cantidad: number }[];
  notas?: string;
}

export interface GastoDTO {
  id: string;
  categoria: GastoCategoria;
  montoQ: number;
  descripcion?: string | null;
  fecha: string;
  creadoEn: string;
}

export interface CrearGastoInput {
  categoria: GastoCategoria;
  montoQ: number;
  descripcion?: string;
  fecha: string;
}

export interface ResumenGastosDTO {
  desde: string;
  hasta: string;
  totalQ: number;
  porCategoria: { categoria: GastoCategoria; totalQ: number; cantidad: number }[];
}

/** Igual a CrearReservaInput, sin formaPago: el cobro en sede siempre es EN_SEDE. */
export interface CobrarSedeInput {
  canchaId: string;
  clienteTelefono: string;
  clienteNombre: string;
  fecha: string;
  horaInicio: string;
  metodoPago: GatewayPago.EFECTIVO | GatewayPago.TARJETA;
  codigoAutorizacion?: string;
  /** Caja aplica el beneficio de Cliente Valorado: cobra Q0 (6ta reserva gratis). */
  gratis?: boolean;
}

export interface ReprogramarReservaInput {
  canchaId?: string;
  fecha?: string;
  horaInicio?: string;
}

/** Bloqueo puntual (un solo dia) de cancha: Reserva Especial o Academia. */
export interface CrearReservaBloqueoInput {
  canchaId: string;
  clienteTelefono: string;
  clienteNombre: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  tipo: TipoReserva.ESPECIAL | TipoReserva.ACADEMIA;
  formaPago: FormaPago;
}

/** Regla semanal recurrente de bloqueo (Especial o Academia). */
export interface CrearReservaRecurrenteInput {
  canchaId: string;
  clienteTelefono: string;
  clienteNombre: string;
  tipo: TipoReserva.ESPECIAL | TipoReserva.ACADEMIA;
  diaSemana: number; // 0=domingo .. 6=sabado
  horaInicio: string;
  horaFin: string;
  fechaInicio: string;
  fechaFin?: string;
}
