-- CreateEnum
CREATE TYPE "TipoReserva" AS ENUM ('NORMAL', 'ESPECIAL', 'ACADEMIA');

-- AlterTable: renombrar en vez de drop+add para no perder los nombres ya cargados.
ALTER TABLE "alumnos" RENAME COLUMN "nombre" TO "nombres";
ALTER TABLE "alumnos" ADD COLUMN     "apellidos" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "pagos" ADD COLUMN     "numeroRecibo" TEXT;

-- AlterTable
ALTER TABLE "reservas" ADD COLUMN     "tipo" "TipoReserva" NOT NULL DEFAULT 'NORMAL';

-- CreateTable
CREATE TABLE "recibo_contadores" (
    "anio" INTEGER NOT NULL,
    "ultimoNumero" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "recibo_contadores_pkey" PRIMARY KEY ("anio")
);

-- CreateTable
CREATE TABLE "reservas_recurrentes" (
    "id" TEXT NOT NULL,
    "canchaId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "tipo" "TipoReserva" NOT NULL,
    "diaSemana" INTEGER NOT NULL,
    "horaInicioMin" INTEGER NOT NULL,
    "horaFinMin" INTEGER NOT NULL,
    "fechaInicio" DATE NOT NULL,
    "fechaFin" DATE,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reservas_recurrentes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clientes_valorados" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clientes_valorados_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "clientes_valorados_clienteId_key" ON "clientes_valorados"("clienteId");

-- CreateIndex
CREATE UNIQUE INDEX "pagos_numeroRecibo_key" ON "pagos"("numeroRecibo");

-- AddForeignKey
ALTER TABLE "reservas_recurrentes" ADD CONSTRAINT "reservas_recurrentes_canchaId_fkey" FOREIGN KEY ("canchaId") REFERENCES "canchas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas_recurrentes" ADD CONSTRAINT "reservas_recurrentes_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clientes_valorados" ADD CONSTRAINT "clientes_valorados_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed: 2 clientes valorados de ejemplo (promo "cada 6ta reserva gratis").
-- Usa el telefono existente si ya habia un Cliente con ese numero (p.ej. de
-- pruebas manuales previas) en vez de asumir que el id semilla es el real.
DO $$
DECLARE
  cliente1_id TEXT;
  cliente2_id TEXT;
BEGIN
  INSERT INTO "clientes" ("id", "nombre", "telefono", "creadoEn")
  VALUES ('seed-cliente-valorado-1', 'Carlos Mendez', '55551234', CURRENT_TIMESTAMP)
  ON CONFLICT ("telefono") DO NOTHING;
  SELECT "id" INTO cliente1_id FROM "clientes" WHERE "telefono" = '55551234';

  INSERT INTO "clientes" ("id", "nombre", "telefono", "creadoEn")
  VALUES ('seed-cliente-valorado-2', 'Ana Rodriguez', '55555678', CURRENT_TIMESTAMP)
  ON CONFLICT ("telefono") DO NOTHING;
  SELECT "id" INTO cliente2_id FROM "clientes" WHERE "telefono" = '55555678';

  INSERT INTO "clientes_valorados" ("id", "clienteId", "creadoEn")
  VALUES
    ('seed-valorado-1', cliente1_id, CURRENT_TIMESTAMP),
    ('seed-valorado-2', cliente2_id, CURRENT_TIMESTAMP)
  ON CONFLICT ("clienteId") DO NOTHING;
END $$;
