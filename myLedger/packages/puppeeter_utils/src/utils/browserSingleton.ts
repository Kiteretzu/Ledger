import puppeteer, { Browser } from "puppeteer";

let browserInstance: Browser | null = null;

export async function getBrowser(): Promise<Browser> {
  if (!browserInstance) {
    console.log(process.env.PUPPETEER_EXECUTABLE_PATH, "✅");
    console.log(process.env.NODE_ENV, "✅");

    if (process.env.NODE_ENV === "production") {
      browserInstance = await puppeteer.launch({
        headless: true,
        executablePath:
          process.env.PUPPETEER_EXECUTABLE_PATH || "/usr/bin/chromium",
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
        ],
      });
    } else {
      browserInstance = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });
    }

    // Close on process exit
    process.on("exit", async () => {
      if (browserInstance) await browserInstance.close();
    });
  }
  return browserInstance;
}
