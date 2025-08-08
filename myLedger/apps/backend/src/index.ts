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
  loginSimple,
} from "./controllers/controller";
import {
  getAllpossibleAttendCodes,
  getAllPossibleSubjectCodes,
} from "./controllers/worker.controller";
import router from "./router";
// import "@repo/redis/main";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK" });
});
app.post("/login", loginSimple);
app.get("/getAttendanceDetails", fetchAttendanceDetails);
app.get("/getProfile", fetchStudentPersonalInfo);
app.get("/getAttendanceCode", fetchAttenceCode);
app.get("/getExamsCode", fetchExamCode);
app.get("/getSubjectDetails", fetchSubjectDetails); // Assuming this is for subjects
app.get("/worker3", getAllPossibleSubjectCodes);
app.get("/worker2", getAllpossibleAttendCodes);

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
