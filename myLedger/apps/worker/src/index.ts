import { Queue, Worker } from "bullmq";
import dotenv from "dotenv";
// import { subjectsOfSemcode } from "./helper/subjectsOfSemcode";
// import { getAllAttendenceCodes } from "./helper/getAllAttendenceCodes";
import { subjectQueue } from "@repo/redis/main";
import { getAllAttendenceCodes } from "./helper/getAllAttendenceCodes";
import { subjectsOfSemcode } from "./helper/subjectsOfSemcode";

dotenv.config();

const connection = {
  url: process.env.REDIS_URL || "redis://127.0.0.1:6379",
};

console.log("this is redisURL", process.env.REDIS_URL, connection);

const worker = new Worker(
  "subject-processing",
  async (job) => {
    console.log("Received job data", job.data);
    console.log(`Processing job ${job.id}...`);
    const user = job.data; // now single user

    console.log(
      `Processing user: ${user.token} with semCode: ${user.semesterLabel}`
    );

    try {
      if (user.type === "attendanceCode") {
        // If type is attendanceCode, process all semesters
        getAllAttendenceCodes(user.token, user.semesters);
      } else if (user.semesters && user.semesters.length > 0) {
        await Promise.all(
          user.semesters.map((sem: string) =>
            subjectsOfSemcode(user.token, sem)
          )
        );
      } else {
        await subjectsOfSemcode(user.token, user.semesterLabel);
      }

      console.log("✅ Stored in Redis successfully");
    } catch (err) {
      console.error("Error in subjectsOfSemcode:", err);
      throw err; // triggers retry
    }

    return { status: "done", user: user.username };
  },
  {
    connection,
    concurrency: 1, // ensures one-by-one processing
  }
);

// Worker events
worker.on("ready", async () => {
  await subjectQueue.drain(true); // true = remove active jobs too
  await subjectQueue.clean(0, 0, "completed");
  await subjectQueue.clean(0, 0, "failed");
  await subjectQueue.clean(0, 0, "delayed");
  await subjectQueue.clean(0, 0, "wait");
  await subjectQueue.clean(0, 0, "active");
});

worker.on("active", (job) => {
  console.log(`Job ${job.id} is now active`);
});

worker.on("completed", (job) => {
  console.log(`Job ${job.id} completed`);
});

worker.on("failed", (job, err) => {
  console.error(`Job ${job?.id} failed with error:`, err);
});

worker.on("stalled", (job) => {
  console.warn(`Job ${job.id} has stalled`);
});

worker.on("paused", () => {
  console.log("Worker has been paused");
});

worker.on("error", (err) => console.error("Worker error", err));
