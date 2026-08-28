-- CreateEnum
CREATE TYPE "TipoCancha" AS ENUM ('FUTBOL_5', 'FUTBOL_7');

-- CreateEnum
CREATE TYPE "EstadoReserva" AS ENUM ('PENDIENTE_PAGO', 'PENDIENTE_SEDE', 'CONFIRMADA', 'LIBERADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "FormaPago" AS ENUM ('ANTICIPADO_EN_LINEA', 'EN_SEDE');

-- CreateEnum
CREATE TYPE "RolUsuario" AS ENUM ('ADMIN', 'RECEPCION', 'ENTRENADOR');

-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "rol" "RolUsuario" NOT NULL DEFAULT 'RECEPCION',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clientes" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "email" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "canchas" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoCancha" NOT NULL,
    "precioAnticipadoQ" DECIMAL(10,2) NOT NULL,
    "precioSedeQ" DECIMAL(10,2) NOT NULL,
    "horaAperturaMin" INTEGER NOT NULL,
    "horaCierreMin" INTEGER NOT NULL,
    "duracionBloqueMin" INTEGER NOT NULL DEFAULT 60,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "canchas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservas" (
    "id" TEXT NOT NULL,
    "canchaId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "horaInicioMin" INTEGER NOT NULL,
    "horaFinMin" INTEGER NOT NULL,
    "estado" "EstadoReserva" NOT NULL DEFAULT 'PENDIENTE_PAGO',
    "formaPago" "FormaPago" NOT NULL,
    "precioTotalQ" DECIMAL(10,2) NOT NULL,
    "linkPago" TEXT,
    "referenciaPago" TEXT,
    "expiraEn" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reservas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "clientes_telefono_key" ON "clientes"("telefono");

-- CreateIndex
CREATE INDEX "reservas_fecha_canchaId_idx" ON "reservas"("fecha", "canchaId");

-- CreateIndex
CREATE INDEX "reservas_estado_idx" ON "reservas"("estado");

-- AddForeignKey
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_canchaId_fkey" FOREIGN KEY ("canchaId") REFERENCES "canchas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
