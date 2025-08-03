import { client as prisma } from "@repo/db/client"; // Adjust the import path as necessary
import {
  setHashWithMidnightExpiry,
  setKeyWithMidnightExpiry,
} from "@repo/redis/redis-expiration";
import { Request, Response } from "express";
import * as puppeteer from "puppeteer";

import { getBrowser } from "@repo/puppeteer_utils/browser";
import redis, { subjectQueue } from "@repo/redis/main";

export const getAllPossibleSubjectCodes = async (
  req: Request,
  res: Response
) => {
  const allUsersRaw = await prisma.user.findMany({
    select: {
      username: true,
      password: true,
      token: true,
      tokenExpiry: true,
      student: {
        select: {
          Semester: {
            select: {
              label: true,
              subjects: {
                select: {
                  code: true,
                },
              },
            },
          },
        },
      },
    },
  });

  type UserSemester = {
    username: string;
    password: string;
    token: string | null;
    semesterLabel: string;
    subjects: Set<string>;
  };

  // Step 1: Create user-semester combinations with their subjects
  const allSubjects = new Set<string>();
  const userSemesters: UserSemester[] = [];

  for (const user of allUsersRaw) {
    const validToken =
      user.tokenExpiry && user.tokenExpiry <= new Date() ? null : user.token;

    if (user.student) {
      for (const sem of user.student.Semester) {
        const semesterSubjects = new Set<string>();

        for (const subj of sem.subjects) {
          semesterSubjects.add(subj.code);
          allSubjects.add(subj.code);
        }

        // Only add semester if it has subjects
        if (semesterSubjects.size > 0) {
          userSemesters.push({
            username: user.username,
            password: user.password,
            token: validToken,
            semesterLabel: sem.label,
            subjects: semesterSubjects,
          });
        }
      }
    }
  }

  // Step 2: Greedy Selection on user-semester level
  const coveredSubjects = new Set<string>();
  const selectedUserSemesters: {
    username: string;
    password: string;
    token: string | null;
    semesterLabel: string;
  }[] = [];

  while (coveredSubjects.size < allSubjects.size && userSemesters.length > 0) {
    let bestUserSemester: UserSemester | null = null;
    let maxNewSubjects = 0;

    // Find the user-semester combination that covers the most uncovered subjects
    for (const userSem of userSemesters) {
      const newSubjects = [...userSem.subjects].filter(
        (subj) => !coveredSubjects.has(subj)
      );

      if (newSubjects.length > maxNewSubjects) {
        maxNewSubjects = newSubjects.length;
        bestUserSemester = userSem;
      }
    }

    if (!bestUserSemester || maxNewSubjects === 0) break;

    // Add the best user-semester to selected list
    selectedUserSemesters.push({
      username: bestUserSemester.username,
      password: bestUserSemester.password,
      token: bestUserSemester.token,
      semesterLabel: bestUserSemester.semesterLabel,
    });

    // Mark all subjects from this semester as covered
    for (const subj of bestUserSemester.subjects) {
      coveredSubjects.add(subj);
    }

    // Remove the selected user-semester from consideration
    const index = userSemesters.indexOf(bestUserSemester);
    userSemesters.splice(index, 1);
  }

  // // Step 3: Send to BullMQ - only the absolutely necessary user-semester combinations
  for (const userSem of selectedUserSemesters) {
    console.log("Sending user-semester to processSingleUser queue:", {
      user: {
        username: userSem.username,
        password: userSem.password,
        token: userSem.token,
        semesterLabel: userSem.semesterLabel,
      },
    });

    await subjectQueue.add("processSingleUser", {
      user: {
        username: userSem.username,
        password: userSem.password,
        token: userSem.token,
        semesterLabel: userSem.semesterLabel,
      },
    });
  }

  console.log(
    `Queued ${selectedUserSemesters.length} user-semester combinations to BullMQ`
  );

  // Group by user for summary
  const userSummary = selectedUserSemesters.reduce(
    (acc, userSem) => {
      if (!acc[userSem.username]) {
        acc[userSem.username] = [];
      }
      acc[userSem.username].push(userSem.semesterLabel);
      return acc;
    },
    {} as Record<string, string[]>
  );

  res.json({
    message: "Minimal user-semester combinations sent to queue",
    selectedUserSemesters,
    userSummary,
    totalSubjectsCovered: coveredSubjects.size,
    totalSubjectsAvailable: allSubjects.size,
  });
};

export const getAllpossibleAttendCodes = async (
  req: Request,
  res: Response
) => {
  const allUsersRaw = await prisma.user.findMany({
    select: {
      username: true,
      password: true,
      token: true,
      tokenExpiry: true,
      student: {
        select: {
          Semester: {
            select: {
              label: true,
            },
          },
        },
      },
    },
  });

  type User = {
    username: string;
    password: string;
    token: string | null;
    semesters: Set<string>;
  };

  // Step 1: Collect all semester codes and map users to semesters
  const allSemesters = new Set<string>();
  const users: User[] = [];

  for (const user of allUsersRaw) {
    const userSemesters = new Set<string>();

    if (user.student) {
      for (const sem of user.student.Semester) {
        userSemesters.add(sem.label);
        allSemesters.add(sem.label);
      }
    }

    users.push({
      username: user.username,
      password: user.password,
      token:
        user.tokenExpiry && user.tokenExpiry <= new Date() ? null : user.token,
      semesters: userSemesters,
    });
  }

  // Step 2: Greedy algorithm to cover all semesters
  const coveredSemesters = new Set<string>();
  const selectedUsers: {
    type: "attendanceCode";
    username: string;
    password: string;
    token: string | null;
    semesters: string[];
  }[] = [];

  while (coveredSemesters.size < allSemesters.size) {
    let bestUser: User | null = null;
    let maxNewSemesters = 0;

    for (const user of users) {
      const newSemesters = [...user.semesters].filter(
        (sem) => !coveredSemesters.has(sem)
      );
      if (newSemesters.length > maxNewSemesters) {
        maxNewSemesters = newSemesters.length;
        bestUser = user;
      }
    }

    if (!bestUser) break;

    selectedUsers.push({
      type: "attendanceCode",
      username: bestUser.username,
      password: bestUser.password,
      token: bestUser.token || null,
      semesters: [...bestUser.semesters],
    });

    for (const sem of bestUser.semesters) {
      coveredSemesters.add(sem);
    }

    users.splice(users.indexOf(bestUser), 1);
  }

  // Step 3: Send to BullMQ
  for (const user of selectedUsers) {
    console.log("sending attendance", user);
    await subjectQueue.add("processAttendanceUser", user);
  }

  console.log("Queued attendance users to BullMQ");

  res.status(200).json({
    message: "Minimum users covering all semester codes fetched successfully",
    selectedUsers,
  });
};
