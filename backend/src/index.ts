import dotenv from "dotenv";
import express from "express";
import {
  extractPayloadAndLocalname,
  fetchAttendanceDetails,
  loginSimple,
} from "./controllers/controller";
import "./redis";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.post("/login", loginSimple);
app.get("/getAttendanceDetails", fetchAttendanceDetails);
app.get("/worker", extractPayloadAndLocalname);

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
