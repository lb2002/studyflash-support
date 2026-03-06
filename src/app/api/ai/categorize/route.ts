import { prisma } from "@/lib/db";
import { categorizeTicket } from "@/lib/ai/categorize";
import { NextRequest, NextResponse } from "next/server";
import { TicketCategory, TicketPriority } from "@/generated/prisma/client";

export async function POST(request: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not configured. Add it to your .env file." },
      { status: 503 }
    );
  }

  try {
    const { ticketId } = await request.json();

    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { messages: { orderBy: { createdAt: "asc" }, take: 1 } },
    });

    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    const firstMessage = ticket.messages[0];
    if (!firstMessage) {
      return NextResponse.json(
        { error: "No messages in ticket" },
        { status: 400 }
      );
    }

    const result = await categorizeTicket(firstMessage.body);

    // Validate category is a valid enum value
    const validCategories = Object.values(TicketCategory) as string[];
    const category = validCategories.includes(result.category)
      ? (result.category as TicketCategory)
      : null;

    const validPriorities = Object.values(TicketPriority) as string[];
    const priority = validPriorities.includes(result.priority)
      ? (result.priority as TicketPriority)
      : ticket.priority;

    // Auto-assign based on AI-suggested role if ticket is unassigned
    let assigneeId: string | undefined;
    if (!ticket.assigneeId && result.suggested_assignee_role) {
      const match = await prisma.teamMember.findFirst({
        where: { role: result.suggested_assignee_role },
      });
      if (match) assigneeId = match.id;
    }

    await prisma.ticket.update({
      where: { id: ticketId },
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

    return NextResponse.json({ success: true, result, assigneeId });
  } catch (error) {
    console.error("Categorization error:", error);
    return NextResponse.json(
      { error: "Failed to categorize ticket. Make sure ANTHROPIC_API_KEY is set." },
      { status: 500 }
    );
  }
}
