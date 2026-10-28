-- AlterTable
ALTER TABLE "clientes" ADD COLUMN     "dpi" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "clientes_dpi_key" ON "clientes"("dpi");
