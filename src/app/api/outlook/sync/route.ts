import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { getMockEmails } from "@/lib/outlook/mock";
import { categorizeTicket } from "@/lib/ai/categorize";
import { TicketCategory, TicketPriority } from "@/generated/prisma/client";

export async function POST() {
  const outlookEnabled = process.env.OUTLOOK_ENABLED === "true";

  if (outlookEnabled) {
    // Real Outlook sync
    try {
      const { syncEmails } = await import("@/lib/outlook/sync");
      const result = await syncEmails();
      return NextResponse.json(result);
    } catch (error) {
      console.error("Outlook sync error:", error);
      return NextResponse.json(
        { error: "Failed to sync with Outlook" },
        { status: 500 }
      );
    }
  }

  // Mock mode: import mock emails as tickets
  const mockEmails = getMockEmails();
  let created = 0;

  for (const email of mockEmails) {
    // Check if already imported
    const existing = await prisma.ticket.findFirst({
      where: { outlookMessageId: email.id },
    });
    if (existing) continue;

    const ticket = await prisma.ticket.create({
      data: {
        subject: email.subject,
        customerEmail: email.from.emailAddress.address,
        customerName: email.from.emailAddress.name,
        outlookMessageId: email.id,
        outlookConversationId: email.conversationId,
        source: "EMAIL",
        messages: {
          create: {
            body: email.body.content,
            source: "INBOUND_EMAIL",
            senderName: email.from.emailAddress.name,
            senderEmail: email.from.emailAddress.address,
            outlookMessageId: email.id,
          },
        },
      },
    });

    // Auto-categorize if API key is available
    if (process.env.ANTHROPIC_API_KEY) {
      try {
        const result = await categorizeTicket(email.body.content);
        const validCategories = Object.values(TicketCategory) as string[];
        const validPriorities = Object.values(TicketPriority) as string[];
        await prisma.ticket.update({
          where: { id: ticket.id },
          data: {
            category: validCategories.includes(result.category)
              ? (result.category as TicketCategory)
              : null,
            priority: validPriorities.includes(result.priority)
              ? (result.priority as TicketPriority)
              : "MEDIUM",
            language: result.language,
            aiSummary: result.summary_en,
            aiConfidence: result.confidence,
            aiSuggestedAssignee: result.suggested_assignee_role,
          },
        });
      } catch {
        // AI categorization is optional
      }
    }

    created++;
  }

  return NextResponse.json({
    created,
    updated: 0,
    total: mockEmails.length,
    mock: true,
  });
}
