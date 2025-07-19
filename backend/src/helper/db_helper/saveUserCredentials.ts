import { User } from "@prisma/client";
import { PrismaClient } from "@prisma/client"; // Ensure PrismaClient is imported if not already globally defined

const prisma = new PrismaClient(); // Assuming a single, global PrismaClient instance

export async function saveUserCredentials(
  username: string,
  password: string // In a real app, this should be a HASHED password
): Promise<User | null> {
  // Changed return type to allow null
  try {
    // In a real application, 'password_hash' would be the already hashed password.
    // For demonstration, we'll assume 'password' here is meant to be the hashed one.
    const newUser = await prisma.user.create({
      data: {
        username: username,
        password: password, // Store the hashed password here
      },
    });
    console.log(`User '${username}' saved successfully.`);
    return newUser;
  } catch (error: any) {
    // Use 'any' for error type for broader compatibility
    // Log the specific error details instead of re-throwing
    if (error.code === "P2002" && error.meta?.target?.includes("username")) {
      console.error(`Error: Username '${username}' already exists.`);
    } else if (error.name === "PrismaClientInitializationError") {
      console.error(
        `Prisma Client Initialization Error: Could not connect to the database.`,
        error.message
      );
    } else {
      console.error(
        "An unexpected error occurred while saving user:",
        error.message,
        error
      );
    }
    return null; // Return null on any error to prevent Node.js from crashing
  }
  // Removed prisma.$disconnect()
  // As per Prisma best practices, especially for long-running applications
  // and serverless functions, you typically don't explicitly disconnect.
  // Prisma manages connection pooling automatically. Disconnecting after
  // every operation can lead to performance overhead.
}
