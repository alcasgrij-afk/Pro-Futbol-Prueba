-- CreateEnum
CREATE TYPE "ProductoCategoria" AS ENUM ('TIENDA', 'ACADEMIA');

-- CreateEnum
CREATE TYPE "EstadoVenta" AS ENUM ('COMPLETADA', 'ANULADA');

-- CreateEnum
CREATE TYPE "GastoCategoria" AS ENUM ('MANTENIMIENTO', 'SUMINISTROS', 'SERVICIOS', 'NOMINA', 'OTROS');

-- AlterEnum
ALTER TYPE "TipoPagoReferencia" ADD VALUE 'VENTA';

-- CreateTable
CREATE TABLE "productos" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "categoria" "ProductoCategoria" NOT NULL,
    "precioQ" DECIMAL(10,2) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "productos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ventas" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT,
    "creadoPorUsuarioId" TEXT,
    "estado" "EstadoVenta" NOT NULL DEFAULT 'COMPLETADA',
    "montoTotalQ" DECIMAL(10,2) NOT NULL,
    "notas" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ventas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "venta_items" (
    "id" TEXT NOT NULL,
    "ventaId" TEXT NOT NULL,
    "productoId" TEXT,
    "nombreSnapshot" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "precioUnitarioQ" DECIMAL(10,2) NOT NULL,
    "subtotalQ" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "venta_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gastos" (
    "id" TEXT NOT NULL,
    "categoria" "GastoCategoria" NOT NULL,
    "montoQ" DECIMAL(10,2) NOT NULL,
    "descripcion" TEXT,
    "fecha" DATE NOT NULL,
    "registradoPorUsuarioId" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gastos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "gastos_fecha_idx" ON "gastos"("fecha");

-- AddForeignKey
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venta_items" ADD CONSTRAINT "venta_items_ventaId_fkey" FOREIGN KEY ("ventaId") REFERENCES "ventas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venta_items" ADD CONSTRAINT "venta_items_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "productos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
