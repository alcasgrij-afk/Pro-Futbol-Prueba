/**
 * Prueba de carga: GET /canchas/:id/disponibilidad
 *
 * Este es el endpoint de lectura mas visitado del sistema (lo llaman el
 * bot, el sitio web, y se refresca cada vez que un cliente cambia de
 * fecha/horario durante una reserva). El objetivo de esta prueba es
 * confirmar que responde rapido incluso con trafico simultaneo alto.
 *
 * COMO CORRERLA (requiere instalar k6: https://k6.io/docs/get-started/installation/):
 *   CANCHA_ID=<id-real-de-una-cancha> k6 run loadtest/disponibilidad.js
 *
 * Si no se especifica CANCHA_ID, usa el id de la cancha sembrada por
 * prisma/seed.ts (seed-cancha-futbol-5).
 */
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';
const CANCHA_ID = __ENV.CANCHA_ID || 'seed-cancha-futbol-5';

export const options = {
  scenarios: {
    trafico_normal: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 20 }, // sube gradual a 20 usuarios simultaneos
        { duration: '1m', target: 20 },  // sostiene 20 usuarios simultaneos 1 minuto
        { duration: '15s', target: 0 },  // baja gradual
      ],
    },
  },
  thresholds: {
    // Si mas del 5% de las peticiones fallan, o el 95% no responde en
    // menos de 500ms, la prueba se considera fallida.
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<500'],
  },
};

export default function () {
  const hoy = new Date().toISOString().slice(0, 10);
  const respuesta = http.get(`${BASE_URL}/canchas/${CANCHA_ID}/disponibilidad?fecha=${hoy}`);

  check(respuesta, {
    'responde 200': (r) => r.status === 200,
    'devuelve bloques': (r) => JSON.parse(r.body).bloques?.length > 0,
  });

  sleep(1);
}
