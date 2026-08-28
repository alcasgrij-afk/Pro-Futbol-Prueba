import { Injectable, Logger } from '@nestjs/common';
import { BotEstado, FormaPago, GatewayPago, MensajeSaliente, SesionChat } from '@profutbol/shared-types';
import { CanchasService } from '../canchas/canchas.service';
import { ReservasService } from '../reservas/reservas.service';
import { ChatSessionService } from './chat-session.service';

const PALABRAS_CANCELAR = ['cancelar', 'cancela', 'salir', 'stop'];

interface Entrante {
  texto?: string;
  /** id de la opcion elegida si el cliente toco un boton/lista interactiva */
  idSeleccion?: string;
}

interface ResultadoProcesar {
  sesion: SesionChat;
  mensajes: MensajeSaliente[];
}

function sesionInicial(sessionId: string): SesionChat {
  return { sessionId, estado: BotEstado.INICIO, actualizadoEn: new Date().toISOString() };
}

/**
 * Maquina de estados de la conversacion de reserva (ver Plan Tecnico,
 * Diagrama 3). Deliberadamente NO es un modelo de lenguaje libre: cada
 * estado solo acepta un conjunto pequeno de respuestas validas, lo cual
 * hace el comportamiento predecible y facil de testear (chat.service.spec.ts).
 *
 * Nota de diseno para el MVP: la fecha de reserva es siempre "hoy" (no se
 * pide fecha explicitamente), replicando el flujo aprobado en el dossier.
 */
@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly canchasService: CanchasService,
    private readonly reservasService: ReservasService,
    private readonly sesiones: ChatSessionService,
  ) {}

  async procesar(sessionId: string, texto: string): Promise<MensajeSaliente[]> {
    let sesion = (await this.sesiones.obtener(sessionId)) ?? sesionInicial(sessionId);
    const entrante: Entrante = { texto, idSeleccion: texto };

    const { sesion: actualizada, mensajes } = await this.procesarEntrada(sesion, entrante);
    await this.sesiones.guardar(actualizada);
    return mensajes;
  }

  private async procesarEntrada(sesionActual: SesionChat, entrante: Entrante): Promise<ResultadoProcesar> {
    let sesion = sesionActual;

    // Los estados terminales reinician la conversacion ante un mensaje nuevo.
    const estadosTerminales: BotEstado[] = [
      BotEstado.RESERVA_CONFIRMADA,
      BotEstado.RESERVA_LIBERADA,
      BotEstado.CANCELADA,
    ];
    if (estadosTerminales.includes(sesion.estado)) {
      sesion = sesionInicial(sesion.sessionId);
    }

    if (entrante.texto && this.esCancelacion(entrante.texto) && sesion.estado !== BotEstado.INICIO) {
      return this.cancelar(sesion, entrante);
    }

    switch (sesion.estado) {
      case BotEstado.INICIO:
        return this.manejarInicio(sesion, entrante);
      case BotEstado.MENU_CANCHA:
        return this.manejarMenuCancha(sesion, entrante);
      case BotEstado.MENU_HORARIO:
        return this.manejarMenuHorario(sesion, entrante);
      case BotEstado.CONFIRMA_PRECIO:
        return this.manejarConfirmaPrecio(sesion, entrante);
      case BotEstado.PEDIR_CONTACTO:
        return this.manejarPedirContacto(sesion, entrante);
      case BotEstado.ESPERA_PAGO:
      case BotEstado.RESERVA_PENDIENTE:
        return this.manejarEsperaPago(sesion, entrante);
      default:
        return this.manejarInicio(sesionInicial(sesion.sessionId), entrante);
    }
  }

  // ---------------------------------------------------------------------
  // INICIO -> MENU_CANCHA
  // ---------------------------------------------------------------------
  private async manejarInicio(sesion: SesionChat, entrante: Entrante): Promise<ResultadoProcesar> {
    const canchas = await this.canchasService.listar();

    // Si el primer mensaje ya nombra una cancha ("Cancha 1", "1"), ir directo
    // a los horarios en vez de ignorarlo y repetir el menu.
    const canchaDirecto = entrante.texto ? await this.resolverCanchaPorTexto(entrante.texto) : null;
    if (canchaDirecto) {
      return this.mostrarDisponibilidad({ ...sesion, estado: BotEstado.MENU_CANCHA }, canchaDirecto);
    }

    const nuevaSesion: SesionChat = { ...sesion, estado: BotEstado.MENU_CANCHA };

    return {
      sesion: nuevaSesion,
      mensajes: [
        { tipo: 'texto', texto: 'Hola! Bienvenido a Pro Futbol Antigua.' },
        {
          tipo: 'lista',
          texto: 'Que cancha deseas reservar?',
          opciones: canchas.map((c) => ({ id: c.id, titulo: c.nombre })),
        },
      ],
    };
  }

  // ---------------------------------------------------------------------
  // MENU_CANCHA -> MENU_HORARIO
  // ---------------------------------------------------------------------
  private async manejarMenuCancha(sesion: SesionChat, entrante: Entrante): Promise<ResultadoProcesar> {
    // Button tap envia el id; texto libre envia el nombre (o numero). Aceptar ambos.
    const texto = entrante.texto ?? '';
    const cancha = entrante.idSeleccion
      ? (await this.intentarObtenerCancha(entrante.idSeleccion)) ?? (await this.resolverCanchaPorTexto(texto))
      : await this.resolverCanchaPorTexto(texto);

    if (!cancha) {
      return {
        sesion,
        mensajes: [{ tipo: 'texto', texto: 'No reconoci esa opcion. Por favor elegi una cancha de la lista.' }],
      };
    }

    return this.mostrarDisponibilidad(sesion, cancha);
  }

  // ---------------------------------------------------------------------
  // Disponibilidad de una cancha -> lista de horarios (o re-elegis cancha).
  // Compartido por MENU_CANCHA y por el atajo directo desde INICIO.
  // ---------------------------------------------------------------------
  private async mostrarDisponibilidad(sesion: SesionChat, cancha: { id: string; nombre: string }): Promise<ResultadoProcesar> {
    const hoy = new Date().toISOString().slice(0, 10);
    const disponibilidad = await this.canchasService.disponibilidad(cancha.id, hoy);
    const bloquesLibres = disponibilidad.bloques.filter((b) => b.disponible);

    if (bloquesLibres.length === 0) {
      return {
        sesion: { ...sesion, estado: BotEstado.MENU_CANCHA },
        mensajes: [
          { tipo: 'texto', texto: `No hay horarios libres hoy en ${cancha.nombre}. Elegi otra cancha:` },
          {
            tipo: 'lista',
            texto: 'Canchas disponibles',
            opciones: (await this.canchasService.listar()).map((c) => ({ id: c.id, titulo: c.nombre })),
          },
        ],
      };
    }

    const nuevaSesion: SesionChat = {
      ...sesion,
      estado: BotEstado.MENU_HORARIO,
      canchaId: cancha.id,
      canchaNombre: cancha.nombre,
      fecha: hoy,
    };

    return {
      sesion: nuevaSesion,
      mensajes: [
        {
          tipo: 'lista',
          texto: `Horarios disponibles hoy en ${cancha.nombre}:`,
          opciones: bloquesLibres.map((b) => ({ id: b.horaInicio, titulo: `${b.horaInicio} - ${b.horaFin}` })),
        },
      ],
    };
  }

  // ---------------------------------------------------------------------
  // MENU_HORARIO -> CONFIRMA_PRECIO
  // ---------------------------------------------------------------------
  private async manejarMenuHorario(sesion: SesionChat, entrante: Entrante): Promise<ResultadoProcesar> {
    const horaInicio = entrante.idSeleccion;

    if (!horaInicio || !sesion.canchaId || !sesion.fecha) {
      return this.reiniciarPorInconsistencia(sesion, entrante);
    }

    // Revalidar disponibilidad: pudo haber sido tomado por otro.
    const disponibilidad = await this.canchasService.disponibilidad(sesion.canchaId, sesion.fecha);
    const bloque = disponibilidad.bloques.find((b) => b.horaInicio === horaInicio);

    if (!bloque || !bloque.disponible) {
      const libres = disponibilidad.bloques.filter((b) => b.disponible);
      return {
        sesion: { ...sesion, estado: BotEstado.MENU_HORARIO },
        mensajes: [
          { tipo: 'texto', texto: 'Justo se ocupo ese horario. Elegi otro:' },
          {
            tipo: 'lista',
            texto: 'Horarios disponibles',
            opciones: libres.map((b) => ({ id: b.horaInicio, titulo: `${b.horaInicio} - ${b.horaFin}` })),
          },
        ],
      };
    }

    const cancha = await this.canchasService.obtenerPorId(sesion.canchaId);
    const nuevaSesion: SesionChat = { ...sesion, estado: BotEstado.CONFIRMA_PRECIO, horaInicio };

    return {
      sesion: nuevaSesion,
      mensajes: [
        {
          tipo: 'botones',
          texto:
            `Precio con pago anticipado (en linea): Q${cancha.precioAnticipadoQ}\n` +
            `Precio pagando en sede: Q${cancha.precioSedeQ}\n\n` +
            'Como queres pagar?',
          opciones: [
            { id: 'pagar_en_linea', titulo: 'Pagar en linea' },
            { id: 'pagar_en_sede', titulo: 'Pagar en sede' },
          ],
        },
      ],
    };
  }

  // ---------------------------------------------------------------------
  // CONFIRMA_PRECIO -> PEDIR_CONTACTO (si falta contacto) | ESPERA_PAGO/RESERVA_PENDIENTE
  // ---------------------------------------------------------------------
  private async manejarConfirmaPrecio(sesion: SesionChat, entrante: Entrante): Promise<ResultadoProcesar> {
    if (!sesion.canchaId || !sesion.fecha || !sesion.horaInicio) {
      return this.reiniciarPorInconsistencia(sesion, entrante);
    }

    if (entrante.idSeleccion !== 'pagar_en_linea' && entrante.idSeleccion !== 'pagar_en_sede') {
      return {
        sesion,
        mensajes: [{ tipo: 'texto', texto: 'Elegi una opcion valida: pagar en linea o pagar en sede.' }],
      };
    }

    const formaPago =
      entrante.idSeleccion === 'pagar_en_linea' ? FormaPago.ANTICIPADO_EN_LINEA : FormaPago.EN_SEDE;

    // Sin nombre/telefono aun, pasamos por PEDIR_CONTACTO antes de reservar.
    if (!sesion.nombre || !sesion.telefono) {
      return {
        sesion: { ...sesion, estado: BotEstado.PEDIR_CONTACTO, formaPago },
        mensajes: [
          {
            tipo: 'texto',
            texto:
              'Para confirmar tu reserva necesitamos tu contacto. Escribilo asi: ' +
              'Tu nombre, tu telefono. (ej: Juan Perez, 5555-1234)',
          },
        ],
      };
    }

    return this.crearReserva(sesion, entrante, formaPago);
  }

  // ---------------------------------------------------------------------
  // PEDIR_CONTACTO -> crea la reserva con la forma de pago elegida antes
  // ---------------------------------------------------------------------
  private async manejarPedirContacto(sesion: SesionChat, entrante: Entrante): Promise<ResultadoProcesar> {
    const contacto = this.parsearContacto(entrante.texto ?? '');
    if (!contacto) {
      return {
        sesion,
        mensajes: [
          {
            tipo: 'texto',
            texto: 'No entendi eso. Escribilo asi: Tu nombre, tu telefono. (ej: Juan Perez, 5555-1234)',
          },
        ],
      };
    }

    const conContacto: SesionChat = { ...sesion, nombre: contacto.nombre, telefono: contacto.telefono };
    const formaPago = sesion.formaPago ?? FormaPago.EN_SEDE;
    return this.crearReserva(conContacto, entrante, formaPago);
  }

  private async crearReserva(
    sesion: SesionChat,
    entrante: Entrante,
    formaPago: FormaPago,
  ): Promise<ResultadoProcesar> {
    try {
      const reserva = await this.reservasService.crearReserva({
        canchaId: sesion.canchaId!,
        clienteTelefono: sesion.telefono!,
        clienteNombre: sesion.nombre ?? 'Cliente web',
        fecha: sesion.fecha!,
        horaInicio: sesion.horaInicio!,
        formaPago,
      });

      if (formaPago === FormaPago.ANTICIPADO_EN_LINEA) {
        return {
          sesion: { ...sesion, estado: BotEstado.ESPERA_PAGO, reservaId: reserva.id },
          mensajes: [
            {
              tipo: 'pago',
              texto:
                'Tu reserva quedo apartada por 15 minutos. Tocá "Pagar ahora" para completar el pago en linea.',
              gateway: GatewayPago.BAC,
              reservaId: reserva.id,
              montoQ: Number(reserva.precioTotalQ),
            },
            { tipo: 'texto', texto: 'Tenes 15 minutos para completar el pago o el horario se libera.' },
          ],
        };
      }

      return {
        sesion: { ...sesion, estado: BotEstado.RESERVA_PENDIENTE, reservaId: reserva.id },
        mensajes: [
          {
            tipo: 'texto',
            texto:
              `Reserva apartada! Pagas en sede al llegar. Tenes 30 minutos, si no ` +
              `te presentas o pagas, el horario se libera automaticamente.`,
          },
        ],
      };
    } catch (error) {
      this.logger.warn(`No se pudo crear la reserva para ${sesion.sessionId}: ${(error as Error).message}`);
      return {
        sesion: { ...sesion, estado: BotEstado.MENU_CANCHA, canchaId: undefined, canchaNombre: undefined },
        mensajes: [{ tipo: 'texto', texto: 'Ese horario ya no esta disponible. Vamos a elegir otro horario.' }],
      };
    }
  }

  // ---------------------------------------------------------------------
  // ESPERA_PAGO / RESERVA_PENDIENTE -> RESERVA_CONFIRMADA | RESERVA_LIBERADA
  // ---------------------------------------------------------------------
  private async manejarEsperaPago(sesion: SesionChat, entrante: Entrante): Promise<ResultadoProcesar> {
    if (!sesion.reservaId) return this.reiniciarPorInconsistencia(sesion, entrante);

    const reserva = await this.reservasService.obtenerPorId(sesion.reservaId);

    if (reserva.estado === 'CONFIRMADA') {
      return {
        sesion: { ...sesion, estado: BotEstado.RESERVA_CONFIRMADA },
        mensajes: [
          {
            tipo: 'texto',
            texto: `Pago confirmado! Tu reserva en ${sesion.canchaNombre} a las ${sesion.horaInicio} esta lista. Nos vemos!`,
          },
        ],
      };
    }

    if (reserva.estado === 'LIBERADA') {
      return {
        sesion: { ...sesion, estado: BotEstado.RESERVA_LIBERADA },
        mensajes: [
          { tipo: 'texto', texto: 'El tiempo para completar el pago expiro y el horario se libero. Queres intentar de nuevo?' },
        ],
      };
    }

    return {
      sesion,
      mensajes: [{ tipo: 'texto', texto: 'Todavia estamos esperando la confirmacion de tu pago.' }],
    };
  }

  // ---------------------------------------------------------------------
  private async cancelar(sesion: SesionChat, entrante: Entrante): Promise<ResultadoProcesar> {
    if (sesion.reservaId) {
      await this.reservasService.cancelar(sesion.reservaId);
    }
    return {
      sesion: { ...sesion, estado: BotEstado.CANCELADA },
      mensajes: [{ tipo: 'texto', texto: 'Listo, cancelamos el proceso. Escribinos cuando quieras reservar.' }],
    };
  }

  private parsearContacto(texto: string): { nombre: string; telefono: string } | null {
    const partes = texto
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);
    if (partes.length < 2) return null;
    const nombre = partes[0];
    const telefono = partes[1].replace(/[^\d]/g, '');
    if (!nombre || !telefono) return null;
    return { nombre, telefono };
  }

  private async intentarObtenerCancha(canchaId: string) {
    try {
      return await this.canchasService.obtenerPorId(canchaId);
    } catch {
      return null;
    }
  }

  /**
   * Resuelve una cancha a partir de texto libre: nombre exacto, "cancha 1",
   * el numero solo ("1") o fragmentos del nombre ("futbol 5"). Normaliza
   * mayusculas, espacios y acentos antes de comparar. `ponytail:` si una
   * entrada coincide con varias canchas (ej. dos "Cancha 1" en sedes
   * distintas) toma la primera; pedir confirmacion explicita si eso ocurre.
   */
  private async resolverCanchaPorTexto(texto: string) {
    const candidato = this.normalizar(texto);
    if (!candidato) return null;

    const canchas = await this.canchasService.listar();
    const numero = candidato.match(/(?:cancha\s+)?(\d{1,2})/)?.[1];

    const exacta = canchas.find((c) => this.normalizar(c.nombre) === candidato);
    if (exacta) return exacta;

    if (numero) {
      // \b: "cancha 1" no debe matchear "cancha 10 - Futbol 11".
      const porNumero = canchas.find((c) => new RegExp(`cancha\\s+${numero}\\b`).test(this.normalizar(c.nombre)));
      if (porNumero) return porNumero;
    }

    const porPrefijo = canchas.find((c) => this.normalizar(c.nombre).startsWith(candidato));
    if (porPrefijo) return porPrefijo;

    const porContiene = canchas.find((c) => this.normalizar(c.nombre).includes(candidato));
    if (porContiene) return porContiene;

    return null;
  }

  private normalizar(texto: string): string {
    return texto
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '') // quita acentos ("Fútbol" -> "futbol")
      .replace(/\s+/g, ' ')
      .trim();
  }

  private esCancelacion(texto: string): boolean {
    const normalizado = texto.trim().toLowerCase();
    return PALABRAS_CANCELAR.includes(normalizado);
  }

  private reiniciarPorInconsistencia(sesion: SesionChat, entrante: Entrante): ResultadoProcesar {
    // Salvaguarda defensiva: si la sesion quedo en un estado sin los datos
    // que deberia tener (ej. Redis se limpio a mitad de conversacion).
    this.logger.warn(`Sesion inconsistente para ${entrante.texto}, reiniciando.`);
    return {
      sesion: sesionInicial(sesion.sessionId),
      mensajes: [{ tipo: 'texto', texto: 'Empecemos de nuevo. Escribi "hola" para reservar tu cancha.' }],
    };
  }
}
