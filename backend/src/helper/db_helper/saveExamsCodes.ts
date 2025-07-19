import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface IncomingResponse {
  response: {
    semestercode: Array<{
      registrationdatefrom: number;
      registrationdesc: string;
      registrationid: string;
      registrationdateto: number;
      registrationcode: string;
    }>;
    examevent: any[];
  };
}

export async function saveExamsCodes(username: string, data: IncomingResponse) {
  const semesterData = data.response.semestercode;

  if (!semesterData || semesterData.length === 0) {
    console.log("No semester code data found in the response to seed.");
    return;
  }

  console.log(`Attempting to seed ${semesterData.length} semester records...`);

  for (const semester of semesterData) {
    try {
      // Check if semester already exists (by registrationId)
      let semesterRecord = await prisma.examsRegistration.findUnique({
        where: {
          registrationId: semester.registrationid,
        },
      });

      if (!semesterRecord) {
        // If it doesn't exist, create it
        semesterRecord = await prisma.examsRegistration.create({
          data: {
            registrationId: semester.registrationid,
            registrationDesc: semester.registrationdesc,
            registrationCode: semester.registrationcode,
            registrationDateFrom: new Date(semester.registrationdatefrom),
            registrationDateTo: new Date(semester.registrationdateto),
          },
        });
        console.log(`Inserted semester: ${semester.registrationcode}`);
      } else {
        console.log(`Semester exists: ${semester.registrationcode}`);
      }

      // Find the student by username
      const student = await prisma.student.findUnique({
        where: { username },
        // Include the existing examsRegistrations for the student
        include: { examsRegistrations: true },
      });

      if (!student) {
        console.warn(
          `Student with username ${username} not found, skipping linking to semester.`
        );
        continue;
      }

      // Check if the student is already linked to this semesterRecord
      const isAlreadyLinked = student.examsRegistrations.some(
        (reg) => reg.id === semesterRecord.id
      );

      if (isAlreadyLinked) {
        console.log(
          `Student ${username} is already linked to ${semester.registrationcode}, skipping.`
        );
        continue;
      }

      // Link the student to the ExamsRegistration using the many-to-many relationship
      await prisma.student.update({
        where: { id: student.id }, // Use student.id for update
        data: {
          examsRegistrations: {
            connect: {
              id: semesterRecord.id, // Connect the existing semester record by its ID
            },
          },
        },
      });

      console.log(`Linked student ${username} to ${semester.registrationcode}`);
    } catch (e) {
      console.error(`Error processing ${semester.registrationcode}:`, e);
    }
  }

  console.log("Finished seeding semester data.");
}
