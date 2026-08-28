import { BotEstado, FormaPago, GatewayPago, SesionChat } from '@profutbol/shared-types';
import { ChatService } from './chat.service';
import { ChatSessionService } from './chat-session.service';

describe('ChatService (maquina de estados)', () => {
  const SESSION_ID = 'chat-test-123';

  // --- Fakes de dependencias ---
  const cancha = {
    id: 'c1',
    nombre: 'Futbol 5',
    precioAnticipadoQ: 150,
    precioSedeQ: 0,
    activa: true,
  };

  const canchasService = {
    listar: jest.fn().mockResolvedValue([cancha]),
    obtenerPorId: jest.fn().mockImplementation((id) =>
      id === cancha.id ? Promise.resolve(cancha) : Promise.reject(new Error('no')),
    ),
    disponibilidad: jest.fn().mockResolvedValue({
      canchaId: cancha.id,
      fecha: '2026-08-28',
      bloques: [{ horaInicio: '18:00', horaFin: '19:00', disponible: true }],
    }),
  };

  let reservaCreada: any;
  const reservasService = {
    crearReserva: jest.fn().mockImplementation((dto) => {
      reservaCreada = { id: 'r1', estado: 'PENDIENTE_PAGO', precioTotalQ: 150, ...dto };
      return Promise.resolve(reservaCreada);
    }),
    obtenerPorId: jest.fn(),
    cancelar: jest.fn().mockResolvedValue({}),
  };

  const sesiones = new Map<string, SesionChat>();
  const chatSessionService = {
    obtener: jest.fn().mockImplementation(async (id) => sesiones.get(id) ?? null),
    guardar: jest.fn().mockImplementation(async (s) => {
      sesiones.set(s.sessionId, s);
    }),
    reiniciar: jest.fn().mockImplementation(async (id) => {
      sesiones.delete(id);
    }),
  } as unknown as ChatSessionService;

  let chat: ChatService;

  const enviar = (texto: string) => chat.procesar(SESSION_ID, texto);

  beforeEach(() => {
    sesiones.clear();
    jest.clearAllMocks();
    canchasService.disponibilidad.mockClear();
    chat = new ChatService(canchasService as any, reservasService as any, chatSessionService);
  });

  it('INICIO -> MENU_CANCHA muestra la lista de canchas', async () => {
    const mensajes = await enviar('hola');
    const estado = sesiones.get(SESSION_ID)!.estado;
    expect(estado).toBe(BotEstado.MENU_CANCHA);
    expect(mensajes[1].tipo).toBe('lista');
    expect((mensajes[1] as { opciones: unknown[] }).opciones).toHaveLength(1);
  });

  it('MENU_CANCHA -> MENU_HORARIO al elegir una cancha valida', async () => {
    await enviar('hola');
    const mensajes = await enviar(cancha.id);
    const sesion = sesiones.get(SESSION_ID)!;
    expect(sesion.estado).toBe(BotEstado.MENU_HORARIO);
    expect(sesion.canchaId).toBe(cancha.id);
    expect(mensajes[0].tipo).toBe('lista');
  });

  it('MENU_CANCHA acepta texto libre con el nombre de la cancha', async () => {
    await enviar('hola');
    const mensajes = await enviar('futbol 5');
    const sesion = sesiones.get(SESSION_ID)!;
    expect(sesion.estado).toBe(BotEstado.MENU_HORARIO);
    expect(sesion.canchaId).toBe(cancha.id);
    expect(mensajes[0].tipo).toBe('lista');
  });

  it('INICIO salta directo a horarios si el primer mensaje nombra la cancha', async () => {
    const mensajes = await enviar('futbol 5');
    const sesion = sesiones.get(SESSION_ID)!;
    expect(sesion.estado).toBe(BotEstado.MENU_HORARIO);
    expect(sesion.canchaId).toBe(cancha.id);
    expect(mensajes[0].tipo).toBe('lista');
  });

  it('MENU_HORARIO -> CONFIRMA_PRECIO al elegir un horario disponible', async () => {
    await enviar('hola');
    await enviar(cancha.id);
    const mensajes = await enviar('18:00');
    const sesion = sesiones.get(SESSION_ID)!;
    expect(sesion.estado).toBe(BotEstado.CONFIRMA_PRECIO);
    expect(sesion.horaInicio).toBe('18:00');
    expect(mensajes[0].tipo).toBe('botones');
  });

  it('CONFIRMA_PRECIO sin contacto -> PEDIR_CONTACTO', async () => {
    await enviar('hola');
    await enviar(cancha.id);
    await enviar('18:00');
    const mensajes = await enviar('pagar_en_sede');
    const sesion = sesiones.get(SESSION_ID)!;
    expect(sesion.estado).toBe(BotEstado.PEDIR_CONTACTO);
    expect(sesion.formaPago).toBe(FormaPago.EN_SEDE);
    expect(mensajes[0].texto).toContain('nombre');
  });

  it('PEDIR_CONTACTO crea la reserva en sede y pasa a RESERVA_PENDIENTE', async () => {
    await enviar('hola');
    await enviar(cancha.id);
    await enviar('18:00');
    await enviar('pagar_en_sede');
    const mensajes = await enviar('Juan Perez, 5555-1234');

    const sesion = sesiones.get(SESSION_ID)!;
    expect(sesion.estado).toBe(BotEstado.RESERVA_PENDIENTE);
    expect(sesion.nombre).toBe('Juan Perez');
    expect(sesion.telefono).toBe('55551234');
    expect(reservasService.crearReserva).toHaveBeenCalledWith(
      expect.objectContaining({ formaPago: FormaPago.EN_SEDE }),
    );
    expect(mensajes[0].texto).toContain('Pagas en sede');
  });

  it('PEDIR_CONTACTO con formato invalido pide el contacto de nuevo', async () => {
    await enviar('hola');
    await enviar(cancha.id);
    await enviar('18:00');
    await enviar('pagar_en_linea');
    const mensajes = await enviar('repetidoporsincomadelimitador');
    expect(sesiones.get(SESSION_ID)!.estado).toBe(BotEstado.PEDIR_CONTACTO);
    expect(reservasService.crearReserva).not.toHaveBeenCalled();
    expect(mensajes[0].texto).toContain('No entendi eso');
  });

  it('pago en linea emite un mensaje de tipo pago en ESPERA_PAGO', async () => {
    await enviar('hola');
    await enviar(cancha.id);
    await enviar('18:00');
    await enviar('pagar_en_linea');
    const mensajes = await enviar('Ana Lopez, 4444-5678');

    const sesion = sesiones.get(SESSION_ID)!;
    expect(sesion.estado).toBe(BotEstado.ESPERA_PAGO);
    expect(sesiones.get(SESSION_ID)!.formaPago).toBe(FormaPago.ANTICIPADO_EN_LINEA);
    const pago = mensajes.find((m) => m.tipo === 'pago');
    expect(pago).toBeDefined();
    expect((pago as { gateway: GatewayPago }).gateway).toBe(GatewayPago.BAC);
    expect((pago as { reservaId: string }).reservaId).toBe('r1');
    expect((pago as { montoQ: number }).montoQ).toBe(150);
  });

  it('ESPERA_PAGO -> RESERVA_CONFIRMADA cuando el pago fue confirmado', async () => {
    reservasService.obtenerPorId.mockResolvedValue({ estado: 'CONFIRMADA' });
    sesiones.set(SESSION_ID, {
      sessionId: SESSION_ID,
      estado: BotEstado.ESPERA_PAGO,
      telefono: '55551234',
      nombre: 'Juan Perez',
      canchaNombre: cancha.nombre,
      horaInicio: '18:00',
      reservaId: 'r1',
      actualizadoEn: new Date().toISOString(),
    });

    const mensajes = await chat.procesar(SESSION_ID, 'como va?');
    expect(sesiones.get(SESSION_ID)!.estado).toBe(BotEstado.RESERVA_CONFIRMADA);
    expect(mensajes[0].texto).toContain('Pago confirmado');
  });

  it('ESPERA_PAGO -> RESERVA_LIBERADA cuando expiro por timeout', async () => {
    reservasService.obtenerPorId.mockResolvedValue({ estado: 'LIBERADA' });
    sesiones.set(SESSION_ID, {
      sessionId: SESSION_ID,
      estado: BotEstado.ESPERA_PAGO,
      telefono: '55551234',
      nombre: 'Juan Perez',
      reservaId: 'r1',
      actualizadoEn: new Date().toISOString(),
    });

    const mensajes = await chat.procesar(SESSION_ID, 'como va?');
    expect(sesiones.get(SESSION_ID)!.estado).toBe(BotEstado.RESERVA_LIBERADA);
    expect(mensajes[0].texto).toContain('expiro');
  });

  it('la palabra "cancelar" cancela la reserva pendiente', async () => {
    sesiones.set(SESSION_ID, {
      sessionId: SESSION_ID,
      estado: BotEstado.RESERVA_PENDIENTE,
      telefono: '55551234',
      nombre: 'Juan Perez',
      reservaId: 'r1',
      actualizadoEn: new Date().toISOString(),
    });

    await chat.procesar(SESSION_ID, 'cancelar');
    expect(reservasService.cancelar).toHaveBeenCalledWith('r1');
    expect(sesiones.get(SESSION_ID)!.estado).toBe(BotEstado.CANCELADA);
  });
});
