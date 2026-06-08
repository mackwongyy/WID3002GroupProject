import { AnalysisStatus, Prisma, SentimentLabel, TicketStatus, UrgencyLevel } from "@prisma/client";
import { prisma } from "../../db/prisma.js";
import { HttpError } from "../../utils/http.js";
import { analyseText } from "../nlp/nlp.client.js";

function countBy<T extends string>(values: T[]): Record<T, number> {
  return values.reduce((acc, value) => {
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {} as Record<T, number>);
}



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

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "Unknown NLP analysis error.";
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

function buildValidationSummary(interactions: Array<{ id: string; validations?: unknown[] }>) {
  const totalInteractions = interactions.length;
  const validatedInteractions = interactions.filter((interaction) => (interaction.validations?.length ?? 0) > 0).length;

  return {
    total_interactions: totalInteractions,
    validated_interactions: validatedInteractions,
    pending_interactions: totalInteractions - validatedInteractions,
    validation_records: interactions.reduce((sum, interaction) => sum + (interaction.validations?.length ?? 0), 0)
  };
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
        id: true,
        category: true,
        urgency: true,
        sentiment: true,
        department: true,
        keyPhrases: true,
        analysisStatus: true,
        ticketId: true,
        stepNumber: true,
        validations: { select: { id: true } },
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
    top_key_phrases: countPhrases(interactions.map((i) => i.keyPhrases)),
    validation_summary: buildValidationSummary(interactions),
    analysis_status_breakdown: countBy(interactions.map((i) => i.analysisStatus))
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
        take: 1,
        include: {
          validations: {
            include: { admin: { select: { id: true, name: true, email: true } } },
            orderBy: { validatedAt: "desc" }
          }
        }
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
        id: true,
        category: true,
        urgency: true,
        sentiment: true,
        department: true,
        keyPhrases: true,
        validations: { select: { id: true } },
        analysisStatus: true,
        analysisError: true
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
    validation_summary: buildValidationSummary(interactions),
    analysis_status_breakdown: countBy(interactions.map((i) => i.analysisStatus)),
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
          },
          analysisRuns: {
            orderBy: { startedAt: "desc" },
            take: 5
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
  const interaction = await prisma.ticketInteraction.findUnique({
    where: { id: interactionId },
    include: {
      ticket: { select: { id: true, displayId: true, ticketName: true, userId: true, deletedAt: true } }
    }
  });

  if (!interaction || interaction.ticket.deletedAt) {
    throw new HttpError(404, "INTERACTION_NOT_FOUND", "Interaction was not found.");
  }

  const validationData = {
    correctedCategory: input.corrected_category ?? null,
    correctedUrgency: input.corrected_urgency ?? null,
    correctedSentiment: input.corrected_sentiment ?? null,
    correctedDepartment: input.corrected_department ?? null,
    notes: input.notes ?? "Validated from admin dashboard.",
    validatedAt: new Date()
  };

  const existingValidation = await prisma.adminValidation.findFirst({
    where: { interactionId, adminId }
  });

  const validation = existingValidation
    ? await prisma.adminValidation.update({
        where: { id: existingValidation.id },
        data: validationData,
        include: { admin: { select: { id: true, name: true, email: true } } }
      })
    : await prisma.adminValidation.create({
        data: {
          interactionId,
          adminId,
          ...validationData
        },
        include: { admin: { select: { id: true, name: true, email: true } } }
      });

  return {
    validation,
    interaction_id: interactionId,
    ticket_id: interaction.ticketId,
    is_validated: true,
    validated_at: validation.validatedAt
  };
}


export async function retryAnalysis(interactionId: string) {
  const interaction = await prisma.ticketInteraction.findUnique({
    where: { id: interactionId },
    include: {
      ticket: { select: { id: true, userId: true, deletedAt: true } }
    }
  });

  if (!interaction || interaction.ticket.deletedAt) {
    throw new HttpError(404, "INTERACTION_NOT_FOUND", "Interaction was not found.");
  }

  await prisma.ticketInteraction.update({
    where: { id: interactionId },
    data: {
      analysisStatus: AnalysisStatus.PENDING,
      analysisError: null
    }
  });

  const run = await prisma.analysisRun.create({
    data: {
      interactionId,
      status: AnalysisStatus.PENDING,
      startedAt: new Date()
    }
  });

  try {
    const analysis = await analyseText({
      interaction_id: interactionId,
      ticket_id: interaction.ticketId,
      user_id: interaction.ticket.userId,
      text: interaction.userText
    });

    const urgency = toUrgencyEnum(analysis.urgency);
    const sentiment = toSentimentEnum(analysis.sentiment);

    const [updatedInteraction] = await prisma.$transaction([
      prisma.ticketInteraction.update({
        where: { id: interactionId },
        data: {
          modelOutput: analysis as unknown as Prisma.InputJsonValue,
          category: analysis.category,
          urgency,
          urgencyColour: analysis.urgency_colour,
          sentiment,
          department: analysis.department,
          keyPhrases: analysis.key_phrases,
          modelName: analysis.model_name,
          modelVersion: analysis.model_version,
          promptVersion: analysis.prompt_version ?? null,
          analysisStatus: AnalysisStatus.SUCCESS,
          analysisError: null
        },
        include: {
          validations: {
            include: { admin: { select: { id: true, name: true, email: true } } },
            orderBy: { validatedAt: "desc" }
          },
          analysisRuns: {
            orderBy: { startedAt: "desc" },
            take: 5
          }
        }
      }),
      prisma.analysisRun.update({
        where: { id: run.id },
        data: {
          status: AnalysisStatus.SUCCESS,
          modelName: analysis.model_name,
          modelVersion: analysis.model_version,
          promptVersion: analysis.prompt_version ?? null,
          rawOutput: analysis as unknown as Prisma.InputJsonValue,
          category: analysis.category,
          urgency,
          sentiment,
          department: analysis.department,
          keyPhrases: analysis.key_phrases,
          completedAt: new Date()
        }
      })
    ]);

    if (analysis.vector_id) {
      await prisma.ticketVector.upsert({
        where: { interactionId },
        update: {
          id: analysis.vector_id,
          clusterId: analysis.cluster_id ?? null
        },
        create: {
          id: analysis.vector_id,
          ticketId: interaction.ticketId,
          interactionId,
          clusterId: analysis.cluster_id ?? null
        }
      });
    }

    return {
      interaction: updatedInteraction,
      analysis_status: AnalysisStatus.SUCCESS
    };
  } catch (error) {
    const message = errorMessage(error);

    const [updatedInteraction] = await prisma.$transaction([
      prisma.ticketInteraction.update({
        where: { id: interactionId },
        data: {
          analysisStatus: AnalysisStatus.FAILED,
          analysisError: message
        },
        include: {
          validations: {
            include: { admin: { select: { id: true, name: true, email: true } } },
            orderBy: { validatedAt: "desc" }
          },
          analysisRuns: {
            orderBy: { startedAt: "desc" },
            take: 5
          }
        }
      }),
      prisma.analysisRun.update({
        where: { id: run.id },
        data: {
          status: AnalysisStatus.FAILED,
          errorMessage: message,
          completedAt: new Date()
        }
      })
    ]);

    return {
      interaction: updatedInteraction,
      analysis_status: AnalysisStatus.FAILED,
      error: message
    };
  }
}


export async function deleteInteraction(adminId: string, interactionId: string) {
  const interaction = await prisma.ticketInteraction.findUnique({
    where: { id: interactionId },
    include: {
      ticket: { select: { id: true, displayId: true, ticketName: true, userId: true, deletedAt: true } },
      validations: { select: { id: true } },
      analysisRuns: { select: { id: true } },
      vector: { select: { id: true } }
    }
  });

  if (!interaction || interaction.ticket.deletedAt) {
    throw new HttpError(404, "INTERACTION_NOT_FOUND", "Interaction was not found.");
  }

  await prisma.ticketInteraction.delete({
    where: { id: interactionId }
  });

  return {
    deleted: true,
    interaction_id: interactionId,
    ticket_id: interaction.ticketId,
    ticket_display_id: interaction.ticket.displayId,
    step_number: interaction.stepNumber,
    deleted_by_admin_id: adminId,
    deleted_at: new Date(),
    removed_related_records: {
      validations: interaction.validations.length,
      analysis_runs: interaction.analysisRuns.length,
      vector: interaction.vector ? 1 : 0
    }
  };
}
