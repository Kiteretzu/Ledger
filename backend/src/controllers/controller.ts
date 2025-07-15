import axios from "axios";
import { Request, Response } from "express";
import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";
import { extractTextFromImage } from "../helper/getCaptcha";
import redis from "../redis";

export const loginSimple = async (req: Request, res: Response) => {
  const { username, password } = req.body;
  let browser;

  try {
    browser = await puppeteer.launch({
      headless: false, // Set to true for production
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
      // Removed slowMo for faster execution
    });

    const page = await browser.newPage();

    // Set up parallel tasks for faster execution
    const [_, captchaPromise] = await Promise.all([
      page.goto("https://webportal.juit.ac.in:6011/studentportal/#/", {
        waitUntil: "networkidle2",
        timeout: 30000,
      }),
      page.waitForSelector('input[formcontrolname="userid"]', {
        timeout: 10000,
      }),
    ]);

    // Fill username directly using evaluate (faster than typing)
    await page.evaluate((username) => {
      const input = document.querySelector(
        'input[formcontrolname="userid"]'
      ) as HTMLInputElement;
      if (input) {
        input.value = username;
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
    }, username);

    // Process CAPTCHA
    const captchaDataUrl = await page.evaluate(() => {
      const img = document.querySelector(
        'img[src^="data:image"]'
      ) as HTMLImageElement;
      return img ? img.src : "";
    });

    if (!captchaDataUrl) {
      throw new Error("CAPTCHA image not found");
    }

    // Write CAPTCHA image in parallel with other operations
    const base64Data = captchaDataUrl.split(",")[1];
    const imagePath = path.join(__dirname, "../src/captcha/captcha.jpg");
    const dir = path.dirname(imagePath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(imagePath, Buffer.from(base64Data, "base64"));
    const captchaText = await extractTextFromImage("src/captcha/captcha.jpg");

    if (!captchaText) {
      throw new Error("Failed to extract CAPTCHA text");
    }

    // Fill CAPTCHA directly
    await page.evaluate((text) => {
      const input = document.querySelector(
        'input[formcontrolname="captcha"]'
      ) as HTMLInputElement;
      if (input) {
        input.value = text;
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
    }, captchaText);

    // Submit first form and wait for navigation
    await Promise.all([
      page.click('button[aria-label="LOGIN"]'),
      page.waitForNavigation({ waitUntil: "networkidle0", timeout: 15000 }),
    ]);

    // Fill password directly
    await page.evaluate((password) => {
      const input = document.querySelector(
        'input[formcontrolname="password"]'
      ) as HTMLInputElement;
      if (input) {
        input.value = password;
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
    }, password);

    // Submit final form
    await page.evaluate(() => {
      // Find the login button
      const loginButton = document.querySelector('button[aria-label="LOGIN"]');

      if (loginButton) {
        // Remove disabled attribute
        loginButton.removeAttribute("disabled");

        // Remove disabled class if exists
        loginButton.classList.remove("mat-mdc-button-touch-target");

        // Trigger click
        loginButton.click();
      }
    });

    await page.waitForNavigation({ waitUntil: "networkidle0", timeout: 15000 });

    // Check login status
    const [currentUrl, bodyText, token] = await Promise.all([
      page.url(),
      page.evaluate(() => document.body.innerText),
      page.evaluate(() => localStorage.getItem("Token")),
    ]);

    const isLoginSuccessful =
      !bodyText.includes("Enter Password") &&
      !bodyText.includes("Invalid") &&
      !bodyText.includes("Error") &&
      !bodyText.includes("LOGIN");

    await browser.close();

    res.status(200).json({
      message: isLoginSuccessful ? "Login successful" : "Login may have failed",
      bodyText: bodyText.substring(0, 500),
      currentUrl,
      token,
      isLoginSuccessful,
      captchaText,
    });
  } catch (error) {
    console.error("Login automation failed:", error);

    if (browser) {
      await browser.close();
    }

    res.status(500).json({
      error: "Login automation failed",
      details: error.message,
    });
  }
};

//

// Controller to fetch attendance details from JUIT web portal
export const fetchAttendanceDetails = async (req: Request, res: Response) => {
  try {
    const token = req.query.token;
    console.log("this is token", token);

    const url =
      "https://webportal.juit.ac.in:6011/StudentPortalAPI/StudentClassAttendance/getstudentattendancedetail";

    const oldAuthorization = "Bearer " + token;

    const localname = await redis.get("localname");
    const payload = await redis.get("payload");

    console.log({ localname, payload });
    const headers = {
      Accept: "application/json, text/plain, */*",
      "Accept-Encoding": "gzip, deflate, br, zstd",
      "Accept-Language": "en-US,en;q=0.5",
      Authorization: oldAuthorization,
      Connection: "keep-alive",
      "Content-Type": "application/json",
      Host: "webportal.juit.ac.in:6011",
      LocalName: localname,
      Origin: "https://webportal.juit.ac.in:6011",
      Referer: "https://webportal.juit.ac.in:6011/studentportal/",
      "Sec-Fetch-Dest": "empty",
      "Sec-Fetch-Mode": "cors",
      "Sec-Fetch-Site": "same-origin",
      "Sec-GPC": "1",
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",
      "sec-ch-ua":
        '"Not)A;Brand";v="8", "Chromium";v="138", "Google Chrome";v="138"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"macOS"',
    };

    // Fixed: Remove the extra quotes around the data to match curl's --data-raw
    const data = payload;

    const response = await axios.post(url, data, { headers });

    if (!response.data) {
      console.log("response", response);
      return res.status(404).json({
        error: "No attendance details found",
      });
    }

    res.status(200).json(response.data);
  } catch (error: any) {
    console.error("Failed to fetch attendance details:", error);
    res.status(500).json({
      error: "Failed to fetch attendance details",
      details: error.message || error.toString(),
    });
  }
};

export const extractPayloadAndLocalname = async (
  req: Request,
  res: Response
) => {
  const token = req.query.token as string;
  let browser: puppeteer.Browser | null = null;
  const result: { localname?: string; payload?: string } = {};

  try {
    browser = await puppeteer.launch({
      headless: false,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();

    const targetUrlKeyword = "getstudentattendancedetail";

    await page.setRequestInterception(true);
    page.on("request", (request) => {
      if (request.url().includes(targetUrlKeyword)) {
        const headers = request.headers();
        if (headers["localname"]) {
          result.localname = headers["localname"];
        }
        const postData = request.postData();
        if (postData) {
          result.payload = postData;
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

    const semesterCode = "2025ODDSEM";
    await page.evaluate((semesterCode) => {
      const options = Array.from(
        document.querySelectorAll(".mat-mdc-option span")
      );
      const target = options.find(
        (el) => el.textContent?.trim() === semesterCode
      );
      if (target) (target as HTMLElement).click();
    }, semesterCode);

    await page.click('button[aria-label="Submit"]');

    for (let i = 0; i < 30; i++) {
      if (result.localname && result.payload) break;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    await Promise.all([
      redis.set("localname", result.localname || ""),
      redis.set("payload", result.payload || ""),
    ]);

    const timeAfter = Date.now();
    const duration = timeAfter - timeBefore;

    res.status(200).json({
      message: "Extraction complete and data stored in Redis",
      data: result,
      duration,
      semesterCode,
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
