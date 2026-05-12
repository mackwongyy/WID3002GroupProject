import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import { env } from "./config/env.js";
import { prisma } from "./db/prisma.js";
import { errorHandler } from "./middleware/error.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { ticketRouter } from "./modules/tickets/ticket.routes.js";
import { adminRouter } from "./modules/admin/admin.routes.js";

const app = express();

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
