import { client as prisma } from "@repo/db/client"; // Adjust the import path as necessary
import {
  setHashWithMidnightExpiry,
  setKeyWithMidnightExpiry,
} from "@repo/redis/redis-expiration";
import { Request, Response } from "express";
import * as puppeteer from "puppeteer";

import { getBrowser } from "@repo/puppeteer_utils/browser";
import redis, { subjectQueue } from "@repo/redis/main";

export const extractAttendenceData = async (req: Request, res: Response) => {
  const token = req.query.token as string;
  let browser: puppeteer.Browser | null = null;
  const result: { localname?: string; payload?: string } = {};

  try {
    browser = await getBrowser();

    const page = await browser.newPage();

    const targetUrlKeywords = ["getstudentattendancedetail"];

    await page.setRequestInterception(true);
    page.on("request", (request) => {
      if (
        targetUrlKeywords.some((keyword) => request.url().includes(keyword))
      ) {
        const headers = request.headers();
        if (headers["localname"]) {
          result.localname = headers["localname"];
          setKeyWithMidnightExpiry("localname", result.localname);
        }
        const postData = request.postData();
        if (postData) {
          result.payload = postData;
          console.log("Captured payload:", postData);
        }
      }

      request.continue();
    });

    await page.goto("https://webportal.juit.ac.in:6011/studentportal/#/", {
      waitUntil: "networkidle2",
    });

    await page.evaluate((token) => {
      localStorage.setItem("Token", token);
      localStorage.setItem("Username", "231030118");
      localStorage.setItem("activeform", "My Attendance");
      localStorage.setItem("bypassValue", "fG3a4YsgeK/IJEK4+vjHjg==");
      localStorage.setItem("clientid", "JAYPEE");
      localStorage.setItem("enrollmentno", "231030118");
      localStorage.setItem("instituteid", "INID2201J000001");
      localStorage.setItem(
        "institutename",
        "JAYPEE UNIVERSITY OF INFORMATION TECHNOLOGY"
      );
      localStorage.setItem("membertype", "S");
      localStorage.setItem("name", "SMARTH VERMA");
      localStorage.setItem("otppwd", "PWD");
      localStorage.setItem("rejectedData", "NoData");
      localStorage.setItem(
        "tokendate",
        "Thu Jul 09 2025 16:33:31 GMT+0530 (India Standard Time)"
      );
      localStorage.setItem("userid", "USID2311A0000264");
      localStorage.setItem("usertypeselected", "S");

      sessionStorage.setItem("clientidforlink", "JUIT");
      sessionStorage.setItem(
        "phantom.contentScript.providerInjectionOptions.v3",
        '{"hideProvidersArray":false,"dontOverrideWindowEthereum":false}'
      );
      sessionStorage.setItem(
        "tokendate",
        "Wed Jul 09 2025 16:33:31 GMT+0530 (India Standard Time)"
      );
    }, token);

    // for attendance extraction
    await page.goto(
      "https://webportal.juit.ac.in:6011/studentportal/#/student/myclassattendance",
      { waitUntil: "networkidle2" }
    );

    const timeBefore = Date.now();
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await page.waitForSelector("#mat-select-0 .mat-mdc-select-trigger", {
      visible: true,
    });
    await page.evaluate(() => {
      const trigger = document.querySelector(
        "#mat-select-0 .mat-mdc-select-trigger"
      ) as HTMLElement;
      if (trigger) trigger.click();
    });

    await page.waitForSelector(".mat-mdc-option span", { visible: true });

    const allSemesterCodes = await page.evaluate(() => {
      return Array.from(document.querySelectorAll(".mat-mdc-option span")).map(
        (el) => el.textContent?.trim()
      );
    });
    console.log("Available Semester Codes:", allSemesterCodes);

    const extractedData = [];

    for (const semesterCode of allSemesterCodes) {
      let capturedResponseData: any = null;

      // Create a promise that resolves when we get the response
      const responsePromise = new Promise<any>((resolve) => {
        const responseListener = async (response: puppeteer.HTTPResponse) => {
          try {
            if (
              targetUrlKeywords.some((keyword) =>
                response.url().includes(keyword)
              )
            ) {
              const json = await response.json();
              console.log(`Captured response for ${semesterCode}:`, json);
              capturedResponseData = json;
              page.off("response", responseListener); // Remove listener
              resolve(json); // Resolve the promise with the response data
            }
          } catch (err) {
            console.error("Error reading response body:", err);
            resolve(null); // Resolve with null on error
          }
        };

        page.on("response", responseListener);

        // Set a timeout to resolve with null if no response is captured
        setTimeout(() => {
          page.off("response", responseListener);
          resolve(null);
        }, 10000); // 10 second timeout
      });

      // Reset result for this iteration
      result.localname = undefined;
      result.payload = undefined;

      // Select semester and submit
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await page.waitForSelector("#mat-select-0 .mat-mdc-select-trigger", {
        visible: true,
      });
      await page.evaluate(() => {
        const trigger = document.querySelector(
          "#mat-select-0 .mat-mdc-select-trigger"
        ) as HTMLElement;
        if (trigger) trigger.click();
      });

      await new Promise((resolve) => setTimeout(resolve, 1000));
      await page.evaluate((code) => {
        const options = Array.from(
          document.querySelectorAll(".mat-mdc-option span")
        );
        const target = options.find((el) => el.textContent?.trim() === code);
        if (target) (target as HTMLElement).click();
      }, semesterCode);

      await page.click('button[aria-label="Submit"]');

      // Wait for both request capture and response capture
      await Promise.all([
        // Wait for request data
        new Promise<void>((resolve) => {
          const checkInterval = setInterval(() => {
            if (result.localname && result.payload) {
              clearInterval(checkInterval);
              resolve();
            }
          }, 100);

          // Timeout after 5 seconds
          setTimeout(() => {
            clearInterval(checkInterval);
            resolve();
          }, 5000);
        }),
        // Wait for response data
        responsePromise,
      ]);

      // Wait for the response promise to complete
      const responseData = await responsePromise;

      // Extract subject codes from the response
      let subjectCodes: string[] = [];
      if (responseData?.response?.studentattendancelist) {
        subjectCodes = responseData.response.studentattendancelist
          .map((subject: any) => subject.subjectcode)
          .filter(Boolean);
      }

      // Push all data for this semester
      extractedData.push({
        semesterCode,
        localname: result.localname,
        payload: result.payload,
        subjectCodes: subjectCodes, // Only subject codes instead of full response
        currentSem: responseData?.response?.currentSem || null,
        totalSubjects: subjectCodes.length,
      });

      // Save in Redis
      if (semesterCode && result.payload) {
        setHashWithMidnightExpiry(`attendance`, semesterCode, result.payload);
        console.log(
          "Saved attendance data for semester🤣:",
          semesterCode,
          result.payload
        );
      }

      await new Promise((resolve) => setTimeout(resolve, 1500));
    }

    const timeAfter = Date.now();
    const duration = timeAfter - timeBefore;

    const allSubjects = extractedData.map((sem) => sem.subjectCodes).flat();
    console.log("THIS IS ALL SUBJECTS", allSubjects);

    allSubjects.forEach(async (subjectCode) => {
      const allPayloads = await redis.hgetall("Subject");
      const payload = allPayloads[subjectCode];

      if (!payload) {
        // WIP: push to BullMQ queue for further processing

        console.log("NOT FOUND", subjectCode);
      }

      if (payload) {
        console.log("FOUND SOMETHING!!!");
      }
    });

    res.status(200).json({
      message: "Extraction complete for all semester codes",
      data: extractedData,
      duration,
      allSemesterCodes,
    });
  } catch (error: any) {
    console.error("Extraction failed:", error);
    res.status(500).json({
      error: "Extraction failed",
      details: error.message,
    });
  } finally {
    if (browser) await browser.close();
  }
};

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
    await subjectQueue.add("processSingleUser", user);
  }

  console.log("Selected Users Covering All Subjects:", selectedUsers);
  console.log(`Queued ${selectedUsers.length} users to BullMQ`);

  res.json({ message: "All users are sent to queue", selectedUsers });
};

//WIP complete this properly
export const getAllpossibleAttendCodes = async (
  req: Request,
  res: Response
) => {
  const allPayloads = await redis.hgetall("attendance");

  if (!allPayloads || Object.keys(allPayloads).length === 0) {
    return res.status(404).json({
      error: "No attendance data found",
    });
  }

  const allSemesterCodes = Object.keys(allPayloads);
  console.log("Available Semester Codes:", allSemesterCodes);

  res.status(200).json({
    message: "All semester codes fetched successfully",
    semesterCodes: allSemesterCodes,
  });
};
