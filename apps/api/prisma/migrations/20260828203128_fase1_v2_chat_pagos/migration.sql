-- CreateEnum
CREATE TYPE "GatewayPago" AS ENUM ('BAC', 'NEONET', 'EFECTIVO');

-- CreateEnum
CREATE TYPE "EstadoPago" AS ENUM ('PENDIENTE', 'COMPLETADO', 'FALLIDO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "TipoPagoReferencia" AS ENUM ('RESERVA');

-- CreateTable
CREATE TABLE "pagos" (
    "id" TEXT NOT NULL,
    "reservaId" TEXT NOT NULL,
    "gateway" "GatewayPago" NOT NULL,
    "montoQ" DECIMAL(10,2) NOT NULL,
    "estado" "EstadoPago" NOT NULL DEFAULT 'PENDIENTE',
    "referenciaExterna" TEXT,
    "redirectUrl" TEXT,
    "confirmadoEn" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pagos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pagos_reservaId_idx" ON "pagos"("reservaId");

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_reservaId_fkey" FOREIGN KEY ("reservaId") REFERENCES "reservas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
