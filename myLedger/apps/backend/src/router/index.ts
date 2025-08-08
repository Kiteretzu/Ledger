import { Router } from "express";
import {
  fetchAttenceCode,
  fetchExamCode,
  fetchStudentPersonalInfo,
} from "../controllers/common.controllers";
import {
  loginSimple,
  fetchAttendanceDetails,
  fetchSubjectDetails,
} from "../controllers/controller";
import {
  getAllPossibleSubjectCodes,
  getAllpossibleAttendCodes,
} from "../controllers/worker.controller";

const router = Router();

router.get("/health", (req, res) => {
  res.status(200).json({ status: "OK" });
});
router.post("/login", loginSimple);
router.get("/getAttendanceDetails", fetchAttendanceDetails);
router.get("/getProfile", fetchStudentPersonalInfo);
router.get("/getAttendanceCode", fetchAttenceCode);
router.get("/getExamsCode", fetchExamCode);
router.get("/getSubjectDetails", fetchSubjectDetails); // Assuming this is for subjects
router.get("/worker3", getAllPossibleSubjectCodes);
router.get("/worker2", getAllpossibleAttendCodes);
export default router;
