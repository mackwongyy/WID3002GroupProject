import { Router } from "express";
import { z } from "zod";
import { UserRole } from "@prisma/client";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import * as ticketService from "./ticket.service.js";

export const ticketRouter = Router();

ticketRouter.use(requireAuth, requireRole(UserRole.CUSTOMER));

const CreateTicketSchema = z.object({ ticket_name: z.string().min(1).max(120) });
const RenameTicketSchema = z.object({ ticket_name: z.string().min(1).max(120) });
const ReorderSchema = z.object({ ordered_ticket_ids: z.array(z.string().uuid()).min(1) });
const MessageSchema = z.object({ text: z.string().min(1).max(5000) });

ticketRouter.get("/tickets", async (req, res, next) => {
  try {
    const tickets = await ticketService.listTickets(req.user!.id);
    res.json({ tickets });
  } catch (error) {
    next(error);
  }
});

ticketRouter.post("/tickets", async (req, res, next) => {
  try {
    const input = CreateTicketSchema.parse(req.body);
    const ticket = await ticketService.createTicket(req.user!.id, input.ticket_name);
    res.status(201).json({ ticket });
  } catch (error) {
    next(error);
  }
});

ticketRouter.patch("/tickets/reorder", async (req, res, next) => {
  try {
    const input = ReorderSchema.parse(req.body);
    const tickets = await ticketService.reorderTickets(req.user!.id, input.ordered_ticket_ids);
    res.json({ tickets });
  } catch (error) {
    next(error);
  }
});

ticketRouter.get("/tickets/:ticketId", async (req, res, next) => {
  try {
    const ticket = await ticketService.getTicket(req.user!.id, req.params.ticketId);
    res.json({ ticket });
  } catch (error) {
    next(error);
  }
});

ticketRouter.patch("/tickets/:ticketId", async (req, res, next) => {
  try {
    const input = RenameTicketSchema.parse(req.body);
    const ticket = await ticketService.renameTicket(req.user!.id, req.params.ticketId, input.ticket_name);
    res.json({ ticket });
  } catch (error) {
    next(error);
  }
});

ticketRouter.delete("/tickets/:ticketId", async (req, res, next) => {
  try {
    await ticketService.softDeleteTicket(req.user!.id, req.params.ticketId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

ticketRouter.get("/tickets/:ticketId/messages", async (req, res, next) => {
  try {
    const interactions = await ticketService.listInteractions(req.user!.id, req.params.ticketId);
    res.json({ interactions });
  } catch (error) {
    next(error);
  }
});

ticketRouter.post("/tickets/:ticketId/messages", async (req, res, next) => {
  try {
    const input = MessageSchema.parse(req.body);
    const interaction = await ticketService.addMessage(req.user!.id, req.params.ticketId, input.text);
    res.status(201).json({ interaction });
  } catch (error) {
    next(error);
  }
});

ticketRouter.post("/tickets/:ticketId/submit", async (req, res, next) => {
  try {
    const ticket = await ticketService.submitTicket(req.user!.id, req.params.ticketId);
    res.json({ ticket });
  } catch (error) {
    next(error);
  }
});
