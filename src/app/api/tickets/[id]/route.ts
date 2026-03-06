import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: {
      assignee: true,
      messages: {
        orderBy: { createdAt: "asc" },
        include: { teamMember: true },
      },
      enrichments: true,
    },
  });

  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  return NextResponse.json(ticket);
}

const ALLOWED_PATCH_FIELDS = new Set([
  "status",
  "priority",
  "category",
  "tags",
  "language",
  "translatedSubject",
  "aiSummary",
  "aiConfidence",
  "aiSuggestedAssignee",
  "assigneeId",
]);

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const data: Record<string, unknown> = {};
    for (const key of Object.keys(body)) {
      if (ALLOWED_PATCH_FIELDS.has(key)) {
        data[key] = body[key];
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No valid fields provided" }, { status: 400 });
    }

    const ticket = await prisma.ticket.update({
      where: { id },
      data,
      include: {
        assignee: true,
      },
    });

    return NextResponse.json(ticket);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    if ((error as { code?: string })?.code === "P2025") {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to update ticket" }, { status: 500 });
  }
}
