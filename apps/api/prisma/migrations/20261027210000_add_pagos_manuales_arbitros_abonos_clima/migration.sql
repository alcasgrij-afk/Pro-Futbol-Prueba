-- CreateEnum
CREATE TYPE "MotivoCancelacion" AS ENUM ('CLIMA', 'OTRO');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TipoPagoReferencia" ADD VALUE 'ARBITRO';
ALTER TYPE "TipoPagoReferencia" ADD VALUE 'MANUAL';

-- AlterTable
ALTER TABLE "reservas" ADD COLUMN     "motivoCancelacion" "MotivoCancelacion";

-- AlterTable
ALTER TABLE "pagos" ADD COLUMN     "conceptoSnapshot" TEXT,
ADD COLUMN     "nota" TEXT;

-- CreateTable
CREATE TABLE "arbitros" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "telefono" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "arbitros_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conceptos_pago" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conceptos_pago_pkey" PRIMARY KEY ("id")
);


-- Catalogo inicial de conceptos de cobro manual. "Otro 1/2" son los
-- placeholders que el admin renombra desde /admin/pagos (pestaña Catalogos)
-- sin necesidad de un deploy; los recibos ya emitidos conservan el nombre con
-- el que se cobraron (Pago.conceptoSnapshot).
INSERT INTO "conceptos_pago" ("id", "nombre", "activo", "creadoEn") VALUES
  (gen_random_uuid(), 'Pago especial', true, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Otro 1 (por definir)', true, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Otro 2 (por definir)', true, CURRENT_TIMESTAMP);
