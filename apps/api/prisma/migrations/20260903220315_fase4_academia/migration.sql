-- AlterEnum
ALTER TYPE "TipoPagoReferencia" ADD VALUE 'MENSUALIDAD';

-- CreateTable
CREATE TABLE "alumnos" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "fechaNacimiento" DATE NOT NULL,
    "categoria" TEXT NOT NULL,
    "encargadoNombre" TEXT NOT NULL,
    "encargadoTelefono" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alumnos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "academia_mensualidades" (
    "id" TEXT NOT NULL,
    "alumnoId" TEXT NOT NULL,
    "mes" INTEGER NOT NULL,
    "anio" INTEGER NOT NULL,
    "montoQ" DECIMAL(10,2) NOT NULL,
    "avisoVencidoEnviado" BOOLEAN NOT NULL DEFAULT false,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "academia_mensualidades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asistencias" (
    "id" TEXT NOT NULL,
    "alumnoId" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "presente" BOOLEAN NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asistencias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "alumnos_categoria_idx" ON "alumnos"("categoria");

-- CreateIndex
CREATE UNIQUE INDEX "academia_mensualidades_alumnoId_mes_anio_key" ON "academia_mensualidades"("alumnoId", "mes", "anio");

-- CreateIndex
CREATE UNIQUE INDEX "asistencias_alumnoId_fecha_key" ON "asistencias"("alumnoId", "fecha");

-- AddForeignKey
ALTER TABLE "academia_mensualidades" ADD CONSTRAINT "academia_mensualidades_alumnoId_fkey" FOREIGN KEY ("alumnoId") REFERENCES "alumnos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asistencias" ADD CONSTRAINT "asistencias_alumnoId_fkey" FOREIGN KEY ("alumnoId") REFERENCES "alumnos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
