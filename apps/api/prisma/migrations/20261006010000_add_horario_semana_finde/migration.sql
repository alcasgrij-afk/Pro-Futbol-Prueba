-- AlterTable
ALTER TABLE "canchas" DROP COLUMN "horaAperturaMin",
DROP COLUMN "horaCierreMin",
ADD COLUMN     "horaAperturaMinFinde" INTEGER NOT NULL DEFAULT 480,
ADD COLUMN     "horaAperturaMinSemana" INTEGER NOT NULL DEFAULT 840,
ADD COLUMN     "horaCierreMinFinde" INTEGER NOT NULL DEFAULT 1320,
ADD COLUMN     "horaCierreMinSemana" INTEGER NOT NULL DEFAULT 1320;
