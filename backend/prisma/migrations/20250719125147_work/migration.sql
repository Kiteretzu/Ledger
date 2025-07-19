/*
  Warnings:

  - You are about to drop the column `currentSemesterId` on the `Student` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Student" DROP CONSTRAINT "Student_currentSemesterId_fkey";

-- AlterTable
ALTER TABLE "Student" DROP COLUMN "currentSemesterId";

-- CreateTable
CREATE TABLE "_ExamsRegistrationToStudent" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ExamsRegistrationToStudent_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_ExamsRegistrationToStudent_B_index" ON "_ExamsRegistrationToStudent"("B");

-- AddForeignKey
ALTER TABLE "_ExamsRegistrationToStudent" ADD CONSTRAINT "_ExamsRegistrationToStudent_A_fkey" FOREIGN KEY ("A") REFERENCES "ExamsRegistration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ExamsRegistrationToStudent" ADD CONSTRAINT "_ExamsRegistrationToStudent_B_fkey" FOREIGN KEY ("B") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
