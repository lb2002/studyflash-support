import { prisma } from "@/lib/db";
import { categorizeTicket } from "@/lib/ai/categorize";
import { NextResponse } from "next/server";
import { TicketCategory, TicketPriority } from "@/generated/prisma/client";

export async function POST() {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not configured. Add it to your .env file." },
      { status: 503 }
    );
  }

  try {
    // Find tickets without a category
    const uncategorized = await prisma.ticket.findMany({
      where: { category: null },
      include: { messages: { orderBy: { createdAt: "asc" }, take: 1 } },
      take: 20,
    });

    if (uncategorized.length === 0) {
      return NextResponse.json({
        categorized: 0,
        message: "All tickets are already categorized",
      });
    }

    let categorized = 0;
    const errors: string[] = [];

    for (const ticket of uncategorized) {
      const firstMessage = ticket.messages[0];
      if (!firstMessage) continue;

      try {
        const result = await categorizeTicket(firstMessage.body);

        const validCategories = Object.values(TicketCategory) as string[];
        const category = validCategories.includes(result.category)
          ? (result.category as TicketCategory)
          : null;

        const validPriorities = Object.values(TicketPriority) as string[];
        const priority = validPriorities.includes(result.priority)
          ? (result.priority as TicketPriority)
          : ticket.priority;

        // Auto-assign based on AI-suggested role if unassigned
        let assigneeId: string | undefined;
        if (!ticket.assigneeId && result.suggested_assignee_role) {
          const match = await prisma.teamMember.findFirst({
            where: { role: result.suggested_assignee_role },
          });
          if (match) assigneeId = match.id;
        }

        await prisma.ticket.update({
          where: { id: ticket.id },
          data: {
            category,
            priority,
            language: result.language,
            aiSummary: result.summary_en,
            aiConfidence: result.confidence,
            aiSuggestedAssignee: result.suggested_assignee_role,
            ...(assigneeId ? { assigneeId, status: "IN_PROGRESS" } : {}),
          },
        });

        categorized++;
      } catch (e) {
        errors.push(`Ticket ${ticket.externalId}: ${e instanceof Error ? e.message : "unknown error"}`);
      }
    }

    return NextResponse.json({
      categorized,
      total: uncategorized.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Batch categorization error:", error);
    return NextResponse.json(
      { error: "Failed to run batch categorization" },
      { status: 500 }
    );
  }
}
