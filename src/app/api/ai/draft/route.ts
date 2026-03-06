import { prisma } from "@/lib/db";
import { draftResponse } from "@/lib/ai/draft";
import { NextRequest, NextResponse } from "next/server";

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
      include: {
        messages: { orderBy: { createdAt: "asc" } },
      },
    });

    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    const conversationHistory = ticket.messages.map((m) => ({
      role: m.source,
      body: m.body,
    }));

    const draft = await draftResponse(
      ticket.messages[0]?.body || "",
      ticket.category,
      ticket.language,
      conversationHistory
    );

    return NextResponse.json({ draft });
  } catch (error) {
    console.error("Draft error:", error);
    return NextResponse.json(
      { error: "Failed to generate draft. Make sure ANTHROPIC_API_KEY is set." },
      { status: 500 }
    );
  }
}
