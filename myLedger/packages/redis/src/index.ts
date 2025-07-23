import Redis from "ioredis";
import dotenv from "dotenv";
dotenv.config();
import { Queue } from "bullmq";

console.log("Redis", process.env.REDIS_URL);
export const subjectQueue = new Queue("subject-processing", {
  connection: {
    url: process.env.REDIS_URL || "redis://127.0.0.1:6379",
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 1000,
    },
    removeOnComplete: true,
  },
});

const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

redis.on("connect", () => {
  console.log("🔌 Connected to Redis");
});

redis.on("error", (err) => {
  console.error("❌ Redis error:", err);
});

export default redis;
