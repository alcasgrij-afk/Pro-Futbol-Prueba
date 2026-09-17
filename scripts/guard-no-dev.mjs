// Guard pre-build (Node 20+): aborta `npm run build` si el dev server sigue vivo.
//
// Por que existe: `next build` con `next dev` activo sobrescribe `.next` con
// artefactos de produccion, y el dev server (webpack) queda leyendo un
// directorio contaminado -> "Cannot find module './383.js'".
// (Next.js no distingue: ambas rutas comparten el mismo `.next`.)
//
// Fix manual si alguien lo rompe igual:
//   1. Ctrl+C en el dev server / matar el proceso del puerto
//   2. rm -rf apps/web/.next
//   3. npm run dev   (o `npm run build` con el dev detenido)
import net from 'node:net';

// Puertos que usa el dev server (web y api: ver README, seccion 7).
const PUERTOS_DEV = [3000, 3001];

function estaEscuchando(puerto) {
  return new Promise((resolve) => {
    const socket = net.connect({ port: puerto, host: '127.0.0.1' });
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => resolve(false));
  });
}

const abiertos = [];
for (const puerto of PUERTOS_DEV) {
  if (await estaEscuchando(puerto)) abiertos.push(puerto);
}

if (abiertos.length > 0) {
  console.error(
    `\n[check:no-dev] El dev server sigue corriendo (puerto(s) ${abiertos.join(', ')}).\n` +
      '[check:no-dev] Correr "npm run build" con el dev vivo envenena .next\n' +
      '[check:no-dev]   (error tipico: Cannot find module "./383.js").\n' +
      '[check:no-dev] Paralo primero (Ctrl+C en la terminal del dev) y reintenta.\n' +
      '[check:no-dev] Si ya cargo, limpiar con:  rm -rf apps/web/.next\n',
  );
  process.exit(1);
}

console.log('[check:no-dev] OK: sin dev server activo, el build es seguro.');