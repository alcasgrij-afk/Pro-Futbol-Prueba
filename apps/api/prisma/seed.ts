/**
 * Script de siembra de datos iniciales.
 * Uso: npm run prisma:seed  (definido en apps/api/package.json)
 *
 * Crea:
 *  - Las 2 canchas del negocio (Futbol 5, Futbol 7) con su horario real.
 *  - Un usuario administrador inicial para poder entrar al panel admin.
 */
import { PrismaClient, TipoCancha, RolUsuario } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Sembrando datos iniciales...');

  // ---- Canchas ----
  // Horario de operacion de ejemplo: 08:00 a 22:00 (480 a 1320 minutos).
  // Ajustar segun el horario real del negocio antes de ir a produccion.
  const canchaF5 = await prisma.cancha.upsert({
    where: { id: 'seed-cancha-futbol-5' },
    update: {},
    create: {
      id: 'seed-cancha-futbol-5',
      nombre: 'Cancha 1 - Futbol 5',
      tipo: TipoCancha.FUTBOL_5,
      precioAnticipadoQ: 250,
      precioSedeQ: 300,
      horaAperturaMin: 8 * 60,
      horaCierreMin: 22 * 60,
      duracionBloqueMin: 60,
    },
  });

  const canchaF7 = await prisma.cancha.upsert({
    where: { id: 'seed-cancha-futbol-7' },
    update: {},
    create: {
      id: 'seed-cancha-futbol-7',
      nombre: 'Cancha 2 - Futbol 7',
      tipo: TipoCancha.FUTBOL_7,
      precioAnticipadoQ: 350,
      precioSedeQ: 420,
      horaAperturaMin: 8 * 60,
      horaCierreMin: 22 * 60,
      duracionBloqueMin: 60,
    },
  });

  // ---- Usuario administrador inicial ----
  // IMPORTANTE: cambiar esta contrasena inmediatamente despues del primer
  // login en cualquier ambiente que no sea desarrollo local.
  const passwordHash = await bcrypt.hash('CambiarEsta123!', 10);
  const admin = await prisma.usuario.upsert({
    where: { email: 'admin@profutbolantigua.com' },
    update: {},
    create: {
      nombre: 'Administrador',
      email: 'admin@profutbolantigua.com',
      passwordHash,
      rol: RolUsuario.ADMIN,
    },
  });

  console.log('Listo:');
  console.log(`  - ${canchaF5.nombre} (${canchaF5.id})`);
  console.log(`  - ${canchaF7.nombre} (${canchaF7.id})`);
  console.log(`  - Usuario admin: ${admin.email} / contrasena temporal: CambiarEsta123!`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
