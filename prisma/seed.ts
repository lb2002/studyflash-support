import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import * as fs from "fs";
import * as path from "path";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const PROCESS_TAGS = new Set(["ai-draft", "AI", "auto-closed", "garbage"]);

const TAG_TO_CATEGORY: Record<string, string> = {
  "subscription-cancellation": "SUBSCRIPTION_CANCELLATION",
  "refund-request": "REFUND_REQUEST",
  "flashcard-issues": "FLASHCARD_ISSUES",
  "account-issues": "ACCOUNT_ISSUES",
  "billing-invoice": "BILLING_INVOICE",
  "content-upload": "CONTENT_UPLOAD",
  "technical-errors": "TECHNICAL_ERRORS",
  "language-issues": "LANGUAGE_ISSUES",
  "data-loss": "DATA_LOSS",
  "quiz-issues": "QUIZ_ISSUES",
  "podcast-issues": "PODCAST_ISSUES",
  "mindmap-issues": "MINDMAP_ISSUES",
  "mock-exam-issues": "MOCK_EXAM_ISSUES",
  "summary-issues": "SUMMARY_ISSUES",
  "general-how-to": "GENERAL_HOW_TO",
  "misunderstanding": "MISUNDERSTANDING",
  "subscription-info": "OTHER",
};

function parseTicketFile(filePath: string) {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");

  const tagsLine = lines[0].replace("Tags: ", "").trim();
  const allTags = tagsLine.split(", ").map((t) => t.trim());

  const processTags = allTags.filter((t) => PROCESS_TAGS.has(t));
  const categoryTags = allTags.filter((t) => !PROCESS_TAGS.has(t));

  const separatorIdx = lines.findIndex((l) => l.trim() === "---");
  const body = lines
    .slice(separatorIdx + 1)
    .join("\n")
    .trim();

  let source = "WEB";
  let cleanBody = body;
  if (body.startsWith("MOBILE:")) {
    source = "MOBILE";
    cleanBody = body.replace(/^MOBILE:\s*/, "");
  }

  let category: string | null = null;
  for (const tag of categoryTags) {
    if (TAG_TO_CATEGORY[tag]) {
      category = TAG_TO_CATEGORY[tag];
      break;
    }
  }

  if (!category && processTags.includes("garbage")) {
    category = "GARBAGE";
  }

  let status = "OPEN";
  if (processTags.includes("auto-closed")) {
    status = "AUTO_CLOSED";
  }

  const filename = path.basename(filePath, ".txt");
  const externalId = filename.replace("ticket_", "");

  const subject =
    cleanBody.split("\n")[0].substring(0, 80) ||
    `Support Ticket #${externalId}`;

  return {
    externalId,
    subject,
    status,
    category,
    tags: allTags,
    source,
    body: cleanBody,
    processTags,
  };
}

async function main() {
  console.log("Seeding database...");

  await prisma.enrichment.deleteMany();
  await prisma.message.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.teamMember.deleteMany();

  const teamMembers = await Promise.all([
    prisma.teamMember.create({
      data: { name: "Rajiv Manichand", email: "rajiv@studyflash.ch", role: "admin" },
    }),
    prisma.teamMember.create({
      data: { name: "Linus Baumberger", email: "linus@studyflash.ch", role: "support" },
    }),
    prisma.teamMember.create({
      data: { name: "Nikola Bulatovic", email: "nikola@studyflash.ch", role: "engineering" },
    }),
  ]);

  console.log(`Created ${teamMembers.length} team members`);

  const ticketsDir = path.resolve(process.cwd(), "tickets");
  const files = fs
    .readdirSync(ticketsDir)
    .filter((f) => f.startsWith("ticket_") && f.endsWith(".txt"))
    .sort();

  console.log(`Found ${files.length} ticket files`);

  let created = 0;
  for (const file of files) {
    const filePath = path.join(ticketsDir, file);
    const parsed = parseTicketFile(filePath);

    await prisma.ticket.create({
      data: {
        externalId: parsed.externalId,
        subject: parsed.subject,
        status: parsed.status as any,
        category: parsed.category as any,
        tags: parsed.tags,
        source: parsed.source,
        messages: {
          create: {
            body: parsed.body,
            source: "INBOUND_EMAIL" as any,
            senderName: `Customer #${parsed.externalId}`,
            senderEmail: `customer${parsed.externalId}@example.com`,
          },
        },
      },
    });
    created++;
  }

  console.log(`Seeded ${created} tickets`);
  console.log("Done!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
