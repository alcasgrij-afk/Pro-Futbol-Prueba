/*
  Warnings:

  - Added the required column `referenciaId` to the `pagos` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "FormatoTorneo" AS ENUM ('LIGA', 'ELIMINACION_DIRECTA');

-- CreateEnum
CREATE TYPE "EstadoTorneo" AS ENUM ('PROXIMO', 'INSCRIPCIONES_ABIERTAS', 'EN_CURSO', 'FINALIZADO', 'CANCELADO');

-- AlterEnum
ALTER TYPE "TipoPagoReferencia" ADD VALUE 'EQUIPO';

-- DropForeignKey
ALTER TABLE "pagos" DROP CONSTRAINT "pagos_reservaId_fkey";

-- DropIndex
DROP INDEX "pagos_reservaId_idx";

-- AlterTable
ALTER TABLE "pagos" ADD COLUMN     "referenciaId" TEXT,
ADD COLUMN     "tipoReferencia" "TipoPagoReferencia" NOT NULL DEFAULT 'RESERVA',
ALTER COLUMN "reservaId" DROP NOT NULL;

-- Backfill: todos los pagos existentes son de reservas; su referencia polimorfica
-- es la propia reserva.
UPDATE "pagos" SET "referenciaId" = "reservaId" WHERE "referenciaId" IS NULL;

-- A partir de aca referenciaId es obligatorio.
ALTER TABLE "pagos" ALTER COLUMN "referenciaId" SET NOT NULL;

-- CreateTable
CREATE TABLE "torneos" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "formato" "FormatoTorneo" NOT NULL,
    "categoria" TEXT,
    "maxEquipos" INTEGER NOT NULL DEFAULT 16,
    "cuotaInscripcionQ" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "fechaInicio" DATE,
    "fechaLimiteInscripcion" DATE,
    "estado" "EstadoTorneo" NOT NULL DEFAULT 'INSCRIPCIONES_ABIERTAS',
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "torneos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipos" (
    "id" TEXT NOT NULL,
    "torneoId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "capitanNombre" TEXT,
    "capitanTelefono" TEXT,
    "jugadores" JSONB,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "equipos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partidos" (
    "id" TEXT NOT NULL,
    "torneoId" TEXT NOT NULL,
    "jornada" INTEGER NOT NULL,
    "ronda" INTEGER,
    "localId" TEXT,
    "visitanteId" TEXT,
    "golesLocal" INTEGER,
    "golesVisitante" INTEGER,
    "fechaJuego" DATE,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partidos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "equipos_torneoId_nombre_key" ON "equipos"("torneoId", "nombre");

-- CreateIndex
CREATE INDEX "pagos_tipoReferencia_referenciaId_idx" ON "pagos"("tipoReferencia", "referenciaId");

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_reservaId_fkey" FOREIGN KEY ("reservaId") REFERENCES "reservas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipos" ADD CONSTRAINT "equipos_torneoId_fkey" FOREIGN KEY ("torneoId") REFERENCES "torneos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partidos" ADD CONSTRAINT "partidos_torneoId_fkey" FOREIGN KEY ("torneoId") REFERENCES "torneos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partidos" ADD CONSTRAINT "partidos_localId_fkey" FOREIGN KEY ("localId") REFERENCES "equipos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partidos" ADD CONSTRAINT "partidos_visitanteId_fkey" FOREIGN KEY ("visitanteId") REFERENCES "equipos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
