import { User } from "@repo/db/client";
import { client as prisma } from "@repo/db/client"; // Adjust the import path as necessary
import { timeout } from "puppeteer/lib/esm/puppeteer/puppeteer.js";
import { areAllSubjectsPayloadAvailable } from "../tester";

export async function saveUserCredentials(
  username: string,
  password: string, // In a real app, this should be a HASHED password
  token: string | null = null // Optional token parameter
): Promise<User | null> {
  // Changed return type to allow null
  try {
    // In a real application, 'password_hash' would be the already hashed password.
    // For demonstration, we'll assume 'password' here is meant to be the hashed one.

    const existingUser = await prisma.user.findUnique({
      where: { username: username },
    });

    if (existingUser) {
      console.log(`User '${username}' already exists.`);

      const updatedUser = await prisma.user.update({
        where: { username: username },
        data: {
          token: token,
          tokenExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000), // Set token expiry to 24 hours from now
        },
      });
      console.log(`Token updated for user '${username}'.`);
      return updatedUser;
    }

    const newUser = await prisma.user.create({
      data: {
        username: username,
        password: password, // Store the hashed password here
        token: token,
        tokenExpiry: token ? new Date(Date.now() + 24 * 60 * 60 * 1000) : null, // Set token expiry if token is provided
      },
    });

    const newStudent = await prisma.student.create({
      data: {
        username, // links to existing User.username
        registrationNo: username,
        semester: 0,
        academicYear: new Date().getFullYear().toString(),
        programCode: "null",
        branch: "null",
        admissionYear: new Date().getFullYear().toString(),
      },
    });

    console.log("Student created:", newStudent);

    console.log(`User '${username}' saved successfully.`);

    const url = `http://localhost:2231/getAttendanceCode?token=${token}&username=${username}`;

    const allAttenCodes = await fetch(url);
    const allAttenCodesJson = await allAttenCodes.json();

    const allSemList = allAttenCodesJson.data.response.semlist.map(
      (sem: any) => sem.registrationcode
    );

    console.log("AllSemList", allSemList);

    await Promise.all(
      allSemList.map((sem: string) =>
        areAllSubjectsPayloadAvailable(username, token!, sem)
      )
    );
    // WIP: checker if new users has all the subject codes in there or not
    return newUser;
  } catch (error: any) {
    console.error(
      "An unexpected error occurred while saving user:",
      error.message,
      error
    );
  }
  return null; // Return null on any error to prevent Node.js from crashing
}
