import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const EnvSchema = z.object({
  NODE_ENV: z.string().default("development"),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16, "JWT_SECRET should be at least 16 characters."),
  JWT_EXPIRES_IN: z.string().default("7d"),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  NLP_SERVICE_URL: z.string().url().default("http://localhost:8000"),
  NLP_TIMEOUT_MS: z.coerce.number().int().positive().default(15000)
});

export const env = EnvSchema.parse(process.env);
