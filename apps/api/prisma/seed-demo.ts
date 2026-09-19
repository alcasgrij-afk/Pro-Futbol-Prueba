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
 *  - Reservas/pagos usan fechas PASADAS de este mes (1-17 de septiembre 2026),
 *    nunca hoy ni los proximos dias, para no bloquear horarios reales que un
 *    cliente pueda estar por reservar.
 * Para borrar todo: buscar "Demo - " en el panel admin (clientes, alumnos,
 * equipos) y eliminar desde ahi, o filtrar por esos ids en la base de datos.
 */
import { PrismaClient, EstadoReserva, FormaPago, EstadoPago, GatewayPago, TipoPagoReferencia, FormatoTorneo, EstadoTorneo } from '@prisma/client';

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

  // ---- Academia (Fase 4) ----
  const alumnosData = [
    { id: 'demo-alumno-1', nombre: 'Demo - Sofía Morales', fechaNacimiento: '2016-03-10', categoria: 'Sub-12', encargadoNombre: 'Demo - Carla Morales', encargadoTelefono: '50093001' },
    { id: 'demo-alumno-2', nombre: 'Demo - Diego Set', fechaNacimiento: '2014-02-01', categoria: 'Sub-14', encargadoNombre: 'Demo - Hugo Set', encargadoTelefono: '50093002' },
    { id: 'demo-alumno-3', nombre: 'Demo - Valeria Coy', fechaNacimiento: '2011-05-04', categoria: 'Sub-16', encargadoNombre: 'Demo - Ingrid Coy', encargadoTelefono: '50093003' },
    { id: 'demo-alumno-4', nombre: 'Demo - Emilio Rax', fechaNacimiento: '2017-01-15', categoria: 'Sub-10', encargadoNombre: 'Demo - Walter Rax', encargadoTelefono: '50093004' },
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

  const fechasEntrenamiento = ['2026-09-08', '2026-09-11', '2026-09-15'];
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

  console.log('Listo:');
  console.log(`  - ${clientesData.length} clientes demo`);
  console.log(`  - ${reservas.length} reservas demo (+ pagos)`);
  console.log(`  - 1 torneo demo con ${equiposData.length} equipos y ${partidosData.length} partidos`);
  console.log(`  - ${alumnosData.length} alumnos demo con mensualidades y asistencia`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
