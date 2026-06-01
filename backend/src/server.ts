import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import { env } from "./config/env.js";
import { prisma } from "./db/prisma.js";
import { errorHandler } from "./middleware/error.js";
import { requestId } from "./middleware/requestId.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { ticketRouter } from "./modules/tickets/ticket.routes.js";
import { adminRouter } from "./modules/admin/admin.routes.js";

const app = express();

app.use(requestId);
app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    limit: 120,
    standardHeaders: "draft-7",
    legacyHeaders: false
  })
);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "backend" });
});

app.get("/api/health", async (_req, res) => {
  const startedAt = Date.now();
  const checks: Record<string, { status: "ok" | "error"; latency_ms?: number; error?: string }> = {};

  const dbStartedAt = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = { status: "ok", latency_ms: Date.now() - dbStartedAt };
  } catch (error) {
    checks.database = {
      status: "error",
      latency_ms: Date.now() - dbStartedAt,
      error: error instanceof Error ? error.message : "Unknown database error"
    };
  }

  const nlpStartedAt = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const response = await fetch(`${env.NLP_SERVICE_URL}/health`, { signal: controller.signal });
    clearTimeout(timeout);

    checks.nlp_service = {
      status: response.ok ? "ok" : "error",
      latency_ms: Date.now() - nlpStartedAt,
      ...(response.ok ? {} : { error: `NLP service returned HTTP ${response.status}` })
    };
  } catch (error) {
    checks.nlp_service = {
      status: "error",
      latency_ms: Date.now() - nlpStartedAt,
      error: error instanceof Error ? error.message : "Unknown NLP service error"
    };
  }

  const healthy = Object.values(checks).every((check) => check.status === "ok");
  res.status(healthy ? 200 : 503).json({
    status: healthy ? "ok" : "degraded",
    service: "backend",
    uptime_seconds: Math.round(process.uptime()),
    latency_ms: Date.now() - startedAt,
    checks
  });
});

app.use("/api/auth", authRouter);
app.use("/api/customer", ticketRouter);
app.use("/api/admin", adminRouter);

app.use(errorHandler);

const server = app.listen(env.PORT, () => {
  console.log(`Backend API listening on port ${env.PORT}`);
});

async function shutdown() {
  console.log("Shutting down backend...");
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
