import puppeteer, { Browser } from "puppeteer";

export async function getBrowser(): Promise<Browser> {
  if (process.env.NODE_ENV === "production") {
    return await puppeteer.launch({
      headless: true, // Run headless in Docker
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--window-size=1280,720",
      ],
    });
  } else {
    return await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
  }
}
