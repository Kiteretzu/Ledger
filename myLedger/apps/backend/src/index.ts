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
import redis from "@repo/redis/main";
// import "@repo/redis/main";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK" });
});

app.get("/get-redis", async (req, res) => {
  const allPayloads = await redis.hgetall("Subject");

  if (!allPayloads) {
    return res.status(404).json({ error: "No data found in Redis" });
  }

  res.status(200).json(allPayloads);
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
