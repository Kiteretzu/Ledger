import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface AttendanceResponseHeader {
  branchdesc: string;
  name: string;
  programdesc: string;
  stynumber: string;
}

interface AttendanceResponseSem {
  registrationcode: string;
  registrationid: string;
}

interface IncomingAttendanceResponse {
  status: {
    responseStatus: string;
    errors: any;
    identifier: any;
  };
  response: {
    headerlist: AttendanceResponseHeader[];
    semlist: AttendanceResponseSem[];
  };
}

/**
 * Saves or updates attendance registration information and links students to them.
 *
 * @param username The username of the student.
 * @param data The incoming JSON response containing attendance registration details.
 */
export async function saveAttendanceCode(
  username: string,
  data: IncomingAttendanceResponse
) {
  if (!username || typeof username !== "string") {
    console.error("❌ Provided username is invalid or missing.");
    return;
  }

  const semList = data.response.semlist;

  if (!semList || semList.length === 0) {
    console.log(
      "No semester list data found in the response for attendance registration."
    );
    return;
  }

  console.log(
    `📦 Attempting to seed ${semList.length} attendance registration record(s)...`
  );

  for (const sem of semList) {
    try {
      // 1. Find or create the AttendenceRegisteration
      let attendanceRecord = await prisma.attendenceRegisteration.findUnique({
        where: {
          registrationId: sem.registrationid,
        },
      });

      if (!attendanceRecord) {
        attendanceRecord = await prisma.attendenceRegisteration.create({
          data: {
            registrationId: sem.registrationid,
            registrationCode: sem.registrationcode,
          },
        });
        console.log(
          `✅ Inserted new attendance registration: ${sem.registrationcode}`
        );
      } else {
        console.log(
          `ℹ️ Attendance registration exists: ${sem.registrationcode}`
        );
      }

      // 2. Find student by username
      const student = await prisma.student.findUnique({
        where: { username },
        include: { attendenceRegisterations: true },
      });

      if (!student) {
        console.warn(
          `⚠️ Student with username "${username}" not found. Skipping.`
        );
        continue;
      }

      // 3. Check if already linked
      const isAlreadyLinked = student.attendenceRegisterations.some(
        (link) => link.id === attendanceRecord.id
      );

      if (isAlreadyLinked) {
        console.log(
          `🟡 Student ${username} already linked to ${sem.registrationcode}, skipping.`
        );
        continue;
      }

      // 4. Link student to the attendance record
      await prisma.attendenceRegisteration.update({
        where: { id: attendanceRecord.id },
        data: {
          students: {
            connect: { id: student.id },
          },
        },
      });

      console.log(`🔗 Linked student ${username} to ${sem.registrationcode}`);
    } catch (e: any) {
      console.error(
        `❌ Error processing registration "${sem.registrationcode}":`,
        e?.message || e
      );
    }
  }

  console.log("🎉 Finished seeding attendance registration data.");

  // Optional: gracefully disconnect Prisma when this is called standalone
  // await prisma.$disconnect(); // Uncomment if not managed elsewhere
}
