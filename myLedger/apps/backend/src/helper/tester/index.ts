import redis, { subjectQueue } from "@repo/redis/main";
import { setHashWithMidnightExpiry } from "@repo/redis/redis-expiration";
import puppeteer from "puppeteer";
import { client as prisma } from "@repo/db/client";
import { getBrowser } from "@repo/puppeteer_utils/browser";

export async function areAllSubjectsPayloadAvailable(
  username: string,
  token: string,
  semesterLabel: string
) {
  let browser: puppeteer.Browser | null = null;
  const result: { localname?: string; payload?: string } = {};

  try {
    browser = await getBrowser();

    const page = await browser.newPage();
    const targetUrlKeywords = ["getstudentattendancedetail"];

    // Capture payload from requests
    await page.setRequestInterception(true);
    page.on("request", (request) => {
      if (
        targetUrlKeywords.some((keyword) => request.url().includes(keyword))
      ) {
        const headers = request.headers();
        if (headers["localname"]) result.localname = headers["localname"];
        const postData = request.postData();
        if (postData) result.payload = postData;
      }
      request.continue();
    });

    // Go to login page and set localStorage/sessionStorage
    await page.goto("https://webportal.juit.ac.in:6011/studentportal/#/", {
      waitUntil: "networkidle2", // waits until there are no network requests for 500ms
      timeout: 60000, // 60 seconds instead of 30 seconds
    });

    await page.evaluate(
      (token, username) => {
        localStorage.setItem("Token", token);
        localStorage.setItem("Username", username);
        localStorage.setItem("activeform", "My Attendance");
        localStorage.setItem("bypassValue", "fG3a4YsgeK/IJEK4+vjHjg==");
        localStorage.setItem("clientid", "JAYPEE");
        localStorage.setItem("enrollmentno", username);
        localStorage.setItem("instituteid", "INID2201J000001");
        localStorage.setItem(
          "institutename",
          "JAYPEE UNIVERSITY OF INFORMATION TECHNOLOGY"
        );
        localStorage.setItem("membertype", "S");
        localStorage.setItem("name", "SMARTH VERMA");
        localStorage.setItem("otppwd", "PWD");
        localStorage.setItem("rejectedData", "NoData");
        localStorage.setItem("tokendate", new Date().toString());
        localStorage.setItem("userid", "USID2311A0000264");
        localStorage.setItem("usertypeselected", "S");

        sessionStorage.setItem("clientidforlink", "JUIT");
        sessionStorage.setItem(
          "phantom.contentScript.providerInjectionOptions.v3",
          '{"hideProvidersArray":false,"dontOverrideWindowEthereum":false}'
        );
        sessionStorage.setItem("tokendate", new Date().toString());
      },
      token,
      username
    );

    // Navigate to attendance page
    await page.goto(
      "https://webportal.juit.ac.in:6011/studentportal/#/student/myclassattendance",
      { waitUntil: "networkidle2" }
    );

    const timeBefore = Date.now();
    await new Promise((r) => setTimeout(r, 1000));

    // Extraction for single semester (semesterLabel)
    let capturedResponseData: any = null;

    const responsePromise = new Promise<any>((resolve) => {
      const responseListener = async (response: puppeteer.HTTPResponse) => {
        try {
          if (
            targetUrlKeywords.some((keyword) =>
              response.url().includes(keyword)
            )
          ) {
            const json = await response.json();
            capturedResponseData = json;
            page.off("response", responseListener);
            resolve(json);
          }
        } catch {
          resolve(null);
        }
      };

      page.on("response", responseListener);
      setTimeout(() => {
        page.off("response", responseListener);
        resolve(null);
      }, 10000);
    });

    result.localname = undefined;
    result.payload = undefined;

    // Select semester
    await new Promise((r) => setTimeout(r, 1000));
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
    }, semesterLabel);

    await page.click('button[aria-label="Submit"]');

    // Wait for request and response
    await Promise.all([
      new Promise<void>((resolve) => {
        const interval = setInterval(() => {
          if (result.localname && result.payload) {
            clearInterval(interval);
            resolve();
          }
        }, 100);
        setTimeout(() => {
          clearInterval(interval);
          resolve();
        }, 5000);
      }),
      responsePromise,
    ]);

    const responseData = await responsePromise;

    const student = await prisma.student.findUnique({
      where: { username },
    });

    const semester = await prisma.semester.create({
      data: {
        label: semesterLabel,
        student: { connect: { id: student.id! } },
      },
    });

    console.log("Semester created", semester.label);

    for (const subj of responseData.response.studentattendancelist) {
      const subjectCode = subj.individualsubjectcode;
      const subjectName = subj.subjectcode;

      await prisma.subject.upsert({
        where: {
          code_semesterId: {
            code: subjectCode,
            semesterId: semester.id,
          },
        },
        update: {
          name: subjectName,
          attendance: subj, // ✅ Save exact structure
        },
        create: {
          code: subjectCode,
          name: subjectName,
          attendance: subj, // ✅ Save exact structure
          semester: { connect: { id: semester.id } },
        },
      });
    }

    console.log(
      `✅ Subjects for semester ${semesterLabel} saved for ${username}`
    );

    let subjectCodes: string[] = [];
    if (responseData?.response?.studentattendancelist) {
      subjectCodes = responseData.response.studentattendancelist
        .map((subject: any) => subject.subjectcode)
        .filter(Boolean);
    }

    if (semesterLabel && result.payload) {
      setHashWithMidnightExpiry("attendance", semesterLabel, result.payload);
    }

    const duration = Date.now() - timeBefore;

    for (const subjectCode of subjectCodes) {
      const allPayloads = await redis.hgetall("Subject");
      const payload = allPayloads[subjectCode];
      if (!payload) {
        console.log(
          username,
          "SEM",
          semesterLabel,
          "SUBJECT CODE",
          subjectCode
        );
        await subjectQueue.add(
          "processSingleUser",
          {
            username,
            token,
            semesterLabel,
          },
          {
            attempts: 3, // retry up to 3 times
            backoff: 5000, // wait 5s between retries
          }
        );
        break;
      } else {
        console.log("FOUND", subjectCode);
      }
    }

    return {
      message: `Extraction complete for semester ${semesterLabel}`,
      data: {
        semesterCode: semesterLabel,
        localname: result.localname,
        payload: result.payload,
        subjectCodes,
        currentSem: responseData?.response?.currentSem || null,
        totalSubjects: subjectCodes.length,
      },
      duration,
    };
  } catch (error: any) {
    console.error("Extraction failed:", error);
    throw new Error(error.message);
  } finally {
    if (browser) await browser.close();
  }
}
