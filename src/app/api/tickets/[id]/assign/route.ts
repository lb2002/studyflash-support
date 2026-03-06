import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { assigneeId } = await request.json();

    const ticket = await prisma.ticket.update({
      where: { id },
      data: {
        assigneeId: assigneeId || null,
        status: assigneeId ? "IN_PROGRESS" : "OPEN",
      },
      include: { assignee: true },
    });

    return NextResponse.json(ticket);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    if ((error as { code?: string })?.code === "P2025") {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }
    if ((error as { code?: string })?.code === "P2003") {
      return NextResponse.json({ error: "Invalid assignee" }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to assign ticket" }, { status: 500 });
  }
}
