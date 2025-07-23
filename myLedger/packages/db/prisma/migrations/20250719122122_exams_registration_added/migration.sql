/*
  Warnings:

  - You are about to drop the column `semester` on the `Student` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Qualification" ALTER COLUMN "division" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "Student" DROP COLUMN "semester",
ADD COLUMN     "currentSemesterId" TEXT;

-- CreateTable
CREATE TABLE "ExamsRegistration" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "registrationDesc" TEXT NOT NULL,
    "registrationCode" TEXT NOT NULL,
    "registrationDateFrom" TIMESTAMP(3) NOT NULL,
    "registrationDateTo" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExamsRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExamsRegistration_registrationId_key" ON "ExamsRegistration"("registrationId");

-- CreateIndex
CREATE UNIQUE INDEX "ExamsRegistration_registrationCode_key" ON "ExamsRegistration"("registrationCode");

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_currentSemesterId_fkey" FOREIGN KEY ("currentSemesterId") REFERENCES "ExamsRegistration"("id") ON DELETE SET NULL ON UPDATE CASCADE;
