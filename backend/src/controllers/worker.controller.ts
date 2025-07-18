import { Request, Response } from "express";
import * as puppeteer from "puppeteer";
import redis from "../redis"; // Adjust path as needed

export const extractExamsData = async (req: Request, res: Response) => {
  const token = req.query.token as string;
  let browser: puppeteer.Browser | null = null;
  const result: { localname?: string; payload?: string } = {};

  try {
    browser = await puppeteer.launch({
      headless: false,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();

    // Updated target URL keyword for exams data
    const targetUrlKeyword = "getstudent-exammarks"; // or whatever the actual endpoint is

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
          console.log("Exam data payload:", postData);
        }
      }

      request.continue();
    });

    // Set up localStorage with token and user data
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

    // Navigate to exam marks page
    await page.goto(
      "https://webportal.juit.ac.in:6011/studentportal/#/student/eventsubjectmarks",
      {
        waitUntil: "networkidle2",
      }
    );

    const timeBefore = Date.now();
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // First, get all semester codes by opening the modal once
    await page.waitForSelector("i.search.material-icons", {
      visible: true,
    });

    await page.evaluate(() => {
      const icon = document.querySelector(
        "i.search.material-icons"
      ) as HTMLElement;
      if (icon) icon.click();
    });

    await new Promise((resolve) => setTimeout(resolve, 1000));
    await page.waitForSelector(".ag-center-cols-container", { visible: true });

    // Extract semester codes from the grid
    const semesterCodes = await page.evaluate(() => {
      const cells = Array.from(
        document.querySelectorAll('[col-id="registrationdesc"]')
      );
      return cells.map((cell) => cell.textContent?.trim()).filter(Boolean);
    });

    console.log("Extracted Semester Codes:", semesterCodes);

    await new Promise((resolve) => setTimeout(resolve, 1000));

    const extractedExamsData = [];

    // Process each semester code
    for (let i = 0; i < semesterCodes.length; i++) {
      const semesterCode = semesterCodes[i];
      console.log(
        `Processing semester ${i + 1}/${semesterCodes.length}: ${semesterCode}`
      );

      // Reset result for this iteration
      result.localname = undefined;
      result.payload = undefined;

      // Reopen the modal before each semester selection
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // First, get all semester codes by opening the modal once
      await page.waitForSelector("i.search.material-icons", {
        visible: true,
      });

      await page.evaluate(() => {
        const icon = document.querySelector(
          "i.search.material-icons"
        ) as HTMLElement;
        if (icon) icon.click();
      });

      await page.waitForSelector(".ag-center-cols-container", {
        visible: true,
      });

      // Improved click logic for AG Grid rows
      const clickSuccess = await page.evaluate((code) => {
        // Find the row that contains the semester code
        const rows = Array.from(document.querySelectorAll(".ag-row"));

        for (const row of rows) {
          const cell = row.querySelector('[col-id="registrationdesc"]');
          if (cell && cell.textContent?.trim() === code) {
            // Try multiple click methods to ensure it works
            try {
              // Method 1: Direct click on the row
              (row as HTMLElement).click();

              // Method 2: If row click doesn't work, try cell click
              (cell as HTMLElement).click();

              // Method 3: Dispatch a click event
              const clickEvent = new MouseEvent("click", {
                bubbles: true,
                cancelable: true,
                view: window,
              });
              row.dispatchEvent(clickEvent);

              // Method 4: Try to trigger AG Grid selection
              const rowIndex = row.getAttribute("row-index");
              if (rowIndex) {
                // Add ag-row-selected class to simulate selection
                row.classList.add("ag-row-selected");
                row.classList.add("ag-row-focus");
              }

              console.log(`Successfully clicked on semester: ${code}`);
              return true;
            } catch (error) {
              console.error(`Failed to click on semester: ${code}`, error);
              return false;
            }
          }
        }

        console.error(`Semester row not found: ${code}`);
        return false;
      }, semesterCode);

      if (!clickSuccess) {
        console.warn(`Failed to click on semester: ${semesterCode}`);
        extractedExamsData.push({
          semesterCode,
          localname: result.localname,
          payload: result.payload,
          examData: null,
          error: "Failed to click on semester row",
        });
        continue;
      }
      try {
        // Wait for the request to complete or data to load
        for (let j = 0; j < 20; j++) {
          // Increased timeout
          if (result.localname && result.payload) break;
          await new Promise((resolve) => setTimeout(resolve, 500));
        }

        // Extract exam data from the page if available
        const examData = await page.evaluate(() => {
          // Look for exam data in various possible containers
          const possibleContainers = [
            ".ag-center-cols-container .ag-row",
            ".exam-data-container .row",
            ".marks-container .row",
            "table tbody tr",
            ".data-grid .row",
          ];

          for (const containerSelector of possibleContainers) {
            const examRows = Array.from(
              document.querySelectorAll(containerSelector)
            );

            if (examRows.length > 0) {
              return examRows.map((row) => {
                const cells = Array.from(
                  row.querySelectorAll(".ag-cell, td, .cell")
                );
                return {
                  subject: cells[0]?.textContent?.trim(),
                  examType: cells[1]?.textContent?.trim(),
                  maxMarks: cells[2]?.textContent?.trim(),
                  obtainedMarks: cells[3]?.textContent?.trim(),
                  grade: cells[4]?.textContent?.trim(),
                  // Add more fields as needed based on your table structure
                };
              });
            }
          }

          return []; // Return empty array if no data found
        });

        extractedExamsData.push({
          semesterCode,
          localname: result.localname,
          payload: result.payload,
        });

        // Store in Redis if payload exists
        if (semesterCode && result.payload) {
          await redis.hset(`exams`, semesterCode, result.payload);
        }

        console.log(`Successfully processed semester: ${semesterCode}`);
      } catch (error) {
        console.log(`Error processing semester: ${semesterCode}`, error);
        extractedExamsData.push({
          semesterCode,
          localname: result.localname,
          payload: result.payload,
          error: "Error processing semester data",
        });
      }
    }

    const timeAfter = Date.now();
    const duration = timeAfter - timeBefore;

    await redis.set("localname", result?.localname || "Unknown");
    res.status(200).json({
      message: "Exam data extraction complete for all semester codes",
      data: extractedExamsData,
      duration,
      allSemesterCodes: semesterCodes,
      totalSemestersProcessed: extractedExamsData.length,
    });
  } catch (error: any) {
    console.error("Exam extraction failed:", error);
    res.status(500).json({
      error: "Exam extraction failed",
      details: error.message,
    });
  } finally {
    if (browser) await browser.close();
  }
};

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
        await redis.hset(`attendance`, semesterCode, result.payload);
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

export const detailAttendence = async (req: Request, res: Response) => {
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

    await page.click('button[aria-label="Submit"]');
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Extract Overall LTP data after the table loads
    const overallLTPData = await page.evaluate(() => {
      const table = document.querySelector("#pn_id_1-table");
      if (!table) return [];

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

              await redis.hset(`Subject`, linkData.subjectCode, postData);
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
        }); ``

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
