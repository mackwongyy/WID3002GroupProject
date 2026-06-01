import { Router } from "express";
import { SentimentLabel, TicketStatus, UrgencyLevel, UserRole } from "@prisma/client";
import { z } from "zod";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import * as adminService from "./admin.service.js";

export const adminRouter = Router();

adminRouter.use(requireAuth, requireRole(UserRole.ADMIN));

adminRouter.get("/summary", async (_req, res, next) => {
  try {
    res.json(await adminService.getSummary());
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/users", async (_req, res, next) => {
  try {
    res.json({ users: await adminService.getUsers() });
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/tickets", async (req, res, next) => {
  try {
    const filters = {
      userId: typeof req.query.user_id === "string" ? req.query.user_id : undefined,
      status: typeof req.query.status === "string" ? (req.query.status as TicketStatus) : undefined,
      department: typeof req.query.department === "string" ? req.query.department : undefined,
      urgency: typeof req.query.urgency === "string" ? (req.query.urgency as UrgencyLevel) : undefined
    };
    res.json({ tickets: await adminService.listTickets(filters) });
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/users/:userId/analytics", async (req, res, next) => {
  try {
    res.json(await adminService.getUserAnalytics(req.params.userId));
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/tickets/:ticketId/history", async (req, res, next) => {
  try {
    res.json({ ticket: await adminService.getTicketHistory(req.params.ticketId) });
  } catch (error) {
    next(error);
  }
});

const ValidationSchema = z.object({
  corrected_category: z.string().min(1).optional(),
  corrected_urgency: z.nativeEnum(UrgencyLevel).optional(),
  corrected_sentiment: z.nativeEnum(SentimentLabel).optional(),
  corrected_department: z.string().min(1).optional(),
  notes: z.string().max(2000).optional()
});

adminRouter.patch("/interactions/:interactionId/validate", async (req, res, next) => {
  try {
    const input = ValidationSchema.parse(req.body);
    const validation = await adminService.validateInteraction(req.user!.id, req.params.interactionId, input);
    res.status(200).json(validation);
  } catch (error) {
    next(error);
  }
});

adminRouter.post("/interactions/:interactionId/reanalyse", async (req, res, next) => {
  try {
    const result = await adminService.retryAnalysis(req.params.interactionId);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});
