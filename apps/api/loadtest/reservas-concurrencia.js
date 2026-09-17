/**
 * Prueba de carga: POST /reservas — concurrencia sobre el MISMO horario
 *
 * Esta es la prueba de carga mas importante del sistema (ver Plan
 * Tecnico, Fase 5 / Sprint 1): valida bajo trafico REAL simultaneo, no
 * solo con mocks en un test unitario, que el lock de Redis + la
 * verificacion en transaccion de Prisma (ver ReservasService.crearReserva)
 * realmente evitan que dos clientes se queden con el mismo horario.
 *
 * Dispara N peticiones simultaneas para reservar EXACTAMENTE el mismo
 * horario, con clientes (telefonos) distintos, y verifica que solo UNA
 * tenga exito.
 *
 * COMO CORRERLA (requiere instalar k6 y tener el backend + Postgres +
 * Redis corriendo, ver README seccion 3):
 *   CANCHA_ID=<id-real> FECHA=2026-08-15 HORA=20:00 k6 run loadtest/reservas-concurrencia.js
 *
 * IMPORTANTE: usa una fecha/hora que sepas que esta libre antes de correr
 * la prueba (revisa con GET /canchas/:id/disponibilidad primero), o vas a
 * obtener resultados confusos por horarios ya ocupados de pruebas previas.
 *
 * Despues de correrla, confirma en `npm run prisma:studio` que existe
 * EXACTAMENTE UNA fila en `reservas` para ese cancha+fecha+hora en estado
 * activo (no LIBERADA ni CANCELADA) — eso es lo que realmente prueba que
 * el sistema es seguro, mas alla de lo que reporte k6.
 */
import http from 'k6/http';
import { check } from 'k6';
import { Counter } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';
const CANCHA_ID = __ENV.CANCHA_ID || 'seed-cancha-futbol-5';
const FECHA = __ENV.FECHA || new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
const HORA = __ENV.HORA || '20:00';

const reservasExitosas = new Counter('reservas_exitosas');
const reservasRechazadas = new Counter('reservas_rechazadas_por_conflicto');

export const options = {
  scenarios: {
    embestida_simultanea: {
      executor: 'shared-iterations',
      vus: 20, // 20 "clientes" distintos
      iterations: 20, // cada uno hace UN intento, todos al mismo horario
      maxDuration: '30s',
    },
  },
  // Umbral para que la prueba FALLE (exit != 0) si el resultado no es
  // exactamente 1 reserva exitosa: permite usarla como gate en CI
  // (loadtest.yml), no solo como test manual. Ver handleSummary().
  thresholds: {
    reservas_exitosas: ['count == 1'],
  },
};

export default function () {
  const telefonoUnico = `502555${String(__VU).padStart(5, '0')}`;

  const payload = JSON.stringify({
    canchaId: CANCHA_ID,
    clienteTelefono: telefonoUnico,
    clienteNombre: `Cliente Prueba ${__VU}`,
    fecha: FECHA,
    horaInicio: HORA,
    formaPago: 'EN_SEDE',
  });

  const respuesta = http.post(`${BASE_URL}/reservas`, payload, {
    headers: { 'Content-Type': 'application/json' },
  });

  const exito = respuesta.status === 201;
  const conflicto = respuesta.status === 409;

  check(respuesta, {
    'responde 201 (exito) o 409 (conflicto) — nunca otra cosa': () => exito || conflicto,
  });

  if (exito) reservasExitosas.add(1);
  if (conflicto) reservasRechazadas.add(1);
}

export function handleSummary(data) {
  const exitosas = data.metrics.reservas_exitosas?.values?.count ?? 0;
  const rechazadas = data.metrics.reservas_rechazadas_por_conflicto?.values?.count ?? 0;

  console.log(`\n=== Resultado de la prueba de concurrencia ===`);
  console.log(`Reservas exitosas: ${exitosas} (deberia ser exactamente 1)`);
  console.log(`Reservas rechazadas por conflicto: ${rechazadas}`);
  console.log(
    exitosas === 1
      ? '✅ El lock funciono correctamente: solo un cliente se quedo con el horario.'
      : '❌ ALERTA: se esperaba exactamente 1 reserva exitosa. Revisar ReservasService.crearReserva.',
  );

  return { stdout: '' }; // evita que k6 imprima el resumen JSON por default encima de este log
}
