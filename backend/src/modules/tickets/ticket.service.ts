import { randomUUID } from "node:crypto";
import { Prisma, SentimentLabel, TicketStatus, UrgencyLevel } from "@prisma/client";
import { prisma } from "../../db/prisma.js";
import { HttpError } from "../../utils/http.js";
import { analyseText } from "../nlp/nlp.client.js";

function toUrgencyEnum(value: string): UrgencyLevel {
  const normalized = value.toUpperCase();
  if (normalized === "HIGH") return UrgencyLevel.HIGH;
  if (normalized === "MEDIUM") return UrgencyLevel.MEDIUM;
  return UrgencyLevel.LOW;
}

function toSentimentEnum(value: string): SentimentLabel {
  const normalized = value.toUpperCase();
  if (normalized === "POSITIVE") return SentimentLabel.POSITIVE;
  if (normalized === "NEGATIVE") return SentimentLabel.NEGATIVE;
  return SentimentLabel.NEUTRAL;
}

async function generateDisplayId() {
  const year = new Date().getFullYear();
  const count = await prisma.ticket.count();
  return `TCK-${year}-${String(count + 1).padStart(5, "0")}`;
}

async function assertOwnTicket(ticketId: string, userId: string) {
  const ticket = await prisma.ticket.findFirst({
    where: { id: ticketId, userId, deletedAt: null }
  });

  if (!ticket) {
    throw new HttpError(404, "TICKET_NOT_FOUND", "Ticket was not found.");
  }

  return ticket;
}

export async function listTickets(userId: string) {
  return prisma.ticket.findMany({
    where: { userId, deletedAt: null },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    include: {
      _count: {
        select: { interactions: true }
      }
    }
  });
}

export async function createTicket(userId: string, ticketName: string) {
  const maxSort = await prisma.ticket.aggregate({
    where: { userId, deletedAt: null },
    _max: { sortOrder: true }
  });

  return prisma.ticket.create({
    data: {
      userId,
      displayId: await generateDisplayId(),
      ticketName,
      sortOrder: (maxSort._max.sortOrder ?? 0) + 1
    }
  });
}

export async function getTicket(userId: string, ticketId: string) {
  return assertOwnTicket(ticketId, userId);
}

export async function renameTicket(userId: string, ticketId: string, ticketName: string) {
  await assertOwnTicket(ticketId, userId);
  return prisma.ticket.update({
    where: { id: ticketId },
    data: { ticketName }
  });
}

export async function reorderTickets(userId: string, orderedTicketIds: string[]) {
  const tickets = await prisma.ticket.findMany({
    where: { userId, id: { in: orderedTicketIds }, deletedAt: null },
    select: { id: true }
  });

  if (tickets.length !== orderedTicketIds.length) {
    throw new HttpError(400, "INVALID_TICKET_ORDER", "One or more tickets do not belong to this user.");
  }

  await prisma.$transaction(
    orderedTicketIds.map((id, index) =>
      prisma.ticket.update({
        where: { id },
        data: { sortOrder: index + 1 }
      })
    )
  );

  return listTickets(userId);
}

export async function softDeleteTicket(userId: string, ticketId: string) {
  await assertOwnTicket(ticketId, userId);
  return prisma.ticket.update({
    where: { id: ticketId },
    data: { deletedAt: new Date() }
  });
}

export async function listInteractions(userId: string, ticketId: string) {
  await assertOwnTicket(ticketId, userId);
  return prisma.ticketInteraction.findMany({
    where: { ticketId },
    orderBy: { stepNumber: "asc" },
    include: {
      validations: {
        orderBy: { validatedAt: "desc" },
        take: 1
      }
    }
  });
}

export async function addMessage(userId: string, ticketId: string, text: string) {
  const ticket = await assertOwnTicket(ticketId, userId);
  if (ticket.status !== TicketStatus.IN_PROGRESS) {
    throw new HttpError(409, "TICKET_ALREADY_SUBMITTED", "This ticket has already been submitted and can no longer receive messages.");
  }

  const interactionId = randomUUID();
  const latest = await prisma.ticketInteraction.aggregate({
    where: { ticketId },
    _max: { stepNumber: true }
  });
  const stepNumber = (latest._max.stepNumber ?? 0) + 1;

  const analysis = await analyseText({
    interaction_id: interactionId,
    ticket_id: ticketId,
    user_id: userId,
    text
  });

  const interaction = await prisma.ticketInteraction.create({
    data: {
      id: interactionId,
      ticketId,
      stepNumber,
      userText: text,
      modelOutput: analysis as unknown as Prisma.InputJsonValue,
      category: analysis.category,
      urgency: toUrgencyEnum(analysis.urgency),
      urgencyColour: analysis.urgency_colour,
      sentiment: toSentimentEnum(analysis.sentiment),
      department: analysis.department,
      keyPhrases: analysis.key_phrases,
      modelName: analysis.model_name,
      modelVersion: analysis.model_version,
      promptVersion: analysis.prompt_version ?? null
    }
  });

  if (analysis.vector_id) {
    await prisma.ticketVector.create({
      data: {
        id: analysis.vector_id,
        ticketId,
        interactionId,
        clusterId: analysis.cluster_id ?? null
      }
    });
  }

  return interaction;
}

export async function submitTicket(userId: string, ticketId: string) {
  const ticket = await assertOwnTicket(ticketId, userId);
  if (ticket.status === TicketStatus.SUBMITTED) {
    return ticket;
  }

  const now = new Date();
  return prisma.ticket.update({
    where: { id: ticketId },
    data: {
      status: TicketStatus.SUBMITTED,
      submittedAt: now,
      resolvedAt: now
    }
  });
}
