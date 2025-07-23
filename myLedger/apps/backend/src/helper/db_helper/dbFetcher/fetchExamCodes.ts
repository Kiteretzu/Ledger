import { client as prisma } from "@repo/db/client"; // Adjust the import path as necessary

export async function fetchDbExamCodes(username: string) {
  try {
    // Find the student by username and include their linked examsRegistrations
    const student = await prisma.student.findUnique({
      where: { username },
      include: {
        examsRegistrations: {
          select: {
            registrationId: true,
            registrationDesc: true,
            registrationCode: true,
            registrationDateFrom: true,
            registrationDateTo: true,
          },
        }, // This includes all associated ExamsRegistration records
      },
    });

    if (!student) {
      console.log(`No student found with username: ${username}`);
      return null; // Or throw an error, depending on your error handling strategy
    }

    // Return the array of examsRegistrations
    console.log(
      `Found ${student.examsRegistrations.length} exam registrations for student ${username}.`
    );
    return student.examsRegistrations;
  } catch (error) {
    console.error(`Error fetching exam codes for student ${username}:`, error);
    throw error; // Re-throw the error for the caller to handle
  }
}
