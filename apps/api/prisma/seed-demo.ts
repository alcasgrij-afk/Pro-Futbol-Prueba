/**
 * Datos de demostracion (NO son datos reales de clientes).
 * Uso: npm run prisma:seed:demo  (definido en apps/api/package.json)
 *
 * A diferencia de seed.ts (canchas + admin, indispensable para operar), este
 * script solo agrega un puñado de filas de ejemplo en cada modulo -
 * reservas, pagos, torneo, alumnos - para que los reportes y el panel admin
 * muestren datos reales en vez de pantallas vacias.
 *
 * Todo aqui es facilmente identificable y reversible:
 *  - Nombres de clientes/alumnos/equipos llevan el prefijo "Demo - ".
 *  - Telefonos usan el rango ficticio 5009-10XX (no colisiona con clientes reales).
 *  - Reservas/pagos usan fechas PASADAS (agosto y 1-17 de septiembre 2026),
 *    nunca hoy ni los proximos dias, para no bloquear horarios reales que un
 *    cliente pueda estar por reservar.
 * Para borrar todo: buscar "Demo - " en el panel admin (clientes, alumnos,
 * equipos, productos) y eliminar desde ahi, o filtrar por esos ids en la
 * base de datos (las ventas demo usan el prefijo "demo-venta-" en su id).
 */
import { PrismaClient, EstadoReserva, FormaPago, EstadoPago, GatewayPago, TipoPagoReferencia, FormatoTorneo, EstadoTorneo, ProductoCategoria } from '@prisma/client';

const prisma = new PrismaClient();

const CANCHA_F5 = 'seed-cancha-futbol-5';
const CANCHA_F7 = 'seed-cancha-futbol-7';

async function main() {
  console.log('Sembrando datos de demostracion...');

  // ---- Clientes ----
  const clientesData = [
    { id: 'demo-cliente-1', nombre: 'Demo - Marcos Xitumul', telefono: '50091001' },
    { id: 'demo-cliente-2', nombre: 'Demo - Andrea Sical', telefono: '50091002' },
    { id: 'demo-cliente-3', nombre: 'Demo - Byron Ixchop', telefono: '50091003' },
    { id: 'demo-cliente-4', nombre: 'Demo - Paola Tzunun', telefono: '50091004' },
    { id: 'demo-cliente-5', nombre: 'Demo - Kevin Ajpop', telefono: '50091005' },
    { id: 'demo-cliente-6', nombre: 'Demo - Lucía Batz', telefono: '50091006' },
    { id: 'demo-cliente-7', nombre: 'Demo - Oscar Yax', telefono: '50091007' },
    { id: 'demo-cliente-8', nombre: 'Demo - Fátima Cúmez', telefono: '50091008' },
  ];
  const clientes: Record<string, { id: string }> = {};
  for (const c of clientesData) {
    clientes[c.id] = await prisma.cliente.upsert({
      where: { telefono: c.telefono },
      update: {},
      create: c,
    });
  }

  // ---- Reservas + Pagos (fechas pasadas de este mes, nunca futuras) ----
  type ReservaDemo = {
    id: string;
    canchaId: string;
    clienteId: string;
    fecha: string;
    horaInicioMin: number;
    horaFinMin: number;
    estado: EstadoReserva;
    formaPago: FormaPago;
    precioTotalQ: number;
    pago?: { estado: EstadoPago; gateway: GatewayPago; creadoEn: string; confirmadoEn?: string };
  };

  const reservas: ReservaDemo[] = [
    {
      id: 'demo-reserva-1', canchaId: CANCHA_F5, clienteId: 'demo-cliente-1', fecha: '2026-09-03',
      horaInicioMin: 18 * 60, horaFinMin: 19 * 60, estado: EstadoReserva.CONFIRMADA, formaPago: FormaPago.ANTICIPADO_EN_LINEA, precioTotalQ: 250,
      pago: { estado: EstadoPago.COMPLETADO, gateway: GatewayPago.BAC, creadoEn: '2026-09-03T18:00:00', confirmadoEn: '2026-09-03T18:04:00' },
    },
    {
      id: 'demo-reserva-2', canchaId: CANCHA_F7, clienteId: 'demo-cliente-2', fecha: '2026-09-04',
      horaInicioMin: 19 * 60, horaFinMin: 20 * 60, estado: EstadoReserva.CONFIRMADA, formaPago: FormaPago.EN_SEDE, precioTotalQ: 420,
      pago: { estado: EstadoPago.COMPLETADO, gateway: GatewayPago.EFECTIVO, creadoEn: '2026-09-04T19:00:00', confirmadoEn: '2026-09-04T20:15:00' },
    },
    {
      id: 'demo-reserva-3', canchaId: CANCHA_F5, clienteId: 'demo-cliente-3', fecha: '2026-09-06',
      horaInicioMin: 20 * 60, horaFinMin: 21 * 60, estado: EstadoReserva.CONFIRMADA, formaPago: FormaPago.ANTICIPADO_EN_LINEA, precioTotalQ: 250,
      pago: { estado: EstadoPago.COMPLETADO, gateway: GatewayPago.NEONET, creadoEn: '2026-09-06T20:00:00', confirmadoEn: '2026-09-06T20:06:00' },
    },
    {
      id: 'demo-reserva-4', canchaId: CANCHA_F7, clienteId: 'demo-cliente-4', fecha: '2026-09-08',
      horaInicioMin: 17 * 60, horaFinMin: 18 * 60, estado: EstadoReserva.PENDIENTE_SEDE, formaPago: FormaPago.EN_SEDE, precioTotalQ: 420,
      pago: { estado: EstadoPago.PENDIENTE, gateway: GatewayPago.EFECTIVO, creadoEn: '2026-09-08T17:05:00' },
    },
    {
      id: 'demo-reserva-5', canchaId: CANCHA_F5, clienteId: 'demo-cliente-5', fecha: '2026-09-10',
      horaInicioMin: 21 * 60, horaFinMin: 22 * 60, estado: EstadoReserva.CANCELADA, formaPago: FormaPago.EN_SEDE, precioTotalQ: 250,
    },
    {
      id: 'demo-reserva-6', canchaId: CANCHA_F7, clienteId: 'demo-cliente-6', fecha: '2026-09-11',
      horaInicioMin: 18 * 60, horaFinMin: 19 * 60, estado: EstadoReserva.CONFIRMADA, formaPago: FormaPago.ANTICIPADO_EN_LINEA, precioTotalQ: 420,
      pago: { estado: EstadoPago.COMPLETADO, gateway: GatewayPago.BAC, creadoEn: '2026-09-11T18:00:00', confirmadoEn: '2026-09-11T18:05:00' },
    },
    {
      id: 'demo-reserva-7', canchaId: CANCHA_F5, clienteId: 'demo-cliente-1', fecha: '2026-09-13',
      horaInicioMin: 19 * 60, horaFinMin: 20 * 60, estado: EstadoReserva.LIBERADA, formaPago: FormaPago.ANTICIPADO_EN_LINEA, precioTotalQ: 250,
      pago: { estado: EstadoPago.FALLIDO, gateway: GatewayPago.BAC, creadoEn: '2026-09-13T19:00:00' },
    },
    {
      id: 'demo-reserva-8', canchaId: CANCHA_F7, clienteId: 'demo-cliente-2', fecha: '2026-09-15',
      horaInicioMin: 20 * 60, horaFinMin: 21 * 60, estado: EstadoReserva.CONFIRMADA, formaPago: FormaPago.EN_SEDE, precioTotalQ: 420,
      pago: { estado: EstadoPago.COMPLETADO, gateway: GatewayPago.EFECTIVO, creadoEn: '2026-09-15T20:00:00', confirmadoEn: '2026-09-15T21:00:00' },
    },
    {
      id: 'demo-reserva-9', canchaId: CANCHA_F5, clienteId: 'demo-cliente-3', fecha: '2026-09-17',
      horaInicioMin: 18 * 60, horaFinMin: 19 * 60, estado: EstadoReserva.PENDIENTE_PAGO, formaPago: FormaPago.ANTICIPADO_EN_LINEA, precioTotalQ: 250,
      pago: { estado: EstadoPago.PENDIENTE, gateway: GatewayPago.BAC, creadoEn: '2026-09-17T18:05:00' },
    },
    {
      id: 'demo-reserva-10', canchaId: CANCHA_F7, clienteId: 'demo-cliente-7', fecha: '2026-09-01',
      horaInicioMin: 17 * 60, horaFinMin: 18 * 60, estado: EstadoReserva.CONFIRMADA, formaPago: FormaPago.ANTICIPADO_EN_LINEA, precioTotalQ: 350,
      pago: { estado: EstadoPago.COMPLETADO, gateway: GatewayPago.NEONET, creadoEn: '2026-09-01T17:00:00', confirmadoEn: '2026-09-01T17:03:00' },
    },
    {
      id: 'demo-reserva-11', canchaId: CANCHA_F5, clienteId: 'demo-cliente-8', fecha: '2026-09-05',
      horaInicioMin: 19 * 60, horaFinMin: 20 * 60, estado: EstadoReserva.CONFIRMADA, formaPago: FormaPago.EN_SEDE, precioTotalQ: 300,
      pago: { estado: EstadoPago.COMPLETADO, gateway: GatewayPago.EFECTIVO, creadoEn: '2026-09-05T19:00:00', confirmadoEn: '2026-09-05T20:00:00' },
    },
    {
      id: 'demo-reserva-12', canchaId: CANCHA_F7, clienteId: 'demo-cliente-4', fecha: '2026-09-09',
      horaInicioMin: 18 * 60, horaFinMin: 19 * 60, estado: EstadoReserva.CONFIRMADA, formaPago: FormaPago.ANTICIPADO_EN_LINEA, precioTotalQ: 350,
      pago: { estado: EstadoPago.COMPLETADO, gateway: GatewayPago.BAC, creadoEn: '2026-09-09T18:00:00', confirmadoEn: '2026-09-09T18:04:00' },
    },
    {
      id: 'demo-reserva-13', canchaId: CANCHA_F5, clienteId: 'demo-cliente-6', fecha: '2026-09-12',
      horaInicioMin: 20 * 60, horaFinMin: 21 * 60, estado: EstadoReserva.PENDIENTE_SEDE, formaPago: FormaPago.EN_SEDE, precioTotalQ: 300,
      pago: { estado: EstadoPago.PENDIENTE, gateway: GatewayPago.EFECTIVO, creadoEn: '2026-09-12T20:05:00' },
    },
    {
      id: 'demo-reserva-14', canchaId: CANCHA_F7, clienteId: 'demo-cliente-5', fecha: '2026-09-16',
      horaInicioMin: 17 * 60, horaFinMin: 18 * 60, estado: EstadoReserva.CONFIRMADA, formaPago: FormaPago.ANTICIPADO_EN_LINEA, precioTotalQ: 350,
      pago: { estado: EstadoPago.COMPLETADO, gateway: GatewayPago.NEONET, creadoEn: '2026-09-16T17:00:00', confirmadoEn: '2026-09-16T17:02:00' },
    },
    // Mes anterior (agosto 2026), para poder probar reportes con otro rango de fecha.
    {
      id: 'demo-reserva-15', canchaId: CANCHA_F5, clienteId: 'demo-cliente-2', fecha: '2026-08-03',
      horaInicioMin: 18 * 60, horaFinMin: 19 * 60, estado: EstadoReserva.CONFIRMADA, formaPago: FormaPago.ANTICIPADO_EN_LINEA, precioTotalQ: 250,
      pago: { estado: EstadoPago.COMPLETADO, gateway: GatewayPago.BAC, creadoEn: '2026-08-03T18:00:00', confirmadoEn: '2026-08-03T18:04:00' },
    },
    {
      id: 'demo-reserva-16', canchaId: CANCHA_F7, clienteId: 'demo-cliente-4', fecha: '2026-08-05',
      horaInicioMin: 19 * 60, horaFinMin: 20 * 60, estado: EstadoReserva.CONFIRMADA, formaPago: FormaPago.EN_SEDE, precioTotalQ: 420,
      pago: { estado: EstadoPago.COMPLETADO, gateway: GatewayPago.EFECTIVO, creadoEn: '2026-08-05T19:00:00', confirmadoEn: '2026-08-05T20:10:00' },
    },
    {
      id: 'demo-reserva-17', canchaId: CANCHA_F5, clienteId: 'demo-cliente-7', fecha: '2026-08-08',
      horaInicioMin: 20 * 60, horaFinMin: 21 * 60, estado: EstadoReserva.CONFIRMADA, formaPago: FormaPago.ANTICIPADO_EN_LINEA, precioTotalQ: 250,
      pago: { estado: EstadoPago.COMPLETADO, gateway: GatewayPago.NEONET, creadoEn: '2026-08-08T20:00:00', confirmadoEn: '2026-08-08T20:06:00' },
    },
    {
      id: 'demo-reserva-18', canchaId: CANCHA_F7, clienteId: 'demo-cliente-1', fecha: '2026-08-10',
      horaInicioMin: 17 * 60, horaFinMin: 18 * 60, estado: EstadoReserva.PENDIENTE_SEDE, formaPago: FormaPago.EN_SEDE, precioTotalQ: 420,
      pago: { estado: EstadoPago.PENDIENTE, gateway: GatewayPago.EFECTIVO, creadoEn: '2026-08-10T17:05:00' },
    },
    {
      id: 'demo-reserva-19', canchaId: CANCHA_F5, clienteId: 'demo-cliente-8', fecha: '2026-08-12',
      horaInicioMin: 21 * 60, horaFinMin: 22 * 60, estado: EstadoReserva.CANCELADA, formaPago: FormaPago.EN_SEDE, precioTotalQ: 250,
    },
    {
      id: 'demo-reserva-20', canchaId: CANCHA_F7, clienteId: 'demo-cliente-3', fecha: '2026-08-15',
      horaInicioMin: 18 * 60, horaFinMin: 19 * 60, estado: EstadoReserva.CONFIRMADA, formaPago: FormaPago.ANTICIPADO_EN_LINEA, precioTotalQ: 420,
      pago: { estado: EstadoPago.COMPLETADO, gateway: GatewayPago.BAC, creadoEn: '2026-08-15T18:00:00', confirmadoEn: '2026-08-15T18:05:00' },
    },
    {
      id: 'demo-reserva-21', canchaId: CANCHA_F5, clienteId: 'demo-cliente-6', fecha: '2026-08-20',
      horaInicioMin: 19 * 60, horaFinMin: 20 * 60, estado: EstadoReserva.CONFIRMADA, formaPago: FormaPago.EN_SEDE, precioTotalQ: 250,
      pago: { estado: EstadoPago.COMPLETADO, gateway: GatewayPago.EFECTIVO, creadoEn: '2026-08-20T19:00:00', confirmadoEn: '2026-08-20T20:00:00' },
    },
    {
      id: 'demo-reserva-22', canchaId: CANCHA_F7, clienteId: 'demo-cliente-5', fecha: '2026-08-24',
      horaInicioMin: 20 * 60, horaFinMin: 21 * 60, estado: EstadoReserva.PENDIENTE_PAGO, formaPago: FormaPago.ANTICIPADO_EN_LINEA, precioTotalQ: 420,
      pago: { estado: EstadoPago.PENDIENTE, gateway: GatewayPago.BAC, creadoEn: '2026-08-24T20:05:00' },
    },
  ];

  for (const r of reservas) {
    await prisma.reserva.upsert({
      where: { id: r.id },
      update: {},
      create: {
        id: r.id,
        canchaId: r.canchaId,
        clienteId: r.clienteId,
        fecha: new Date(`${r.fecha}T00:00:00`),
        horaInicioMin: r.horaInicioMin,
        horaFinMin: r.horaFinMin,
        estado: r.estado,
        formaPago: r.formaPago,
        precioTotalQ: r.precioTotalQ,
      },
    });
    if (r.pago) {
      await prisma.pago.upsert({
        where: { id: `${r.id}-pago` },
        update: {},
        create: {
          id: `${r.id}-pago`,
          tipoReferencia: TipoPagoReferencia.RESERVA,
          referenciaId: r.id,
          reservaId: r.id,
          gateway: r.pago.gateway,
          montoQ: r.precioTotalQ,
          estado: r.pago.estado,
          creadoEn: new Date(r.pago.creadoEn),
          confirmadoEn: r.pago.confirmadoEn ? new Date(r.pago.confirmadoEn) : null,
        },
      });
    }
  }

  // ---- Torneo (Fase 3) ----
  const torneo = await prisma.torneo.upsert({
    where: { id: 'demo-torneo-1' },
    update: {},
    create: {
      id: 'demo-torneo-1',
      nombre: 'Copa Demo Antigua',
      descripcion: 'Torneo de demostración para probar el módulo de torneos.',
      formato: FormatoTorneo.LIGA,
      categoria: 'Libre',
      maxEquipos: 6,
      cuotaInscripcionQ: 100,
      fechaInicio: new Date('2026-09-05T00:00:00'),
      fechaLimiteInscripcion: new Date('2026-09-01T00:00:00'),
      estado: EstadoTorneo.EN_CURSO,
    },
  });

  const equiposData = [
    { id: 'demo-equipo-1', nombre: 'Demo FC Volcán', capitanNombre: 'Josué Panjoj', capitanTelefono: '50092001', jugadores: ['Josué Panjoj', 'Elder Coc', 'Mynor Sac'] },
    { id: 'demo-equipo-2', nombre: 'Demo Deportivo Antigua', capitanNombre: 'Rudy Chavajay', capitanTelefono: '50092002', jugadores: ['Rudy Chavajay', 'Estuardo Mux', 'Selvin Ba'] },
    { id: 'demo-equipo-3', nombre: 'Demo Real Chajón', capitanNombre: 'Wilmer Tuy', capitanTelefono: '50092003', jugadores: ['Wilmer Tuy', 'Nery Cutzal', 'Edwin Sisay'] },
    { id: 'demo-equipo-4', nombre: 'Demo Atlético Combo', capitanNombre: 'Fredy Choc', capitanTelefono: '50092004', jugadores: ['Fredy Choc', 'Amilcar Us', 'Danilo Tay'] },
  ];
  for (const e of equiposData) {
    await prisma.equipo.upsert({
      where: { torneoId_nombre: { torneoId: torneo.id, nombre: e.nombre } },
      update: {},
      create: { id: e.id, torneoId: torneo.id, nombre: e.nombre, capitanNombre: e.capitanNombre, capitanTelefono: e.capitanTelefono, jugadores: e.jugadores },
    });
  }

  const partidosData = [
    { id: 'demo-partido-1', jornada: 1, posicion: 0, localId: 'demo-equipo-1', visitanteId: 'demo-equipo-2', golesLocal: 3, golesVisitante: 1, fechaJuego: '2026-09-06' },
    { id: 'demo-partido-2', jornada: 1, posicion: 1, localId: 'demo-equipo-3', visitanteId: 'demo-equipo-4', golesLocal: 2, golesVisitante: 2, fechaJuego: '2026-09-06' },
    { id: 'demo-partido-3', jornada: 2, posicion: 0, localId: 'demo-equipo-1', visitanteId: 'demo-equipo-3', golesLocal: null, golesVisitante: null, fechaJuego: '2026-09-27' },
    { id: 'demo-partido-4', jornada: 2, posicion: 1, localId: 'demo-equipo-2', visitanteId: 'demo-equipo-4', golesLocal: null, golesVisitante: null, fechaJuego: '2026-09-27' },
  ];
  for (const p of partidosData) {
    await prisma.partido.upsert({
      where: { id: p.id },
      update: {},
      create: {
        id: p.id,
        torneoId: torneo.id,
        jornada: p.jornada,
        posicion: p.posicion,
        localId: p.localId,
        visitanteId: p.visitanteId,
        golesLocal: p.golesLocal,
        golesVisitante: p.golesVisitante,
        fechaJuego: new Date(`${p.fechaJuego}T00:00:00`),
      },
    });
  }

  // Cuota de inscripcion de dos equipos: una pagada, una pendiente (vencida) para morosidad.
  await prisma.pago.upsert({
    where: { id: 'demo-pago-equipo-1' },
    update: {},
    create: {
      id: 'demo-pago-equipo-1', tipoReferencia: TipoPagoReferencia.EQUIPO, referenciaId: 'demo-equipo-1',
      gateway: GatewayPago.EFECTIVO, montoQ: 100, estado: EstadoPago.COMPLETADO,
      creadoEn: new Date('2026-09-01T10:00:00'), confirmadoEn: new Date('2026-09-01T10:05:00'),
    },
  });
  await prisma.pago.upsert({
    where: { id: 'demo-pago-equipo-2' },
    update: {},
    create: {
      id: 'demo-pago-equipo-2', tipoReferencia: TipoPagoReferencia.EQUIPO, referenciaId: 'demo-equipo-2',
      gateway: GatewayPago.BAC, montoQ: 100, estado: EstadoPago.PENDIENTE,
      creadoEn: new Date('2026-09-02T10:00:00'),
    },
  });

  // Mas torneos (en distintas etapas) para que la pantalla de Torneos no
  // dependa de uno solo. Equipo + cuota de inscripcion via este helper.
  async function registrarEquipo(
    torneoId: string,
    equipo: { id: string; nombre: string; capitanNombre: string; capitanTelefono: string; jugadores: string[] },
    pago: { id: string; estado: EstadoPago; gateway: GatewayPago; creadoEn: string; confirmadoEn?: string },
    cuotaQ: number,
  ) {
    await prisma.equipo.upsert({
      where: { torneoId_nombre: { torneoId, nombre: equipo.nombre } },
      update: {},
      create: { id: equipo.id, torneoId, nombre: equipo.nombre, capitanNombre: equipo.capitanNombre, capitanTelefono: equipo.capitanTelefono, jugadores: equipo.jugadores },
    });
    await prisma.pago.upsert({
      where: { id: pago.id },
      update: {},
      create: {
        id: pago.id, tipoReferencia: TipoPagoReferencia.EQUIPO, referenciaId: equipo.id,
        gateway: pago.gateway, montoQ: cuotaQ, estado: pago.estado,
        creadoEn: new Date(pago.creadoEn), confirmadoEn: pago.confirmadoEn ? new Date(pago.confirmadoEn) : null,
      },
    });
  }

  const torneo2 = await prisma.torneo.upsert({
    where: { id: 'demo-torneo-2' },
    update: {},
    create: {
      id: 'demo-torneo-2', nombre: 'Liga Juvenil Demo', descripcion: 'Torneo de demostración, inscripciones abiertas.',
      formato: FormatoTorneo.LIGA, categoria: 'Sub-18', maxEquipos: 8, cuotaInscripcionQ: 80,
      fechaInicio: new Date('2026-10-10T00:00:00'), fechaLimiteInscripcion: new Date('2026-10-05T00:00:00'),
      estado: EstadoTorneo.INSCRIPCIONES_ABIERTAS,
    },
  });
  await registrarEquipo(torneo2.id,
    { id: 'demo-equipo-5', nombre: 'Demo Juventud FC', capitanNombre: 'Hector Lares', capitanTelefono: '50092005', jugadores: ['Hector Lares', 'Axel Toc'] },
    { id: 'demo-pago-equipo-5', estado: EstadoPago.COMPLETADO, gateway: GatewayPago.EFECTIVO, creadoEn: '2026-09-20T10:00:00', confirmadoEn: '2026-09-20T10:05:00' }, 80);
  await registrarEquipo(torneo2.id,
    { id: 'demo-equipo-6', nombre: 'Demo Halcones Antigua', capitanNombre: 'Brayan Sis', capitanTelefono: '50092006', jugadores: ['Brayan Sis', 'Yovani Sac'] },
    { id: 'demo-pago-equipo-6', estado: EstadoPago.PENDIENTE, gateway: GatewayPago.BAC, creadoEn: '2026-09-22T10:00:00' }, 80);

  const torneo3 = await prisma.torneo.upsert({
    where: { id: 'demo-torneo-3' },
    update: {},
    create: {
      id: 'demo-torneo-3', nombre: 'Copa Relámpago Demo', descripcion: 'Torneo de demostración, aún no inicia.',
      formato: FormatoTorneo.ELIMINACION_DIRECTA, categoria: 'Libre', maxEquipos: 8, cuotaInscripcionQ: 60,
      fechaInicio: new Date('2026-11-01T00:00:00'), fechaLimiteInscripcion: new Date('2026-10-25T00:00:00'),
      estado: EstadoTorneo.PROXIMO,
    },
  });
  await registrarEquipo(torneo3.id,
    { id: 'demo-equipo-7', nombre: 'Demo Rayo Veloz', capitanNombre: 'Nestor Quej', capitanTelefono: '50092007', jugadores: ['Nestor Quej', 'Ottoniel Chen'] },
    { id: 'demo-pago-equipo-7', estado: EstadoPago.COMPLETADO, gateway: GatewayPago.NEONET, creadoEn: '2026-09-25T10:00:00', confirmadoEn: '2026-09-25T10:03:00' }, 60);
  await registrarEquipo(torneo3.id,
    { id: 'demo-equipo-8', nombre: 'Demo Tigres del Valle', capitanNombre: 'Ismael Boch', capitanTelefono: '50092008', jugadores: ['Ismael Boch', 'Rolando Perez'] },
    { id: 'demo-pago-equipo-8', estado: EstadoPago.COMPLETADO, gateway: GatewayPago.EFECTIVO, creadoEn: '2026-09-26T10:00:00', confirmadoEn: '2026-09-26T10:04:00' }, 60);

  const torneo4 = await prisma.torneo.upsert({
    where: { id: 'demo-torneo-4' },
    update: {},
    create: {
      id: 'demo-torneo-4', nombre: 'Copa Verano Demo', descripcion: 'Torneo de demostración, ya finalizado.',
      formato: FormatoTorneo.ELIMINACION_DIRECTA, categoria: 'Libre', maxEquipos: 4, cuotaInscripcionQ: 100,
      fechaInicio: new Date('2026-07-01T00:00:00'), fechaLimiteInscripcion: new Date('2026-06-25T00:00:00'),
      estado: EstadoTorneo.FINALIZADO,
    },
  });
  await registrarEquipo(torneo4.id,
    { id: 'demo-equipo-9', nombre: 'Demo Unión Antigua', capitanNombre: 'Diego Cholotio', capitanTelefono: '50092009', jugadores: ['Diego Cholotio', 'Marco Sical'] },
    { id: 'demo-pago-equipo-9', estado: EstadoPago.COMPLETADO, gateway: GatewayPago.EFECTIVO, creadoEn: '2026-06-26T10:00:00', confirmadoEn: '2026-06-26T10:05:00' }, 100);
  await registrarEquipo(torneo4.id,
    { id: 'demo-equipo-10', nombre: 'Demo Estrella Roja', capitanNombre: 'Pedro Us', capitanTelefono: '50092010', jugadores: ['Pedro Us', 'Baltazar Che'] },
    { id: 'demo-pago-equipo-10', estado: EstadoPago.COMPLETADO, gateway: GatewayPago.BAC, creadoEn: '2026-06-27T10:00:00', confirmadoEn: '2026-06-27T10:04:00' }, 100);
  await registrarEquipo(torneo4.id,
    { id: 'demo-equipo-11', nombre: 'Demo Fénix FC', capitanNombre: 'Jorge Cutz', capitanTelefono: '50092011', jugadores: ['Jorge Cutz', 'Samuel Pirir'] },
    { id: 'demo-pago-equipo-11', estado: EstadoPago.COMPLETADO, gateway: GatewayPago.NEONET, creadoEn: '2026-06-28T10:00:00', confirmadoEn: '2026-06-28T10:06:00' }, 100);
  await registrarEquipo(torneo4.id,
    { id: 'demo-equipo-12', nombre: 'Demo Centinelas', capitanNombre: 'Carlos Yantuche', capitanTelefono: '50092012', jugadores: ['Carlos Yantuche', 'Amilcar Sojuel'] },
    { id: 'demo-pago-equipo-12', estado: EstadoPago.COMPLETADO, gateway: GatewayPago.EFECTIVO, creadoEn: '2026-06-29T10:00:00', confirmadoEn: '2026-06-29T10:05:00' }, 100);

  const partidosTorneo4 = [
    { id: 'demo-partido-5', jornada: 1, posicion: 0, localId: 'demo-equipo-9', visitanteId: 'demo-equipo-10', golesLocal: 2, golesVisitante: 0, fechaJuego: '2026-07-10' },
    { id: 'demo-partido-6', jornada: 1, posicion: 1, localId: 'demo-equipo-11', visitanteId: 'demo-equipo-12', golesLocal: 1, golesVisitante: 3, fechaJuego: '2026-07-10' },
  ];
  for (const p of partidosTorneo4) {
    await prisma.partido.upsert({
      where: { id: p.id },
      update: {},
      create: {
        id: p.id, torneoId: torneo4.id, jornada: p.jornada, posicion: p.posicion,
        localId: p.localId, visitanteId: p.visitanteId, golesLocal: p.golesLocal, golesVisitante: p.golesVisitante,
        fechaJuego: new Date(`${p.fechaJuego}T00:00:00`),
      },
    });
  }

  // ---- Academia (Fase 4) ----
  const alumnosData = [
    { id: 'demo-alumno-1', nombres: 'Demo - Sofía Morales', fechaNacimiento: '2016-03-10', categoria: 'Sub-12', encargadoNombre: 'Demo - Carla Morales', encargadoTelefono: '50093001' },
    { id: 'demo-alumno-2', nombres: 'Demo - Diego Set', fechaNacimiento: '2014-02-01', categoria: 'Sub-14', encargadoNombre: 'Demo - Hugo Set', encargadoTelefono: '50093002' },
    { id: 'demo-alumno-3', nombres: 'Demo - Valeria Coy', fechaNacimiento: '2011-05-04', categoria: 'Sub-16', encargadoNombre: 'Demo - Ingrid Coy', encargadoTelefono: '50093003' },
    { id: 'demo-alumno-4', nombres: 'Demo - Emilio Rax', fechaNacimiento: '2017-01-15', categoria: 'Sub-10', encargadoNombre: 'Demo - Walter Rax', encargadoTelefono: '50093004' },
    { id: 'demo-alumno-5', nombres: 'Demo - Ana Xoc', fechaNacimiento: '2019-06-20', categoria: 'Sub-8', encargadoNombre: 'Demo - Miriam Xoc', encargadoTelefono: '50093005' },
    { id: 'demo-alumno-6', nombres: 'Demo - Brandon Cotí', fechaNacimiento: '2012-11-02', categoria: 'Sub-16', encargadoNombre: 'Demo - Elvira Cotí', encargadoTelefono: '50093006' },
    { id: 'demo-alumno-7', nombres: 'Demo - Katherin Ixcot', fechaNacimiento: '2009-08-18', categoria: 'Sub-18', encargadoNombre: 'Demo - Roberto Ixcot', encargadoTelefono: '50093007' },
    { id: 'demo-alumno-8', nombres: 'Demo - Mateo Xico', fechaNacimiento: '2015-04-12', categoria: 'Sub-12', encargadoNombre: 'Demo - Rosa Xico', encargadoTelefono: '50093008' },
    { id: 'demo-alumno-9', nombres: 'Demo - Daniela Pop', fechaNacimiento: '2013-09-25', categoria: 'Sub-14', encargadoNombre: 'Demo - Julio Pop', encargadoTelefono: '50093009' },
    { id: 'demo-alumno-10', nombres: 'Demo - Esteban Yool', fechaNacimiento: '2010-12-03', categoria: 'Sub-16', encargadoNombre: 'Demo - Marta Yool', encargadoTelefono: '50093010' },
    { id: 'demo-alumno-11', nombres: 'Demo - Camila Ajtun', fechaNacimiento: '2018-02-14', categoria: 'Sub-8', encargadoNombre: 'Demo - Pablo Ajtun', encargadoTelefono: '50093011' },
    { id: 'demo-alumno-12', nombres: 'Demo - Luis Chalí', fechaNacimiento: '2008-07-30', categoria: 'Sub-18', encargadoNombre: 'Demo - Elena Chalí', encargadoTelefono: '50093012' },
  ];
  for (const a of alumnosData) {
    await prisma.alumno.upsert({
      where: { id: a.id },
      update: {},
      create: { ...a, fechaNacimiento: new Date(`${a.fechaNacimiento}T00:00:00`) },
    });
  }

  const mensualidades = [
    { alumnoId: 'demo-alumno-1', mes: 9, anio: 2026, montoQ: 150, avisoVencidoEnviado: false, pago: { estado: EstadoPago.COMPLETADO, creadoEn: '2026-09-02T09:00:00', confirmadoEn: '2026-09-02T09:10:00' } },
    { alumnoId: 'demo-alumno-2', mes: 9, anio: 2026, montoQ: 150, avisoVencidoEnviado: false, pago: { estado: EstadoPago.COMPLETADO, creadoEn: '2026-09-03T09:00:00', confirmadoEn: '2026-09-03T09:12:00' } },
    { alumnoId: 'demo-alumno-3', mes: 9, anio: 2026, montoQ: 150, avisoVencidoEnviado: true, pago: { estado: EstadoPago.PENDIENTE, creadoEn: '2026-09-05T09:00:00' } },
    { alumnoId: 'demo-alumno-4', mes: 9, anio: 2026, montoQ: 150, avisoVencidoEnviado: false, pago: { estado: EstadoPago.PENDIENTE, creadoEn: '2026-09-16T09:00:00' } },
    { alumnoId: 'demo-alumno-5', mes: 9, anio: 2026, montoQ: 150, avisoVencidoEnviado: false, pago: { estado: EstadoPago.COMPLETADO, creadoEn: '2026-09-04T09:00:00', confirmadoEn: '2026-09-04T09:08:00' } },
    { alumnoId: 'demo-alumno-6', mes: 9, anio: 2026, montoQ: 150, avisoVencidoEnviado: false, pago: { estado: EstadoPago.COMPLETADO, creadoEn: '2026-09-06T09:00:00', confirmadoEn: '2026-09-06T09:09:00' } },
    { alumnoId: 'demo-alumno-7', mes: 9, anio: 2026, montoQ: 150, avisoVencidoEnviado: true, pago: { estado: EstadoPago.PENDIENTE, creadoEn: '2026-09-01T09:00:00' } },
    { alumnoId: 'demo-alumno-8', mes: 9, anio: 2026, montoQ: 150, avisoVencidoEnviado: false, pago: { estado: EstadoPago.COMPLETADO, creadoEn: '2026-09-07T09:00:00', confirmadoEn: '2026-09-07T09:05:00' } },
    { alumnoId: 'demo-alumno-9', mes: 9, anio: 2026, montoQ: 150, avisoVencidoEnviado: false, pago: { estado: EstadoPago.COMPLETADO, creadoEn: '2026-09-08T09:00:00', confirmadoEn: '2026-09-08T09:07:00' } },
    { alumnoId: 'demo-alumno-10', mes: 9, anio: 2026, montoQ: 150, avisoVencidoEnviado: false, pago: { estado: EstadoPago.PENDIENTE, creadoEn: '2026-09-14T09:00:00' } },
    { alumnoId: 'demo-alumno-11', mes: 9, anio: 2026, montoQ: 150, avisoVencidoEnviado: false, pago: { estado: EstadoPago.COMPLETADO, creadoEn: '2026-09-09T09:00:00', confirmadoEn: '2026-09-09T09:06:00' } },
    { alumnoId: 'demo-alumno-12', mes: 9, anio: 2026, montoQ: 150, avisoVencidoEnviado: true, pago: { estado: EstadoPago.PENDIENTE, creadoEn: '2026-09-02T09:00:00' } },
  ];
  for (const m of mensualidades) {
    const registro = await prisma.academiaMensualidad.upsert({
      where: { alumnoId_mes_anio: { alumnoId: m.alumnoId, mes: m.mes, anio: m.anio } },
      update: {},
      create: { alumnoId: m.alumnoId, mes: m.mes, anio: m.anio, montoQ: m.montoQ, avisoVencidoEnviado: m.avisoVencidoEnviado },
    });
    await prisma.pago.upsert({
      where: { id: `demo-pago-mensualidad-${m.alumnoId}` },
      update: {},
      create: {
        id: `demo-pago-mensualidad-${m.alumnoId}`, tipoReferencia: TipoPagoReferencia.MENSUALIDAD, referenciaId: registro.id,
        gateway: GatewayPago.EFECTIVO, montoQ: m.montoQ, estado: m.pago.estado,
        creadoEn: new Date(m.pago.creadoEn), confirmadoEn: m.pago.confirmadoEn ? new Date(m.pago.confirmadoEn) : null,
      },
    });
  }

  // Mensualidades de meses anteriores (julio/agosto) para todos los alumnos,
  // asi hay historial de pagos mas alla del mes actual. demo-alumno-4 queda
  // moroso en agosto (mismo "pagador tardon" que ya se ve en su asistencia).
  for (const mes of [7, 8]) {
    for (const alumnoId of alumnosData.map((a) => a.id)) {
      const moroso = alumnoId === 'demo-alumno-4' && mes === 8;
      const registro = await prisma.academiaMensualidad.upsert({
        where: { alumnoId_mes_anio: { alumnoId, mes, anio: 2026 } },
        update: {},
        create: { alumnoId, mes, anio: 2026, montoQ: 150, avisoVencidoEnviado: moroso },
      });
      await prisma.pago.upsert({
        where: { id: `demo-pago-mensualidad-${alumnoId}-${mes}` },
        update: {},
        create: {
          id: `demo-pago-mensualidad-${alumnoId}-${mes}`, tipoReferencia: TipoPagoReferencia.MENSUALIDAD, referenciaId: registro.id,
          gateway: GatewayPago.EFECTIVO, montoQ: 150, estado: moroso ? EstadoPago.PENDIENTE : EstadoPago.COMPLETADO,
          creadoEn: new Date(`2026-0${mes}-05T09:00:00`), confirmadoEn: moroso ? null : new Date(`2026-0${mes}-05T09:10:00`),
        },
      });
    }
  }

  const fechasEntrenamiento = ['2026-08-04', '2026-08-18', '2026-09-08', '2026-09-11', '2026-09-15'];
  for (const alumnoId of alumnosData.map((a) => a.id)) {
    for (const fecha of fechasEntrenamiento) {
      // Un ausente ocasional (alumno-4 el 11) para que la asistencia se vea real, no 100% perfecta.
      const presente = !(alumnoId === 'demo-alumno-4' && fecha === '2026-09-11');
      await prisma.asistencia.upsert({
        where: { alumnoId_fecha: { alumnoId, fecha: new Date(`${fecha}T00:00:00`) } },
        update: {},
        create: { alumnoId, fecha: new Date(`${fecha}T00:00:00`), presente },
      });
    }
  }

  // ---- Tienda (Fase 6): productos + ventas con sus pagos ----
  const productosData = [
    { id: 'demo-producto-1', nombre: 'Demo - Agua pura 600ml', categoria: ProductoCategoria.TIENDA, precioQ: 10 },
    { id: 'demo-producto-2', nombre: 'Demo - Bebida isotónica', categoria: ProductoCategoria.TIENDA, precioQ: 15 },
    { id: 'demo-producto-3', nombre: 'Demo - Balón fútbol #5', categoria: ProductoCategoria.TIENDA, precioQ: 180 },
    { id: 'demo-producto-4', nombre: 'Demo - Guantes de portero', categoria: ProductoCategoria.TIENDA, precioQ: 220 },
    { id: 'demo-producto-5', nombre: 'Demo - Papitas', categoria: ProductoCategoria.TIENDA, precioQ: 8 },
  ];
  const precioProducto = new Map(productosData.map((p) => [p.id, p.precioQ]));
  for (const p of productosData) {
    await prisma.producto.upsert({ where: { id: p.id }, update: {}, create: p });
  }

  const ventasData = [
    { id: 'demo-venta-1', clienteId: 'demo-cliente-1', fecha: '2026-09-03T18:30:00', items: [{ productoId: 'demo-producto-1', cantidad: 2 }, { productoId: 'demo-producto-5', cantidad: 1 }] },
    { id: 'demo-venta-2', clienteId: null, fecha: '2026-09-04T19:30:00', items: [{ productoId: 'demo-producto-2', cantidad: 3 }] },
    { id: 'demo-venta-3', clienteId: 'demo-cliente-3', fecha: '2026-09-06T20:15:00', items: [{ productoId: 'demo-producto-3', cantidad: 1 }] },
    { id: 'demo-venta-4', clienteId: null, fecha: '2026-09-08T17:20:00', items: [{ productoId: 'demo-producto-1', cantidad: 1 }, { productoId: 'demo-producto-2', cantidad: 1 }] },
    { id: 'demo-venta-5', clienteId: 'demo-cliente-6', fecha: '2026-09-11T18:30:00', items: [{ productoId: 'demo-producto-4', cantidad: 1 }] },
    { id: 'demo-venta-6', clienteId: null, fecha: '2026-09-15T20:30:00', items: [{ productoId: 'demo-producto-5', cantidad: 2 }, { productoId: 'demo-producto-1', cantidad: 2 }] },
    { id: 'demo-venta-7', clienteId: 'demo-cliente-7', fecha: '2026-09-01T17:15:00', items: [{ productoId: 'demo-producto-2', cantidad: 2 }] },
    { id: 'demo-venta-8', clienteId: 'demo-cliente-8', fecha: '2026-09-05T19:20:00', items: [{ productoId: 'demo-producto-3', cantidad: 1 }, { productoId: 'demo-producto-1', cantidad: 1 }] },
  ];
  for (const v of ventasData) {
    const montoTotalQ = v.items.reduce((suma, it) => suma + precioProducto.get(it.productoId)! * it.cantidad, 0);
    const creadoEn = new Date(v.fecha);
    await prisma.venta.upsert({
      where: { id: v.id },
      update: {},
      create: { id: v.id, clienteId: v.clienteId, montoTotalQ, creadoEn },
    });
    for (const [i, it] of v.items.entries()) {
      const precioUnitarioQ = precioProducto.get(it.productoId)!;
      const producto = productosData.find((p) => p.id === it.productoId)!;
      await prisma.ventaItem.upsert({
        where: { id: `${v.id}-item-${i + 1}` },
        update: {},
        create: {
          id: `${v.id}-item-${i + 1}`, ventaId: v.id, productoId: it.productoId,
          nombreSnapshot: producto.nombre, cantidad: it.cantidad,
          precioUnitarioQ, subtotalQ: precioUnitarioQ * it.cantidad,
        },
      });
    }
    await prisma.pago.upsert({
      where: { id: `${v.id}-pago` },
      update: {},
      create: {
        id: `${v.id}-pago`, tipoReferencia: TipoPagoReferencia.VENTA, referenciaId: v.id,
        gateway: GatewayPago.EFECTIVO, montoQ: montoTotalQ, estado: EstadoPago.COMPLETADO,
        creadoEn, confirmadoEn: creadoEn,
      },
    });
  }

  console.log('Listo:');
  console.log(`  - ${clientesData.length} clientes demo`);
  console.log(`  - ${reservas.length} reservas demo (+ pagos), repartidas en agosto y septiembre 2026`);
  console.log('  - 4 torneos demo (uno por cada etapa: en curso, inscripciones abiertas, proximo, finalizado)');
  console.log(`  - ${alumnosData.length} alumnos demo con mensualidades (jul/ago/sep) y asistencia`);
  console.log(`  - ${productosData.length} productos demo y ${ventasData.length} ventas de tienda (+ pagos)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
