import { login } from "@repo/puppeteer_utils/login";
import redis from "@repo/redis/main";
import axios from "axios";
import { Request, Response } from "express";
import { saveSubjectSemester } from "../helper/db_helper/saveSubjectSemester";
import { saveUserCredentials } from "../helper/db_helper/saveUserCredentials";

export const loginSimple = async (req: Request, res: Response) => {
  const { username, password } = req.body;

  try {
    const {
      isFailedCaptcha,
      captchaText,
      currentUrl,
      isLoginSuccessful,
      message,
      token,
    } = await login(username, password);

    console.log("this is the isFailedCaptcha", isFailedCaptcha);

    if (isFailedCaptcha) {
      return res.status(400).json({
        error: "Login failed due to captcha",
        message: "Please solve the captcha manually",
      });
    }

    void saveUserCredentials(username, password, token);

    res.status(200).json({
      message: isLoginSuccessful ? "Login successful" : "Login may have failed",
      currentUrl,
      token,
      isLoginSuccessful,
      captchaText,
    });
  } catch (error) {
    console.error("Login automation failed:", error);

    res.status(500).json({
      error: "Login automation failed",
      details: error.message,
    });
  }
};

// Controller to fetch attendance details from JUIT web portal
export const fetchAttendanceDetails = async (req: Request, res: Response) => {
  try {
    const token = req.query.token;
    const semester = req.query.semester as string;
    const username = req.query.username as string;

    const allPayloads = await redis.hgetall("attendance");

    const payload = allPayloads[semester];

    console.log("this is payload", payload);

    if (!payload) {
      return res.status(404).json({
        error: "Invalid semester index or payload not found",
      });
    }

    const localname = await redis.get("localname");

    const url =
      "https://webportal.juit.ac.in:6011/StudentPortalAPI/StudentClassAttendance/getstudentattendancedetail";

    const oldAuthorization = "Bearer " + token;

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

    void saveSubjectSemester(username, response.data, semester);

    res.status(200).json(response.data);
  } catch (error: any) {
    console.error("Failed to fetch attendance details:", error);
    res.status(500).json({
      error: "Failed to fetch attendance details",
      details: error.message || error.toString(),
    });
  }
};

export const fetchSubjectDetails = async (req: Request, res: Response) => {
  try {
    const token = req.query.token || req.headers.authorization;
    const subjectCode = req.query.subjectCode as string;

    if (!token) {
      return res.status(400).json({ error: "Missing token" });
    }

    if (!subjectCode) {
      return res.status(400).json({ error: "Missing subject code" });
    }

    // Get the payload for this semester from Redis hash "attendance"
    const allPayloads = await redis.hgetall("Subject");
    const payload = allPayloads[subjectCode];

    if (!payload) {
      return res.status(404).json({
        error: `Payload not found for the ${subjectCode}`,
      });
    }

    // Get LocalName from Redis
    const localname = await redis.get("localname");
    if (!localname) {
      return res.status(404).json({ error: "LocalName not found in Redis" });
    }

    const url =
      "https://webportal.juit.ac.in:6011/StudentPortalAPI/StudentClassAttendance/getstudentsubjectpersentage";

    const headers = {
      Accept: "application/json, text/plain, */*",
      "Accept-Encoding": "gzip, deflate, br, zstd",
      "Accept-Language": "en-US,en;q=0.5",
      Authorization: token.toString().startsWith("Bearer ")
        ? token
        : `Bearer ${token}`,
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

    const response = await axios.post(url, payload, { headers });

    if (!response.data) {
      return res.status(404).json({
        error: "No subject/attendance details found",
      });
    }

    return res.status(200).json({
      message: "Subject details fetched successfully",
      data: response.data,
    });
  } catch (error: any) {
    console.error("Error fetching subject details:", error.message);
    return res.status(500).json({
      error: "Failed to fetch subject details",
      details: error.response?.data || error.message,
    });
  }
};
