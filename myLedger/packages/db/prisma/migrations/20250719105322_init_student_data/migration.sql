-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL,
    "apaarid" TEXT,
    "registrationNo" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "admissionYear" TEXT NOT NULL,
    "batch" TEXT,
    "programCode" TEXT NOT NULL,
    "branch" TEXT NOT NULL,
    "sectionCode" TEXT,
    "semester" INTEGER NOT NULL,
    "studentName" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3) NOT NULL,
    "gender" TEXT NOT NULL,
    "bloodGroup" TEXT,
    "nationality" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "studentCellNo" TEXT,
    "studentTelephoneNo" TEXT,
    "studentEmailId" TEXT,
    "studentPersonalEmailId" TEXT,
    "fathersName" TEXT NOT NULL,
    "motherName" TEXT NOT NULL,
    "parentCellNo" TEXT,
    "parentTelephoneNo" TEXT,
    "parentEmailId" TEXT,
    "designation" TEXT,
    "bankName" TEXT,
    "bankAccountNo" TEXT,
    "studentPhotoEvent" TEXT,
    "photo" BYTEA,
    "signature" BYTEA,
    "cAddress1" TEXT,
    "cAddress2" TEXT,
    "cAddress3" TEXT,
    "cCityName" TEXT,
    "cDistrict" TEXT,
    "cStateName" TEXT,
    "cPostalCode" INTEGER,
    "pAddress1" TEXT,
    "pAddress2" TEXT,
    "pAddress3" TEXT,
    "pCityName" TEXT,
    "pDistrict" TEXT,
    "pStateName" TEXT,
    "pPostalCode" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Qualification" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "qualificationCode" TEXT NOT NULL,
    "yearOfPassing" INTEGER NOT NULL,
    "fullMarks" INTEGER NOT NULL,
    "obtainedMarks" INTEGER NOT NULL,
    "percentageMarks" DOUBLE PRECISION NOT NULL,
    "division" INTEGER NOT NULL,
    "grade" TEXT,
    "cgpa" DOUBLE PRECISION,
    "boardName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Qualification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Student_apaarid_key" ON "Student"("apaarid");

-- CreateIndex
CREATE UNIQUE INDEX "Student_registrationNo_key" ON "Student"("registrationNo");

-- AddForeignKey
ALTER TABLE "Qualification" ADD CONSTRAINT "Qualification_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
