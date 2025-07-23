/*
  Warnings:

  - You are about to drop the column `userId` on the `Student` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[username]` on the table `Student` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "Student" DROP CONSTRAINT "Student_userId_fkey";

-- DropIndex
DROP INDEX "Student_userId_key";

-- AlterTable
ALTER TABLE "Student" DROP COLUMN "userId",
ADD COLUMN     "username" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Student_username_key" ON "Student"("username");

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_username_fkey" FOREIGN KEY ("username") REFERENCES "User"("username") ON DELETE SET NULL ON UPDATE CASCADE;
