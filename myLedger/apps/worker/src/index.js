import { Worker } from "bullmq";
import dotenv from "dotenv";

dotenv.config();

const connection = {
    url: process.env.REDIS_URL || "redis://127.0.0.1:6379",
};

const worker = new Worker(
    "subject-processing",
    async (job) => {
        console.log(`Processing job ${job.id}...`);
        const user = job.data; // now single user

        console.log(`Processing user: ${user.username}`);
        // Simulate processing
        await new Promise((resolve) => setTimeout(resolve, 1000));

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