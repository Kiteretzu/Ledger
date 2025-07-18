import dotenv from "dotenv";
import express from "express";
import { fetchAttendanceDetails, loginSimple } from "./controllers/controller";
import {
  detailAttendence,
  extractAttendenceData,
  extractExamsData,
} from "./controllers/worker.controller";
import "./redis";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.post("/login", loginSimple);
app.get("/getAttendanceDetails", fetchAttendanceDetails);
app.get("/getexamsDetails", fetchAttendanceDetails); // Assuming exams details are fetched similarly
app.get("/worker", extractAttendenceData);
app.get("/worker2", extractExamsData);
app.get("/detailAttendence", detailAttendence);

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
