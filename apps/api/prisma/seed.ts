/**
 * Script de siembra de datos iniciales.
 * Uso: npm run prisma:seed  (definido en apps/api/package.json)
 *
 * Crea:
 *  - Las 2 canchas del negocio (Futbol 5, Futbol 7) con su horario real.
 *  - Un usuario administrador inicial para poder entrar al panel admin.
 */
import { PrismaClient, TipoCancha, RolUsuario, ProductoCategoria } from '@prisma/client';
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
      horaAperturaMinSemana: 14 * 60,
      horaCierreMinSemana: 22 * 60,
      horaAperturaMinFinde: 8 * 60,
      horaCierreMinFinde: 22 * 60,
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
      horaAperturaMinSemana: 14 * 60,
      horaCierreMinSemana: 22 * 60,
      horaAperturaMinFinde: 8 * 60,
      horaCierreMinFinde: 22 * 60,
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

  // ---- Productos de Caja (placeholders, editables desde /admin/caja/productos) ----
  const productos = [
    { id: 'seed-producto-camiseta-academia', nombre: 'Camiseta Academia', categoria: ProductoCategoria.ACADEMIA, precioQ: 75 },
    { id: 'seed-producto-inscripcion-academia', nombre: 'Inscripcion Academia', categoria: ProductoCategoria.ACADEMIA, precioQ: 250 },
    { id: 'seed-producto-balon', nombre: 'Balon No. 5', categoria: ProductoCategoria.TIENDA, precioQ: 120 },
    { id: 'seed-producto-agua', nombre: 'Botella de agua', categoria: ProductoCategoria.TIENDA, precioQ: 10 },
  ];
  for (const p of productos) {
    await prisma.producto.upsert({ where: { id: p.id }, update: {}, create: p });
  }

  console.log('Listo:');
  console.log(`  - ${canchaF5.nombre} (${canchaF5.id})`);
  console.log(`  - ${canchaF7.nombre} (${canchaF7.id})`);
  console.log(`  - Usuario admin: ${admin.email} / contrasena temporal: CambiarEsta123!`);
  console.log(`  - ${productos.length} productos de Caja sembrados`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
