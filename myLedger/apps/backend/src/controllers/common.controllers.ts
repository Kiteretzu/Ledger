import axios from "axios";
import { Request, Response } from "express";
import redis from "@repo/redis/main"; // adjust the import if needed
import saveStudentData from "../helper/db_helper/saveStudentData";
import { saveExamsCodes } from "../helper/db_helper/saveExamsCodes";
import { fetchDbExamCodes } from "../helper/db_helper/dbFetcher/fetchExamCodes";
import { saveAttendanceCode } from "../helper/db_helper/saveAttendenceCode";
import { fetchAttendenceCode } from "../helper/db_helper/dbFetcher/fetchAttendenceCodes";
import { fetchProfile } from "../helper/db_helper/dbFetcher/fetchProfile";

export const fetchStudentPersonalInfo = async (req: Request, res: Response) => {
  try {
    const token = req.query.token || req.headers.authorization;

    if (!token) {
      return res.status(400).json({
        error: "Missing token",
      });
    }

    // Fetch localname from Redis
    const localname = await redis.get("localname");

    if (!localname) {
      return res.status(404).json({
        error: "Localname not found in Redis",
      });
    }

    console.log("this is localName", localname);
    // Hardcoded instituteid
    const instituteid = "INID2201J000001";

    const url =
      "https://webportal.juit.ac.in:6011/StudentPortalAPI/studentpersinfo/getstudent-personalinformation";

    const headers = {
      Accept: "application/json, text/plain, */*",
      "Content-Type": "application/json",
      Authorization: token.toString().startsWith("Bearer ")
        ? token
        : `Bearer ${token}`,
      LocalName: localname,
      Origin: "https://webportal.juit.ac.in:6011",
      Referer: "https://webportal.juit.ac.in:6011/studentportal/",
    };

    const payload = {
      instituteid,
    };

    const juitResponse = await axios.post(url, payload, { headers });

    void saveStudentData(
      juitResponse.data.response.generalinformation.registrationno,
      juitResponse.data.response
    );

    return res.status(200).json({
      message: "Student info fetched successfully",
      data: juitResponse.data,
    });
  } catch (error: any) {
    console.error("Error fetching student info:", error.message);
    const response = await fetchProfile(req.query.username as string);
    if (response) {
      return res.status(200).json({
        message:
          "Student personal information fetched from database successfully",
        data: response,
      });
    }
    return res.status(500).json({
      error: "Failed to fetch student personal information",
      details: error.response?.data || error.message,
    });
  }
};

export const fetchAttenceCode = async (req: Request, res: Response) => {
  try {
    const token = req.query.token || req.headers.authorization;
    const username = req.query.username as string;

    if (!token) {
      return res.status(400).json({
        error: "Missing token",
      });
    }

    // Fetch localname from Redis
    const localname = await redis.get("localname");

    if (!localname) {
      return res.status(404).json({
        error: "Localname not found in Redis",
      });
    }

    const url =
      "https://webportal.juit.ac.in:6011/StudentPortalAPI/StudentClassAttendance/getstudentInforegistrationforattendence";

    const headers = {
      Accept: "application/json, text/plain, */*",
      "Content-Type": "application/json",
      Authorization: token.toString().startsWith("Bearer ")
        ? token
        : `Bearer ${token}`,
      LocalName: localname,
      Origin: "https://webportal.juit.ac.in:6011",
      Referer: "https://webportal.juit.ac.in:6011/studentportal/",
    };

    const payload = {
      instituteid: "INID2201J000001",
    };

    const juitResponse = await axios.post(url, payload, { headers });

    void saveAttendanceCode(username, juitResponse.data);

    return res.status(200).json({
      message: "Student registration info for attendance fetched successfully",
      data: juitResponse.data,
    });
  } catch (error: any) {
    console.error("Error fetching student registration info:", error.message);
    const semlist = await fetchAttendenceCode(req.query.username as string);
    if (semlist) {
      return res.status(200).json({
        message: "Attendance codes fetched from database successfully",
        semlist,
      });
    }

    return res.status(500).json({
      error: "Failed to fetch student registration information",
      details: error.response?.data || error.message,
    });
  }
};

export const fetchExamCode = async (req: Request, res: Response) => {
  try {
    const token = req.query.token || req.headers.authorization;
    const username = req.query.username as string;
    if (!username || typeof username !== "string") {
      return res.status(400).json({
        error: "Invalid or missing username",
      });
    }

    if (!token) {
      return res.status(400).json({
        error: "Missing token",
      });
    }

    // Fetch localname from Redis
    const localname = await redis.get("localname");
    const payload = await redis.get("payload");

    if (!localname) {
      return res.status(404).json({
        error: "Localname not found in Redis",
      });
    }

    const url =
      "https://webportal.juit.ac.in:6011/StudentPortalAPI/studentcommonsontroller/getsemestercode-exammarks";

    const headers = {
      Accept: "application/json, text/plain, */*",
      "Content-Type": "application/json",
      Authorization: token.toString().startsWith("Bearer ")
        ? token
        : `Bearer ${token}`,
      LocalName: localname,
      Origin: "https://webportal.juit.ac.in:6011",
      Referer: "https://webportal.juit.ac.in:6011/studentportal/",
    };

    const juitResponse = await axios.post(url, payload, {
      headers,
    });

    await saveExamsCodes(username, juitResponse.data);

    return res.status(200).json({
      message: "Exam codes fetched successfully",
      data: juitResponse.data,
    });
  } catch (error: any) {
    console.error("Error fetching exam codes:", error.message);
    console.log("Trying alternativeDb");
    const semestercode = await fetchDbExamCodes(req.query.username as string);

    if (semestercode) {
      return res.status(200).json({
        message: "Exam codes fetched from database successfully",
        semestercode,
      });
    }

    return res.status(500).json({
      error: "Failed to fetch exam codes",
      details: error.response?.data || error.message,
    });
  }
};
