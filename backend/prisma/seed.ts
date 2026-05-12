import bcrypt from "bcryptjs";
import { PrismaClient, UserRole } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("password123", 12);

  const customer = await prisma.user.upsert({
    where: { email: "customer@example.com" },
    update: {},
    create: {
      name: "Demo Customer",
      email: "customer@example.com",
      passwordHash,
      role: UserRole.CUSTOMER
    }
  });

  await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: {
      name: "Demo Admin",
      email: "admin@example.com",
      passwordHash,
      role: UserRole.ADMIN
    }
  });

  const existingTicket = await prisma.ticket.findFirst({ where: { userId: customer.id } });
  if (!existingTicket) {
    await prisma.ticket.create({
      data: {
        userId: customer.id,
        displayId: "TCK-2026-00001",
        ticketName: "Sample double charge issue",
        sortOrder: 1,
        interactions: {
          create: {
            stepNumber: 1,
            userText: "I was charged twice but refund still belum masuk.",
            modelOutput: {
              category: "Payment Issue",
              urgency: "High",
              urgency_colour: "Red",
              sentiment: "Negative",
              key_phrases: ["charged twice", "refund belum masuk"],
              department: "Finance Department",
              confidence: { category: 0.9, urgency: 0.86, sentiment: 0.88 },
              similar_tickets: [],
              model_name: "demo-rules",
              model_version: "0.1.0"
            },
            category: "Payment Issue",
            urgency: "HIGH",
            urgencyColour: "Red",
            sentiment: "NEGATIVE",
            department: "Finance Department",
            keyPhrases: ["charged twice", "refund belum masuk"],
            modelName: "demo-rules",
            modelVersion: "0.1.0"
          }
        }
      }
    });
  }

  console.log("Seed completed.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
