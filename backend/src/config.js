import dotenv from "dotenv";
dotenv.config();

export const config = {
  port: process.env.PORT || 3001,
  workerCount: parseInt(process.env.WORKER_COUNT || 4),
  maxRetries: 3,
  rateLimitPerMinute: 10,
  db: {
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "taskuser",
    password: process.env.DB_PASSWORD || "taskpassword",
    database: process.env.DB_NAME || "taskengine",
    port: process.env.DB_PORT || 3307
  }
};