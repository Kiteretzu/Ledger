import puppeteer from "puppeteer";
import { setHashWithMidnightExpiry } from "@repo/redis/redis-expiration"; // adjust the path

export async function subjectsOfSemcode(token: string, semesterCode: string) {
  let browser: puppeteer.Browser | null = null;

  const result: {
    localname?: string;
    payload?: string;
    overallLTP?: any[];
    clickedLinks?: any[];
    allPagesData?: any[];
  } = {};

  try {
    browser = await puppeteer.launch({
      headless: false, // set to false for debugging, true for production
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

    // Inject localStorage/sessionStorage data
    await page.goto("https://webportal.juit.ac.in:6011/studentportal/#/", {
      waitUntil: "networkidle2",
      timeout: 60000, // 60 seconds instead of 30 seconds
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

    // Go to attendance page
    await page.goto(
      "https://webportal.juit.ac.in:6011/studentportal/#/student/myclassattendance",
      { waitUntil: "networkidle2" }
    );


    console.log('this is semesterCode', semesterCode);  

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
    }, semesterCode);

    await page.click('button[aria-label="Submit"]');
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await page.waitForSelector("p-table table tbody tr", {
      visible: true,
      timeout: 5000,
    });

    // Helper function to extract data from current page
    const extractCurrentPageData = async (pageNumber: number) => {
      return await page.evaluate((pageNum) => {
        const table = document.querySelector("p-table table");
        if (!table) return [];

        const rows = table.querySelectorAll("tbody tr");
        const data: any[] = [];

        rows.forEach((row, index) => {
          const cells = row.querySelectorAll("td");
          if (cells.length >= 6) {
            const slNo = cells[0].textContent?.trim();
            const subjectCode = cells[1].textContent?.trim();
            const subjectName = cells[2].textContent?.trim();
            const facultyName = cells[3].textContent?.trim();
            const theoryLab = cells[4].textContent?.trim();
            const overallLTPCell = cells[5]; // 6th column (index 5) is Overall LTP(%)
            const overallLTPLink = overallLTPCell.querySelector("a.mylink");

            data.push({
              pageNumber: pageNum,
              slNo: slNo,
              subjectCode: subjectCode,
              subjectName: subjectName,
              facultyName: facultyName,
              theoryLab: theoryLab,
              overallLTP:
                overallLTPLink?.textContent?.trim() ||
                overallLTPCell.textContent?.trim(),
              hasLink: !!overallLTPLink,
              rowIndex: index,
              globalIndex: (pageNum - 1) * 10 + index, // Assuming 10 rows per page
            });
          }
        });

        return data;
      }, pageNumber);
    };

    // Helper function to click links on current page
    const clickLinksOnCurrentPage = async (
      pageData: any[],
      pageNumber: number
    ) => {
      const clickedLinksData = [];
      const linksToClick = pageData.filter((item) => item.hasLink);

      console.log(
        `Page ${pageNumber}: Found ${linksToClick.length} links to click`
      );

      for (let i = 0; i < linksToClick.length; i++) {
        const linkData = linksToClick[i];
        let currentPayload: string | null = null;

        const requestListener = async (request: puppeteer.HTTPRequest) => {
          try {
            if (
              targetUrlKeywords.some((keyword) =>
                request.url().includes(keyword)
              )
            ) {
              const postData = request.postData();
              if (postData) {
                currentPayload = postData;
                console.log(
                  `Page ${pageNumber} - Captured payload for ${linkData.subjectCode}:`,
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
            `Page ${pageNumber} - Clicking link ${i + 1}/${linksToClick.length} for subject: ${linkData.subjectCode}`
          );

          const clickResult = await page.evaluate((rowIndex) => {
            const table = document.querySelector("p-table table");
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

          clickedLinksData.push({
            ...linkData,
            clickResult,
            clickedAt: new Date().toISOString(),
            capturedPayload: currentPayload,
          });

          console.log(
            `Page ${pageNumber} - Click result for ${linkData.subjectCode}:`,
            clickResult
          );

          await new Promise((resolve) => setTimeout(resolve, 500));
          if (i < linksToClick.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        } catch (error: any) {
          console.error(
            `Page ${pageNumber} - Error clicking link for ${linkData.subjectCode}:`,
            error
          );
          clickedLinksData.push({
            ...linkData,
            clickResult: { success: false, error: error.message },
            clickedAt: new Date().toISOString(),
            capturedPayload: null,
          });
        } finally {
          page.off("request", requestListener);
        }
      }

      return clickedLinksData;
    };

    // Helper function to navigate to a specific page
    const navigateToPage = async (targetPage: number) => {
      try {
        // Check if pagination exists
        const paginationExists = await page.evaluate(() => {
          return !!document.querySelector(".p-paginator");
        });

        if (!paginationExists) {
          console.log("No pagination found, assuming single page");
          return true;
        }

        // Try to find and click the target page number
        const pageClicked = await page.evaluate((pageNum) => {
          const pageButtons = Array.from(
            document.querySelectorAll(".p-paginator-page")
          );
          const targetButton = pageButtons.find(
            (btn) => btn.textContent?.trim() === pageNum.toString()
          );

          if (
            targetButton &&
            !targetButton.classList.contains("p-paginator-page-selected")
          ) {
            (targetButton as HTMLElement).click();
            return true;
          }
          return false;
        }, targetPage);

        if (pageClicked) {
          // Wait for the page to load
          await page.waitForSelector("p-table table tbody tr", {
            visible: true,
            timeout: 5000,
          });
          await new Promise((resolve) => setTimeout(resolve, 1000));
          return true;
        }

        return false;
      } catch (error) {
        console.error(`Error navigating to page ${targetPage}:`, error);
        return false;
      }
    };

    // Main processing logic
    console.log("Starting multi-page processing...");

    // First, extract data from page 1 to get total count
    const firstPageData = await extractCurrentPageData(1);
    result.allPagesData = [...firstPageData];

    // Determine total pages (assuming 10 items per page)
    const totalItems = firstPageData.length;
    let totalPages = 1;

    // Check if there are more pages by looking for pagination
    const hasPagination = await page.evaluate(() => {
      const paginator = document.querySelector(".p-paginator");
      if (!paginator) return false;

      const pageButtons = paginator.querySelectorAll(".p-paginator-page");
      return pageButtons.length > 1;
    });

    if (hasPagination) {
      // Get total pages from pagination
      totalPages = await page.evaluate(() => {
        const pageButtons = Array.from(
          document.querySelectorAll(".p-paginator-page")
        );
        const pageNumbers = pageButtons
          .map((btn) => parseInt(btn.textContent?.trim() || "0"))
          .filter((num) => !isNaN(num) && num > 0);
        return Math.max(...pageNumbers, 1);
      });
      console.log(`Found ${totalPages} total pages`);
    }

    // Process page 1 links
    const page1ClickedLinks = await clickLinksOnCurrentPage(firstPageData, 1);
    result.clickedLinks = [...page1ClickedLinks];

    // Process remaining pages if they exist
    for (let pageNum = 2; pageNum <= totalPages; pageNum++) {
      console.log(`Processing page ${pageNum}/${totalPages}...`);

      const navigated = await navigateToPage(pageNum);
      if (!navigated) {
        console.log(
          `Could not navigate to page ${pageNum}, stopping pagination`
        );
        break;
      }

      const currentPageData = await extractCurrentPageData(pageNum);
      result.allPagesData = [
        ...(result.allPagesData || []),
        ...currentPageData,
      ];

      const currentPageClickedLinks = await clickLinksOnCurrentPage(
        currentPageData,
        pageNum
      );
      result.clickedLinks = [
        ...(result.clickedLinks || []),
        ...currentPageClickedLinks,
      ];

      // Small delay between pages
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    // Set overall LTP data to all pages data
    result.overallLTP = result.allPagesData;

    console.log("Multi-page processing complete. Summary:", {
      totalPages: totalPages,
      totalSubjects: result.allPagesData?.length || 0,
      totalLinks: result.clickedLinks?.length || 0,
      successfulClicks:
        result.clickedLinks?.filter((item) => item.clickResult?.success)
          .length || 0,
    });

    // Additional wait to allow for any final network requests
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Return the result instead of res.json
    return {
      message:
        "Multi-page detailed attendance extraction complete with link clicking",
      data: {
        localname: result.localname,
        payload: result.payload,
        clickedLinks: result.clickedLinks,
        allPagesData: result.allPagesData,
        summary: {
          totalPages: totalPages,
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
          pageBreakdown:
            result.allPagesData?.reduce((acc: any, item: any) => {
              const page = item.pageNumber;
              if (!acc[`page${page}`]) {
                acc[`page${page}`] = { subjects: 0, linksClicked: 0 };
              }
              acc[`page${page}`].subjects++;
              if (item.hasLink) {
                acc[`page${page}`].linksClicked++;
              }
              return acc;
            }, {}) || {},
        },
      },
    };
  } catch (error: any) {
    throw new Error(`Extraction failed: ${error.message}`);
  } finally {
    if (browser) await browser.close();
  }
}
