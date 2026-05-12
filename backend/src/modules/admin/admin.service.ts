import { Prisma, SentimentLabel, TicketStatus, UrgencyLevel } from "@prisma/client";
import { prisma } from "../../db/prisma.js";
import { HttpError } from "../../utils/http.js";

function countBy<T extends string>(values: T[]): Record<T, number> {
  return values.reduce((acc, value) => {
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {} as Record<T, number>);
}

function countPhrases(phraseGroups: string[][]) {
  const counter = new Map<string, number>();
  for (const phrases of phraseGroups) {
    for (const phrase of phrases) {
      const normalised = phrase.trim().toLowerCase();
      if (!normalised) continue;
      counter.set(normalised, (counter.get(normalised) ?? 0) + 1);
    }
  }
  return [...counter.entries()]
    .map(([phrase, count]) => ({ phrase, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);
}

export async function getSummary() {
  const [totalTickets, statusGroups, departmentGroups, interactions] = await Promise.all([
    prisma.ticket.count({ where: { deletedAt: null } }),
    prisma.ticket.groupBy({
      by: ["status"],
      where: { deletedAt: null },
      _count: { _all: true }
    }),
    prisma.ticketInteraction.groupBy({
      by: ["department"],
      _count: { _all: true }
    }),
    prisma.ticketInteraction.findMany({
      select: {
        category: true,
        urgency: true,
        sentiment: true,
        department: true,
        keyPhrases: true,
        ticketId: true,
        stepNumber: true,
        ticket: { select: { status: true } }
      }
    })
  ]);

  const latestByTicket = new Map<string, (typeof interactions)[number]>();
  for (const interaction of interactions) {
    const existing = latestByTicket.get(interaction.ticketId);
    if (!existing || interaction.stepNumber > existing.stepNumber) {
      latestByTicket.set(interaction.ticketId, interaction);
    }
  }
  const latestInteractions = [...latestByTicket.values()];
  const departmentStatusBreakdown = latestInteractions.reduce<Record<string, { in_progress: number; submitted: number }>>((acc, item) => {
    const current = acc[item.department] ?? { in_progress: 0, submitted: 0 };
    if (item.ticket.status === TicketStatus.SUBMITTED) current.submitted += 1;
    else current.in_progress += 1;
    acc[item.department] = current;
    return acc;
  }, {});

  const categoryBreakdown = countBy(interactions.map((i) => i.category));
  const urgencyBreakdown = countBy(interactions.map((i) => i.urgency));
  const sentimentBreakdown = countBy(interactions.map((i) => i.sentiment));

  return {
    total_tickets: totalTickets,
    status_breakdown: Object.fromEntries(statusGroups.map((g) => [g.status, g._count._all])),
    department_breakdown: departmentGroups.map((g) => ({ department: g.department, count: g._count._all })),
    department_status_breakdown: departmentStatusBreakdown,
    category_breakdown: categoryBreakdown,
    urgency_breakdown: urgencyBreakdown,
    sentiment_breakdown: sentimentBreakdown,
    top_key_phrases: countPhrases(interactions.map((i) => i.keyPhrases))
  };
}

export async function listTickets(filters: {
  userId?: string;
  status?: TicketStatus;
  department?: string;
  urgency?: UrgencyLevel;
}) {
  const interactionFilter: Prisma.TicketInteractionWhereInput = {};
  if (filters.department) interactionFilter.department = filters.department;
  if (filters.urgency) interactionFilter.urgency = filters.urgency;

  return prisma.ticket.findMany({
    where: {
      deletedAt: null,
      ...(filters.userId ? { userId: filters.userId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.department || filters.urgency
        ? {
            interactions: {
              some: interactionFilter
            }
          }
        : {})
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
      interactions: {
        orderBy: { createdAt: "desc" },
        take: 1
      },
      _count: { select: { interactions: true } }
    },
    orderBy: { updatedAt: "desc" }
  });
}

export async function getUsers() {
  return prisma.user.findMany({
    where: { role: "CUSTOMER" },
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
      _count: { select: { tickets: true } }
    },
    orderBy: { createdAt: "desc" }
  });
}

export async function getUserAnalytics(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true }
  });

  if (!user) {
    throw new HttpError(404, "USER_NOT_FOUND", "User was not found.");
  }

  const [tickets, interactions] = await Promise.all([
    prisma.ticket.findMany({
      where: { userId, deletedAt: null },
      select: {
        id: true,
        displayId: true,
        ticketName: true,
        status: true,
        createdAt: true,
        submittedAt: true,
        _count: { select: { interactions: true } }
      },
      orderBy: { updatedAt: "desc" }
    }),
    prisma.ticketInteraction.findMany({
      where: { ticket: { userId, deletedAt: null } },
      select: {
        category: true,
        urgency: true,
        sentiment: true,
        department: true,
        keyPhrases: true
      }
    })
  ]);

  return {
    user,
    ticket_summary: {
      total_tickets: tickets.length,
      in_progress: tickets.filter((t) => t.status === TicketStatus.IN_PROGRESS).length,
      submitted: tickets.filter((t) => t.status === TicketStatus.SUBMITTED).length
    },
    category_breakdown: countBy(interactions.map((i) => i.category)),
    urgency_breakdown: countBy(interactions.map((i) => i.urgency)),
    sentiment_breakdown: countBy(interactions.map((i) => i.sentiment)),
    department_breakdown: countBy(interactions.map((i) => i.department)),
    top_key_phrases: countPhrases(interactions.map((i) => i.keyPhrases)),
    tickets
  };
}

export async function getTicketHistory(ticketId: string) {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: {
      user: { select: { id: true, name: true, email: true } },
      interactions: {
        orderBy: { stepNumber: "asc" },
        include: {
          validations: {
            include: {
              admin: { select: { id: true, name: true, email: true } }
            },
            orderBy: { validatedAt: "desc" }
          }
        }
      }
    }
  });

  if (!ticket || ticket.deletedAt) {
    throw new HttpError(404, "TICKET_NOT_FOUND", "Ticket was not found.");
  }

  return ticket;
}

export async function validateInteraction(
  adminId: string,
  interactionId: string,
  input: {
    corrected_category?: string;
    corrected_urgency?: UrgencyLevel;
    corrected_sentiment?: SentimentLabel;
    corrected_department?: string;
    notes?: string;
  }
) {
  const interaction = await prisma.ticketInteraction.findUnique({ where: { id: interactionId } });
  if (!interaction) {
    throw new HttpError(404, "INTERACTION_NOT_FOUND", "Interaction was not found.");
  }

  return prisma.adminValidation.create({
    data: {
      interactionId,
      adminId,
      correctedCategory: input.corrected_category ?? null,
      correctedUrgency: input.corrected_urgency ?? null,
      correctedSentiment: input.corrected_sentiment ?? null,
      correctedDepartment: input.corrected_department ?? null,
      notes: input.notes ?? null
    }
  });
}
