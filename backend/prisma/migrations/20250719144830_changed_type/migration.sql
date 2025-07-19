/*
  Warnings:

  - Changed the type of `division` on the `Qualification` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "Qualification" DROP COLUMN "division",
ADD COLUMN     "division" INTEGER NOT NULL;
