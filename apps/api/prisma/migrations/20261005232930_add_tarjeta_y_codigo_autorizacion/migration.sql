-- AlterEnum
ALTER TYPE "GatewayPago" ADD VALUE 'TARJETA';

-- AlterTable
ALTER TABLE "pagos" ADD COLUMN     "codigoAutorizacion" TEXT;
