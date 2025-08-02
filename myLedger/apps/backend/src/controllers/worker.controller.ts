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

  type User = {
    username: string;
    password: string;
    token: string | null; // Token can be null if expired
    subjects: Set<string>;
    semesters: string[]; // <-- NEW
  };

  // Step 1: Flatten and collect all users with subjects
  const allSubjects = new Set<string>();
  const users: User[] = [];

  for (const user of allUsersRaw) {
    const userSubjects = new Set<string>();
    const userSemesters: string[] = [];

    if (user.student) {
      for (const sem of user.student.Semester) {
        userSemesters.push(sem.label); // collect semester labels
        for (const subj of sem.subjects) {
          userSubjects.add(subj.code);
          allSubjects.add(subj.code);
        }
      }
    }

    users.push({
      username: user.username,
      password: user.password,
      token:
        user.tokenExpiry && user.tokenExpiry <= new Date() ? null : user.token,
      subjects: userSubjects,
      semesters: userSemesters, // store semesters
    });
  }

  // Step 2: Greedy Selection
  const coveredSubjects = new Set<string>();
  const selectedUsers: {
    username: string;
    password: string;
    token: string | null;
    semesters: string[]; // <-- Include semesters here
  }[] = [];

  while (coveredSubjects.size < allSubjects.size) {
    let bestUser: User | null = null;
    let maxNewSubjects = 0;

    for (const user of users) {
      const newSubjects = [...user.subjects].filter(
        (subj) => !coveredSubjects.has(subj)
      );
      if (newSubjects.length > maxNewSubjects) {
        maxNewSubjects = newSubjects.length;
        bestUser = user;
      }
    }

    if (!bestUser) break;

    selectedUsers.push({
      username: bestUser.username,
      password: bestUser.password,
      token: bestUser.token || null,
      semesters: bestUser.semesters, // include semesters
    });

    for (const subj of bestUser.subjects) {
      coveredSubjects.add(subj);
    }

    users.splice(users.indexOf(bestUser), 1);
  }

  // Step 3: Send to BullMQ
  for (const user of selectedUsers) {
    console.log("sending", user);
    await subjectQueue.add("processSingleUser", user); // Job name remains descriptive
  }

  console.log("Selected Users Covering All Subjects:", selectedUsers);
  console.log(`Queued ${selectedUsers.length} users to BullMQ`);

  res.json({ message: "All users are sent to queue", selectedUsers });
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
