import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";
import { extractTextFromImage } from "./captchaUtils"; // adjust import
import { saveUserCredentials } from "./userUtils"; // adjust import

export async function performLogin(username: string, password: string) {
    let browser;

    try {
        browser = await puppeteer.launch({
            headless: false, // true for production
            args: ["--no-sandbox", "--disable-setuid-sandbox"],
        });

        const page = await browser.newPage();

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

        // Get CAPTCHA
        const captchaDataUrl = await page.evaluate(() => {
            const img = document.querySelector(
                'img[src^="data:image"]'
            ) as HTMLImageElement;
            return img ? img.src : "";
        });

        if (!captchaDataUrl) throw new Error("CAPTCHA image not found");

        const base64Data = captchaDataUrl.split(",")[1];
        const imagePath = path.join(__dirname, "../src/captcha/captcha.jpg");

        if (!fs.existsSync(path.dirname(imagePath))) {
            fs.mkdirSync(path.dirname(imagePath), { recursive: true });
        }

        fs.writeFileSync(imagePath, Buffer.from(base64Data, "base64"));
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

        // Submit final login
        await page.evaluate(() => {
            const loginButton = document.querySelector('button[aria-label="LOGIN"]');
            if (loginButton) {
                loginButton.removeAttribute("disabled");
                loginButton.classList.remove("mat-mdc-button-touch-target");
                loginButton.click();
            }
        });

        await page.waitForNavigation({ waitUntil: "networkidle0", timeout: 15000 });

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

        void saveUserCredentials(username, password, token);

        return {
            message: isLoginSuccessful ? "Login successful" : "Login may have failed",
            bodyText: bodyText.substring(0, 500),
            currentUrl,
            token,
            isLoginSuccessful,
            captchaText,
        };
    } catch (error) {
        if (browser) await browser.close();
        throw new Error(error.message || "Login automation failed");
    }
}