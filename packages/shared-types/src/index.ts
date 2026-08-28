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
}

export enum TipoPagoReferencia {
  RESERVA = 'RESERVA',
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
  | { tipo: 'pago'; texto: string; gateway: GatewayPago; reservaId: string; montoQ: number };

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
