/*
  Warnings:

  - A unique constraint covering the columns `[code,semesterId]` on the table `Subject` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Subject_code_semesterId_key" ON "Subject"("code", "semesterId");
