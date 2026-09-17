-- AlterTable
ALTER TABLE "partidos" ADD COLUMN     "penalesGanadorId" TEXT,
ADD COLUMN     "posicion" INTEGER NOT NULL DEFAULT 0;

-- AddForeignKey
ALTER TABLE "partidos" ADD CONSTRAINT "partidos_penalesGanadorId_fkey" FOREIGN KEY ("penalesGanadorId") REFERENCES "equipos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
