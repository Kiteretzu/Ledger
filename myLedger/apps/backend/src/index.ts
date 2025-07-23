import dotenv from "dotenv";
import express from "express";
import {
  fetchAttenceCode,
  fetchExamCode,
  fetchStudentPersonalInfo,
} from "./controllers/common.controllers";
import {
  fetchAttendanceDetails,
  fetchSubjectDetails,
  loginSimple
} from "./controllers/controller";
import {
  detailAttendenceOfSubject,
  extractAttendenceData,
  getAllPossibleSubjectCodes
} from "./controllers/worker.controller";
import { fetchDbExamCodes } from "./helper/db_helper/dbFetcher/fetchExamCodes";
// import "@repo/redis/main";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.post("/login", loginSimple);
app.get("/worker", extractAttendenceData);
app.get("/getAttendanceDetails", fetchAttendanceDetails);
app.get("/detailAttendence", detailAttendenceOfSubject);
app.get("/getProfile", fetchStudentPersonalInfo);
app.get("/getAttendanceCode", fetchAttenceCode);
app.get("/getExamsCode", fetchExamCode);
app.get("/getSubjectDetails", fetchSubjectDetails); // Assuming this is for subjects

app.get("/speedTest-fetchExamCodes", (req, res) => {
  const username = req.query.username as string;
  if (!username) {
    return res.status(400).json({ error: "Username is required" });
  }
  fetchDbExamCodes(username)
    .then((semestercode) => {
      if (!semestercode) {
        return res
          .status(404)
          .json({ error: "No exam codes found for this user" });
      }
      res.status(200).json({ semestercode });
    })
    .catch((error) => {
      console.error("Error fetching exam codes:", error);
      res.status(500).json({ error: "Failed to fetch exam codes" });
    });
});

app.get("/worker3", getAllPossibleSubjectCodes);

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
