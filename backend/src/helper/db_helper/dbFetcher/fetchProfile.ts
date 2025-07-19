// src/services/studentService.ts
import prisma from "../../../utils/prisma";

export async function fetchProfile(registrationNo: string) {
  try {
    const student = await prisma.student.findUnique({
      where: {
        registrationNo: registrationNo,
      },
      include: {
        qualifications: {
          orderBy: {
            yearOfPassing: "asc", // Order qualifications by year of passing
          },
        },
      },
    });

    return student;
  } catch (error) {
    console.error(
      `Failed to fetch student details for registration number ${registrationNo}:`,
      error
    );
    throw new Error("Unable to fetch student details.");
  }
}
