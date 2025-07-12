import asyncio
import base64
from playwright.async_api import async_playwright
import nest_asyncio
import os
import time

nest_asyncio.apply()

async def download_captchas(total=100, save_dir="captchas"):
    os.makedirs(save_dir, exist_ok=True)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)  # Use headless=True if needed
        context = await browser.new_context()
        page = await context.new_page()

        await page.goto("https://webportal.jiit.ac.in:6011/studentportal/#/")
        await page.wait_for_selector('img[src^="data:image"]', timeout=10000)

        last_captcha_data = ""

        for i in range(1, total + 1):
            try:
                # Refresh the page to load a new CAPTCHA
                await page.reload()
                await page.wait_for_selector('img[src^="data:image"]', timeout=10000)
                await asyncio.sleep(1)  # small wait to ensure new image loads

                captcha_data_url = await page.get_attribute('img[src^="data:image"]', 'src')
                base64_data = captcha_data_url.split(",")[1]

                # Check for repeated CAPTCHA
                if captcha_data_url == last_captcha_data:
                    print("⚠️  Duplicate CAPTCHA detected, retrying...")
                    continue
                last_captcha_data = captcha_data_url

                # Save as PNG
                file_path = os.path.join(save_dir, f"captcha_{i}.png")
                with open(file_path, "wb") as f:
                    f.write(base64.b64decode(base64_data))

                print(f"✅ Saved: {file_path}")
                time.sleep(1)

            except Exception as e:
                print(f"❌ Failed to fetch CAPTCHA {i}: {e}")
                continue

        await browser.close()

if __name__ == "__main__":
    asyncio.run(download_captchas(total=100))
