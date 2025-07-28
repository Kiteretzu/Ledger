import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";
import { extractTextFromImage } from "@repo/aws_utils"; // adjust import path if needed
import { getBrowser } from "./utils/browserSingleton"; // adjust import path if needed

export const login = async (username: string, password: string) => {
  let browser;
  let isFailedCaptcha = false; // shared flag

  try {
    browser = await getBrowser();

    const page = await browser.newPage();

    page.on("response", async (response) => {
      if (response.url().includes("pretoken-check")) {
        console.log("Response URL:", response.url());
        try {
          const data = await response.json(); // Get payload
          console.log("Response Payload:", data);
          if (data.status.errors.length > 0) {
            throw new Error("Login failed: captcha failed ");
            return;
          }
        } catch (error) {
          isFailedCaptcha = true;
        }
      }
    });

    // Go to login page and wait for username field
    await Promise.all([
      page.goto("https://webportal.juit.ac.in:6011/studentportal/#/", {
        waitUntil: "networkidle2",
        timeout: 30000,
      }),
      page.waitForSelector('input[formcontrolname="userid"]', {
        timeout: 10000,
      }),
    ]);

    // Fill username
    await page.evaluate((username) => {
      const input = document.querySelector(
        'input[formcontrolname="userid"]'
      ) as HTMLInputElement;
      if (input) {
        input.value = username;
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
    }, username);

    // Extract CAPTCHA image
    const captchaDataUrl = await page.evaluate(() => {
      const img = document.querySelector(
        'img[src^="data:image"]'
      ) as HTMLImageElement;
      return img ? img.src : "";
    });

    if (!captchaDataUrl) throw new Error("CAPTCHA image not found");

    // Save CAPTCHA image locally
    const base64Data = captchaDataUrl.split(",")[1];
    const imagePath = path.join(__dirname, "../src/captcha/captcha.jpg");
    const dir = path.dirname(imagePath);

    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    fs.writeFileSync(imagePath, Buffer.from(base64Data, "base64"));

    console.log("Reached here", imagePath);

    // Extract text from CAPTCHA
    const captchaText = await extractTextFromImage("src/captcha/captcha.jpg");
    if (!captchaText) throw new Error("Failed to extract CAPTCHA text");

    // Fill CAPTCHA
    await page.evaluate((text) => {
      const input = document.querySelector(
        'input[formcontrolname="captcha"]'
      ) as HTMLInputElement;
      if (input) {
        input.value = text;
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
    }, captchaText);

    // Submit first form
    await Promise.all([
      page.click('button[aria-label="LOGIN"]'),
      page.waitForNavigation({ waitUntil: "networkidle0", timeout: 15000 }),
    ]);

    if (isFailedCaptcha) {
      return {
        isFailedCaptcha: true,
        captchaText: "",
        currentUrl: page.url(),
        isLoginSuccessful: false,
        message: "Login failed due to captcha",
        token: "",
      };
    }

    // Fill password
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
      const loginButton = document.querySelector('button[aria-label="LOGIN"]');
      if (loginButton) {
        loginButton.removeAttribute("disabled");
        loginButton.classList.remove("mat-mdc-button-touch-target");
        loginButton.click();
      }
    });

    await page.waitForNavigation({ waitUntil: "networkidle0", timeout: 15000 });

    // Get login result
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

    // Return result
    return {
      message: isLoginSuccessful ? "Login successful" : "Login failed",
      currentUrl,
      token,
      isLoginSuccessful,
      captchaText,
      isFailedCaptcha: false,
    };
  } catch (error: any) {
    if (browser) await browser.close();
    console.error("Login automation failed:", error);
    throw new Error(`Login automation failed: ${error.message}`);
  }
};
