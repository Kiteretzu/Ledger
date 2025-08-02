import { Queue, Worker } from "bullmq";
import dotenv from "dotenv";
import {
  subjectsOfSemcode
} from "./helper/subjectsOfSemcode";

dotenv.config();

const connection = {
  url: process.env.REDIS_URL || "redis://127.0.0.1:6379",
};

const queue = new Queue("subject-processing", { connection });

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
 
      await subjectsOfSemcode(user.token, user.semesterLabel);
      console.log("✅Stored in Redis successfully");
    } catch (err) {
      console.error("Error in subjectsOfSemcode:", err);
      throw err; // triggers retry based on job options (attempts/backoff)
    }

    return { status: "done", user: user.username };
  },
  {
    connection,
    concurrency: 1, // ensures one-by-one processing
  }
);

// Worker events
worker.on("ready", () => {
  console.log(`Worker is ready to process jobs`);
});

worker.on("completed", (job) => {
  console.log(`Job ${job.id} completed`);
});

worker.on("failed", (job, err) => {
  console.error(`Job ${job?.id} failed with error:`, err);
});
