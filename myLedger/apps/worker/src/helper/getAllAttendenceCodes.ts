import * as puppeteer from "puppeteer";
import { getBrowser } from "@repo/puppeteer_utils/browser";
import {
  setHashWithMidnightExpiry,
  setKeyWithMidnightExpiry,
} from "@repo/redis/redis-expiration";

type AttendanceExtractResult = {
  semesterCode: string;
  localname?: string;
  payload?: string;
  subjectCodes: string[];
  currentSem: string | null;
  totalSubjects: number;
}[];

export async function getAllAttendenceCodes(
  token: string,
  semesters: string[]
): Promise<AttendanceExtractResult> {
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
          console.log("Payload captured for", postData);
        }
      }
      request.continue();
    });

    // Go to portal and set token/localStorage
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

    // Navigate to attendance page
    await page.goto(
      "https://webportal.juit.ac.in:6011/studentportal/#/student/myclassattendance",
      { waitUntil: "networkidle2" }
    );

    const extractedData: AttendanceExtractResult = [];

    // Iterate over provided semesters array
    for (const semesterCode of semesters) {
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
          } catch (err) {
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

      await new Promise((resolve) => setTimeout(resolve, 1000));

      await page.waitForSelector(
        'mat-select[name="registrationcode"] .mat-mdc-select-trigger',
        { visible: true }
      );

      await page.evaluate(() => {
        const trigger = document.querySelector(
          'mat-select[name="registrationcode"] .mat-mdc-select-trigger'
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

      await Promise.all([
        new Promise<void>((resolve) => {
          const checkInterval = setInterval(() => {
            if (result.localname && result.payload) {
              clearInterval(checkInterval);
              resolve();
            }
          }, 100);
          setTimeout(() => {
            clearInterval(checkInterval);
            resolve();
          }, 5000);
        }),
        responsePromise,
      ]);

      const responseData = await responsePromise;

      let subjectCodes: string[] = [];
      if (responseData?.response?.studentattendancelist) {
        subjectCodes = responseData.response.studentattendancelist
          .map((subject: any) => subject.subjectcode)
          .filter(Boolean);
      }

      extractedData.push({
        semesterCode,
        localname: result.localname,
        payload: result.payload,
        subjectCodes,
        currentSem: responseData?.response?.currentSem || null,
        totalSubjects: subjectCodes.length,
      });

      console.log("Successfully captured payload for semesterCode:", semesterCode);

      // Save in Redis
      if (semesterCode && result.payload) {
        setHashWithMidnightExpiry(`attendance`, semesterCode, result.payload);
      }

      await new Promise((resolve) => setTimeout(resolve, 1500));
    }

    return extractedData;
  } finally {
    if (browser) await browser.close();
  }
}
