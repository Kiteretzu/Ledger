import { Request, Response } from "express";
import * as puppeteer from "puppeteer";
import {
  setHashWithMidnightExpiry,
  setKeyWithMidnightExpiry,
} from "@repo/redis/redis-expiration";
import { client as prisma } from "@repo/db/client"; // Adjust the import path as necessary

import redis, { subjectQueue } from "@repo/redis/main";
import bullmq from "bullmq";


export const extractAttendenceData = async (req: Request, res: Response) => {
  const token = req.query.token as string;
  let browser: puppeteer.Browser | null = null;
  const result: { localname?: string; payload?: string } = {};

  try {
    browser = await puppeteer.launch({
      headless: false,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();

    const targetUrlKeywords = [
      "getstudentattendancedetail",
      "getstudentsubjectpersentage",
    ];

    await page.setRequestInterception(true);
    page.on("request", (request) => {
      if (
        targetUrlKeywords.some((keyword) => request.url().includes(keyword))
      ) {
        const headers = request.headers();
        if (headers["localname"]) {
          result.localname = headers["localname"];
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

      for (let i = 0; i < 4; i++) {
        if (result.localname && result.payload) break;
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      extractedData.push({
        semesterCode,
        localname: result.localname,
        payload: result.payload,
      });

      if (semesterCode && result.payload) {
        setHashWithMidnightExpiry(`attendance`, semesterCode, result.payload);
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    const timeAfter = Date.now();
    const duration = timeAfter - timeBefore;

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

export const detailAttendenceOfSubject = async (
  req: Request,
  res: Response
) => {
  const token = req.query.token as string;
  const semesterCode = req.query.semester as string;

  let browser: puppeteer.Browser | null = null;
  const result: {
    localname?: string;
    payload?: string;
    overallLTP?: any[];
    clickedLinks?: any[];
  } = {};

  try {
    browser = await puppeteer.launch({
      headless: false,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();

    const targetUrlKeywords = [
      "getstudentattendancedetail",
      "getstudentsubjectpersentage",
    ];

    await page.setRequestInterception(true);
    page.on("request", (request) => {
      if (
        targetUrlKeywords.some((keyword) => request.url().includes(keyword))
      ) {
        const headers = request.headers();
        if (headers["localname"]) {
          result.localname = headers["localname"];
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

    await page.evaluate((code) => {
      const options = Array.from(
        document.querySelectorAll(".mat-mdc-option span")
      );
      const target = options.find((el) => el.textContent?.trim() === code);
      if (target) (target as HTMLElement).click();
    }, semesterCode);

    await new Promise((resolve) => setTimeout(resolve, 1000));
    await page.click('button[aria-label="Submit"]');
    // ✅ Wait until at least one row is visible after table loads
    await page.waitForSelector("p-table table tbody tr", {
      visible: true,
      timeout: 5000,
    });

    console.log("hit the submit");
    // Extract Overall LTP data after the table loads
    const overallLTPData = await page.evaluate(() => {
      const table = document.querySelector("p-table table");
      console.log("this is table", table);
      if (!table) return [];

      console.log("we got table", table);

      const rows = table.querySelectorAll("tbody tr");
      const data: any[] = [];

      rows.forEach((row, index) => {
        const cells = row.querySelectorAll("td");
        if (cells.length >= 6) {
          const slNo = cells[0].textContent?.trim();
          const subjectCode = cells[1].textContent?.trim();
          const overallLTPCell = cells[5]; // 6th column (index 5) is Overall LTP(%)
          const overallLTPLink = overallLTPCell.querySelector("a.mylink");

          data.push({
            slNo: slNo,
            subjectCode: subjectCode,
            overallLTP: overallLTPLink?.textContent?.trim() || null,
            hasLink: !!overallLTPLink?.textContent?.trim(),
            rowIndex: index,
          });
        }
      });

      return data;
    });

    result.overallLTP = overallLTPData;
    console.log("Overall LTP Data:", overallLTPData);

    // Click each a.mylink in Overall LTP column with 1 second intervals
    const clickedLinksData = [];
    const linksToClick = overallLTPData.filter((item) => item.hasLink);

    console.log(`Found ${linksToClick.length} links to click`);

    for (let i = 0; i < linksToClick.length; i++) {
      const linkData = linksToClick[i];

      // Reset current payload holder for each click
      let currentPayload: string | null = null;

      const requestListener = async (request: puppeteer.HTTPRequest) => {
        try {
          if (
            targetUrlKeywords.some((keyword) => request.url().includes(keyword))
          ) {
            const postData = request.postData();
            if (postData) {
              currentPayload = postData;
              console.log(
                `Captured payload for ${linkData.subjectCode}:`,
                postData
              );

              setHashWithMidnightExpiry(
                `Subject`,
                linkData.subjectCode,
                postData
              );
            }
          }

          if (!request.isInterceptResolutionHandled()) {
            await request.continue();
          }
        } catch (err) {
          console.error("Request handling error:", err);
        }
      };

      // Attach temporary listener
      page.on("request", requestListener);

      try {
        console.log(
          `Clicking link ${i + 1}/${linksToClick.length} for subject: ${
            linkData.subjectCode
          }`
        );

        const clickResult = await page.evaluate((rowIndex) => {
          const table = document.querySelector("#pn_id_1-table");
          if (!table) return { success: false, error: "Table not found" };

          const rows = table.querySelectorAll("tbody tr");
          const targetRow = rows[rowIndex];
          if (!targetRow) return { success: false, error: "Row not found" };

          const cells = targetRow.querySelectorAll("td");
          const overallLTPCell = cells[5];
          const overallLTPLink = overallLTPCell.querySelector("a.mylink");

          if (!overallLTPLink)
            return { success: false, error: "Link not found in cell" };

          try {
            (overallLTPLink as HTMLElement).click();
            return {
              success: true,
              linkText: overallLTPLink.textContent?.trim(),
              message: "Link clicked successfully",
            };
          } catch (error) {
            return { success: false, error: `Click failed: ${error}` };
          }
        }, linkData.rowIndex);

        // Add result + payload
        clickedLinksData.push({
          ...linkData,
          clickResult,
          clickedAt: new Date().toISOString(),
        });
        ``;

        console.log(`Click result for ${linkData.subjectCode}:`, clickResult);

        await new Promise((resolve) => setTimeout(resolve, 500));
        if (i < linksToClick.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      } catch (error) {
        console.error(
          `Error clicking link for ${linkData.subjectCode}:`,
          error
        );
        clickedLinksData.push({
          ...linkData,
          clickResult: { success: false, error: error.message },
          clickedAt: new Date().toISOString(),
          capturedPayload: null,
        });
      } finally {
        // Remove listener to avoid memory leaks
        page.off("request", requestListener);
      }
    }

    result.clickedLinks = clickedLinksData;
    console.log("All links clicked. Summary:", {
      totalLinks: linksToClick.length,
      successfulClicks: clickedLinksData.filter(
        (item) => item.clickResult.success
      ).length,
      failedClicks: clickedLinksData.filter((item) => !item.clickResult.success)
        .length,
    });

    // Additional wait to allow for any final network requests or page updates
    await new Promise((resolve) => setTimeout(resolve, 2000));
  } catch (error: any) {
    console.error("Extraction failed:", error);
    res.status(500).json({
      error: "Extraction failed",
      details: error.message,
    });
    return;
  } finally {
    if (browser) await browser.close();
  }

  res.status(200).json({
    message: "Detailed attendance extraction complete with link clicking",
    data: {
      localname: result.localname,
      payload: result.payload,
      clickedLinks: result.clickedLinks,
      summary: {
        totalSubjects: result.overallLTP?.length || 0,
        subjectsWithAttendance:
          result.overallLTP?.filter((item) => item.hasLink).length || 0,
        totalLinksClicked: result.clickedLinks?.length || 0,
        successfulClicks:
          result.clickedLinks?.filter((item) => item.clickResult?.success)
            .length || 0,
        failedClicks:
          result.clickedLinks?.filter((item) => !item.clickResult?.success)
            .length || 0,
      },
    },
  });
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
              label: true, // or `id` if you prefer
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
  };

  // Step 1: Flatten and collect all users with subjects
  const allSubjects = new Set<string>();
  const users: User[] = [];

  for (const user of allUsersRaw) {
    const userSubjects = new Set<string>();

    if (user.student) {
      for (const sem of user.student.Semester) {
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
        user.tokenExpiry && user.tokenExpiry <= new Date() ? null : user.token, // Check if token is expired
      subjects: userSubjects,
    });
  }

  // Step 2: Greedy Selection
  const coveredSubjects = new Set<string>();
  const selectedUsers: {
    username: string;
    password: string;
    token: string | null;
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

    if (!bestUser) break; // No progress can be made (shouldn't happen)

    // also slect the user token
    selectedUsers.push({
      username: bestUser.username,
      password: bestUser.password,
      token: bestUser.token || null, // Include token if available
    });

    for (const subj of bestUser.subjects) {
      coveredSubjects.add(subj);
    }

    // Optional: Remove user from future consideration
    users.splice(users.indexOf(bestUser), 1);
  }
  for (const user of selectedUsers) {
    await subjectQueue.add("processSingleUser", user);
  }
  // Output
  console.log("Selected Users Covering All Subjects:", selectedUsers);

  res.json({ message: "All users are sent to queue", selectedUsers });
};
