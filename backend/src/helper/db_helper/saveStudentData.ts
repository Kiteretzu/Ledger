import { Student, User } from "@prisma/client"; // Import Student and User types

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface QualificationInput {
  qualificationcode: string;
  yearofpassing: number;
  fullmarks: number;
  obtainedmarks: number;
  percentagemarks: number;
  division: string; // Keep as string if it can be "First", "Second" etc.
  grade?: string;
  cgpa?: number;
  boardname: string;
}

interface GeneralInformationInput {
  apaarid?: string;
  registrationno: string;
  academicyear: string;
  admissionyear: string;
  batch?: string;
  programcode: string;
  branch: string;
  sectioncode?: string;
  semester: number;
  studentname: string;
  dateofbirth: string; // Still string, parsed inside
  gender: string;
  bloodgroup?: string;
  nationality: string;
  category: string;
  studentcellno?: string;
  studenttelephoneno?: string;
  studentemailid?: string;
  studentpersonalemailid?: string;
  fathersname: string;
  mothername: string;
  parentcellno?: string;
  parenttelephoneno?: string;
  parentemailid?: string;
  designation?: string;
  bankaccountno?: string;
  bankname?: string;
  studentPhotoEvent?: string;
  photo?: string; // Base64 photo data
  signature?: string; // Base64 signature data
  caddress1?: string;
  caddress2?: string;
  caddress3?: string;
  ccityname?: string;
  cdistrict?: string;
  cstatename?: string;
  cpostalcode?: number;
  paddress1?: string;
  paddress2?: string;
  paddress3?: string;
  pcityname?: string;
  pdistrict?: string;
  pstatename?: string;
  ppostalcode?: number;
}

interface ResponseData {
  generalinformation: GeneralInformationInput;
  qualification: QualificationInput[];
  // You might have other sections like 'documents', 'payments', etc.
}

/**
 * Saves student details and links them to an existing user.
 * If a student with the same registration number and identical general information already exists,
 * the existing student record is returned without creating a new one.
 * If a database error occurs, the error is logged, and null is returned, preventing a crash.
 *
 * @param username The username of the existing User to link this student to.
 * @param responseData The structured student data from the frontend.
 * @returns The newly created or existing Student record, or null if an error occurred.
 */
export default async function saveStudentData(
  username: string, // Correctly using username
  responseData: ResponseData
): Promise<Student | null> {
  // Changed return type to allow null
  try {
    // Check if the user exists and is not already linked
    const existingUser = await prisma.user.findUnique({
      where: { username: username },
      include: { student: true }, // Eagerly load student to check linkage
    });

    if (!existingUser) {
      console.error(`Error: User with username '${username}' not found.`);
      return null; // Return null instead of throwing
    }

    // Destructure general information
    const {
      apaarid,
      registrationno,
      academicyear,
      admissionyear,
      batch,
      programcode,
      branch,
      sectioncode,
      semester,
      studentname,
      dateofbirth,
      gender,
      bloodgroup,
      nationality,
      category,
      studentcellno,
      studenttelephoneno,
      studentemailid,
      studentpersonalemailid,
      fathersname,
      mothername,
      parentcellno,
      parenttelephoneno,
      parentemailid,
      designation,
      bankaccountno,
      bankname,
      studentPhotoEvent,
      caddress1,
      caddress2,
      caddress3,
      ccityname,
      cdistrict,
      cstatename,
      cpostalcode,
      paddress1,
      paddress2,
      paddress3,
      pcityname,
      pdistrict,
      pstatename,
      ppostalcode,
    } = responseData.generalinformation;

    const { photo, signature } = responseData["photo&signature"];
    
    // --- Date Parsing Fix ---
    const [day, month, year] = dateofbirth.split("-").map(Number);
    const parsedDateOfBirth = new Date(year, month - 1, day);
    // --- End Date Parsing Fix ---

    const photoPrefix = "data:image/jpg;base64,";
    const photoUrl = `${photoPrefix}${photo}`;
    const signatureUrl = `${photoPrefix}${signature}`;

    // --- Start: Fetch and Compare Check ---
    const existingStudent = await prisma.student.findUnique({
      where: { registrationNo: registrationno },
      include: { qualifications: true },
    });

    console.log("this is existingStudent", existingStudent?.semester, semester);

    if (existingStudent) {
      // Perform a deep comparison of relevant fields from generalinformation
      const isGeneralInfoIdentical =
        existingStudent.apaarid === (apaarid || null) &&
        existingStudent.academicYear === academicyear &&
        existingStudent.admissionYear === admissionyear &&
        existingStudent.batch === (batch || null) &&
        existingStudent.programCode === programcode &&
        existingStudent.branch === branch &&
        existingStudent.sectionCode === (sectioncode || null) &&
        existingStudent.semester === semester &&
        existingStudent.studentName === studentname &&
        existingStudent.dateOfBirth.toISOString() ===
          parsedDateOfBirth.toISOString() &&
        existingStudent.gender === gender &&
        existingStudent.bloodGroup === (bloodgroup || null) &&
        existingStudent.nationality === nationality &&
        existingStudent.category === category &&
        existingStudent.studentCellNo === (studentcellno || null) &&
        existingStudent.studentTelephoneNo === (studenttelephoneno || null) &&
        existingStudent.studentEmailId === (studentemailid || null) &&
        existingStudent.studentPersonalEmailId ===
          (studentpersonalemailid || null) &&
        existingStudent.fathersName === fathersname &&
        existingStudent.motherName === mothername &&
        existingStudent.parentCellNo === (parentcellno || null) &&
        existingStudent.parentTelephoneNo === (parenttelephoneno || null) &&
        existingStudent.parentEmailId === (parentemailid || null) &&
        existingStudent.designation === (designation || null) &&
        existingStudent.bankAccountNo === (bankaccountno || null) &&
        existingStudent.bankName === (bankname || null) &&
        existingStudent.studentPhotoEvent === (studentPhotoEvent || null) &&
        existingStudent.cAddress1 === (caddress1 || null) &&
        existingStudent.cAddress2 === (caddress2 || null) &&
        existingStudent.cAddress3 === (caddress3 || null) &&
        existingStudent.cCityName === (ccityname || null) &&
        existingStudent.cDistrict === (cdistrict || null) &&
        existingStudent.cStateName === (cstatename || null) &&
        existingStudent.cPostalCode === (cpostalcode || null) &&
        existingStudent.pAddress1 === (paddress1 || null) &&
        existingStudent.pAddress2 === (paddress2 || null) &&
        existingStudent.pAddress3 === (paddress3 || null) &&
        existingStudent.pCityName === (pcityname || null) &&
        existingStudent.pDistrict === (pdistrict || null) &&
        existingStudent.pStateName === (pstatename || null) &&
        existingStudent.pPostalCode === (ppostalcode || null);

      const areQualificationsCountIdentical =
        existingStudent.qualifications.length ===
        responseData.qualification.length;

      if (isGeneralInfoIdentical && areQualificationsCountIdentical) {
        if (existingStudent.userId === existingUser.id) {
          console.log(
            `Student with registration number '${registrationno}' already exists and is identical. Skipping creation.`
          );
          return existingStudent;
        } else if (existingStudent.userId !== null) {
          console.error(
            `Error: Student with registration number '${registrationno}' already exists and is linked to another user.`
          );
          return null; // Return null instead of throwing
        } else {
          console.log(
            `Student with registration number '${registrationno}' already exists and is identical but not linked. Linking to user.`
          );
          const updatedStudent = await prisma.student.update({
            where: { registrationNo: registrationno },
            data: {
              user: {
                connect: {
                  username: username,
                },
              },
            },
            include: { user: true, qualifications: true },
          });
          return updatedStudent;
        }
      }
    }
    // --- End: Fetch and Compare Check ---

    if (existingStudent) {
      // ✅ Always update the student if they exist, regardless of comparison

      const updatedStudent = await prisma.student.update({
        where: { registrationNo: registrationno },
        data: {
          academicYear: academicyear,
          admissionYear: admissionyear,
          programCode: programcode,
          branch: branch,
          semester: semester,
          studentName: studentname,
          dateOfBirth: parsedDateOfBirth,
          gender: gender,
          nationality: nationality,
          category: category,
          fathersName: fathersname,
          motherName: mothername,

          // Optional updates
          apaarid: apaarid || null,
          batch: batch || null,
          sectionCode: sectioncode || null,
          bloodGroup: bloodgroup || null,
          studentCellNo: studentcellno || null,
          studentTelephoneNo: studenttelephoneno || null,
          studentEmailId: studentemailid || null,
          studentPersonalEmailId: studentpersonalemailid || null,
          parentCellNo: parentcellno || null,
          parentTelephoneNo: parenttelephoneno || null,
          parentEmailId: parentemailid || null,
          designation: designation || null,
          bankName: bankname || null,
          bankAccountNo: bankaccountno || null,
          studentPhotoEvent: studentPhotoEvent || null,
          photo: photoUrl,
          signature: signatureUrl,
          cAddress1: caddress1 || null,
          cAddress2: caddress2 || null,
          cAddress3: caddress3 || null,
          cCityName: ccityname || null,
          cDistrict: cdistrict || null,
          cStateName: cstatename || null,
          cPostalCode: cpostalcode || null,
          pAddress1: paddress1 || null,
          pAddress2: paddress2 || null,
          pAddress3: paddress3 || null,
          pCityName: pcityname || null,
          pDistrict: pdistrict || null,
          pStateName: pstatename || null,
          pPostalCode: ppostalcode || null,

          user: {
            connect: {
              username: username,
            },
          },
        },
        include: {
          user: true,
          qualifications: true,
        },
      });

      console.log("Updated existing student:", updatedStudent);
    }

    // If no identical student found (or if found but not identical enough), proceed with creation
    const student = await prisma.student.create({
      data: {
        // Essential fields for Student
        registrationNo: registrationno,
        academicYear: academicyear,
        admissionYear: admissionyear,
        programCode: programcode,
        branch: branch,
        semester: semester,
        studentName: studentname,
        dateOfBirth: parsedDateOfBirth,
        gender: gender,
        nationality: nationality,
        category: category,
        fathersName: fathersname,
        motherName: mothername,

        // Optional fields (use nullish coalescing to ensure `null` for missing optional values)
        apaarid: apaarid || null,
        batch: batch || null,
        sectionCode: sectioncode || null,
        bloodGroup: bloodgroup || null,
        studentCellNo: studentcellno || null,
        studentTelephoneNo: studenttelephoneno || null,
        studentEmailId: studentemailid || null,
        studentPersonalEmailId: studentpersonalemailid || null,
        parentCellNo: parentcellno || null,
        parentTelephoneNo: parenttelephoneno || null,
        parentEmailId: parentemailid || null,
        designation: designation || null,
        bankName: bankname || null,
        bankAccountNo: bankaccountno || null,
        studentPhotoEvent: studentPhotoEvent || null,
        photo: photoUrl,
        signature: signatureUrl,

        // Current Address
        cAddress1: caddress1 || null,
        cAddress2: caddress2 || null,
        cAddress3: caddress3 || null,
        cCityName: ccityname || null,
        cDistrict: cdistrict || null,
        cStateName: cstatename || null,
        cPostalCode: cpostalcode || null,

        // Permanent Address
        pAddress1: paddress1 || null,
        pAddress2: paddress2 || null,
        pAddress3: paddress3 || null,
        pCityName: pcityname || null,
        pDistrict: pdistrict || null,
        pStateName: pstatename || null,
        pPostalCode: ppostalcode || null,

        // CONNECT THE STUDENT TO THE USER
        user: {
          connect: {
            username: username, // Use the provided username to connect
          },
        },

        // Create nested qualifications
        qualifications: {
          create: responseData.qualification.map((q) => ({
            qualificationCode: q.qualificationcode,
            yearOfPassing: q.yearofpassing,
            fullMarks: q.fullmarks,
            obtainedMarks: q.obtainedmarks,
            percentageMarks: q.percentagemarks,
            division: q.division,
            grade: q.grade || null,
            cgpa: q.cgpa || null,
            boardName: q.boardname,
          })),
        },
      },
      include: {
        user: true,
        qualifications: true,
      },
    });

    console.log("Student and qualifications saved successfully:", student);
    return student;
  } catch (error: any) {
    // Log the specific error details instead of re-throwing
    if (error.code === "P2002") {
      if (error.meta?.target?.includes("registrationNo")) {
        console.error(
          `Error: Student with registration number '${responseData.generalinformation.registrationno}' already exists during creation attempt.`
        );
      } else if (error.meta?.target?.includes("apaarid")) {
        console.error(
          `Error: Student with APAAR ID '${responseData.generalinformation.apaarid}' already exists during creation attempt.`
        );
      } else if (error.meta?.target?.includes("userId")) {
        console.error(
          `Error: User with username '${username}' is already linked to another student or an attempt was made to link a student to an already linked user (P2002 userId error).`
        );
      } else {
        console.error(
          `Prisma unique constraint violation (P2002):`,
          error.message,
          error.meta
        );
      }
    } else if (error.name === "PrismaClientInitializationError") {
      console.error(
        `Prisma Client Initialization Error: Could not connect to the database.`,
        error.message
      );
    } else {
      console.error(
        `An unexpected error occurred while saving student data:`,
        error.message,
        error
      );
    }
    return null; // Return null on any error to prevent Node.js from crashing
  }
}
