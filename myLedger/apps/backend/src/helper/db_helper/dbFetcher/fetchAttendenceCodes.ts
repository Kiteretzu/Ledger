import { client as prisma } from "@repo/db/client"; // Adjust the import path as necessary

export async function fetchAttendenceCode(username: string) {
  try {
    // Find the student by username and include their linked attendenceRegisterations
    const student = await prisma.student.findUnique({
      where: { username },
      include: {
        attendenceRegisterations: {
          select: {
            registrationId: true,
            registrationCode: true,
          },
        },
      },
    });

    if (!student) {
      console.log(`No student found with username: ${username}`);
      return null;
    }

    console.log(
      `Found ${student.attendenceRegisterations.length} attendance records for student ${username}.`
    );
    return student.attendenceRegisterations;
  } catch (error) {
    console.error(
      `Error fetching attendance codes for student ${username}:`,
      error
    );
    throw error;
  }
}
