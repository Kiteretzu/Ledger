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

app.use("/api/v1", router);

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
