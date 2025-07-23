-- CreateTable
CREATE TABLE "AttendenceRegisteration" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "registrationCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendenceRegisteration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_AttendenceRegisterationToStudent" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_AttendenceRegisterationToStudent_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "AttendenceRegisteration_registrationId_key" ON "AttendenceRegisteration"("registrationId");

-- CreateIndex
CREATE UNIQUE INDEX "AttendenceRegisteration_registrationCode_key" ON "AttendenceRegisteration"("registrationCode");

-- CreateIndex
CREATE INDEX "_AttendenceRegisterationToStudent_B_index" ON "_AttendenceRegisterationToStudent"("B");

-- AddForeignKey
ALTER TABLE "_AttendenceRegisterationToStudent" ADD CONSTRAINT "_AttendenceRegisterationToStudent_A_fkey" FOREIGN KEY ("A") REFERENCES "AttendenceRegisteration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AttendenceRegisterationToStudent" ADD CONSTRAINT "_AttendenceRegisterationToStudent_B_fkey" FOREIGN KEY ("B") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
