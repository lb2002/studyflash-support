import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const messages = await prisma.message.findMany({
    where: { ticketId: id },
    include: { teamMember: true },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(messages);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    if (!body.body || typeof body.body !== "string") {
      return NextResponse.json({ error: "Message body is required" }, { status: 400 });
    }

    const message = await prisma.message.create({
      data: {
        ticketId: id,
        body: body.body,
        source: body.source || "OUTBOUND_EMAIL",
        senderName: body.senderName,
        senderEmail: body.senderEmail,
        teamMemberId: body.teamMemberId,
      },
      include: { teamMember: true },
    });

    // Update ticket status if replying
    if (body.source === "OUTBOUND_EMAIL") {
      await prisma.ticket.update({
        where: { id },
        data: { status: "WAITING_ON_CUSTOMER" },
      });
    }

    return NextResponse.json(message);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    if ((error as { code?: string })?.code === "P2003") {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to create message" }, { status: 500 });
  }
}
