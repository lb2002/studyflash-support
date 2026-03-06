import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
  const [
    totalTickets,
    openTickets,
    inProgressTickets,
    resolvedTickets,
    autoClosedTickets,
    categoryDistribution,
    languageDistribution,
    recentTickets,
    assigneeWorkload,
  ] = await Promise.all([
    prisma.ticket.count(),
    prisma.ticket.count({ where: { status: "OPEN" } }),
    prisma.ticket.count({ where: { status: "IN_PROGRESS" } }),
    prisma.ticket.count({ where: { status: { in: ["RESOLVED", "CLOSED"] } } }),
    prisma.ticket.count({ where: { status: "AUTO_CLOSED" } }),
    prisma.ticket.groupBy({
      by: ["category"],
      _count: { category: true },
      orderBy: { _count: { category: "desc" } },
    }),
    prisma.ticket.groupBy({
      by: ["language"],
      _count: { language: true },
      where: { language: { not: null } },
    }),
    prisma.ticket.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      include: { assignee: true },
    }),
    prisma.ticket.groupBy({
      by: ["assigneeId"],
      _count: { assigneeId: true },
      where: { assigneeId: { not: null } },
    }),
  ]);

  // Get assignee names for workload
  const assigneeIds = assigneeWorkload
    .map((a) => a.assigneeId)
    .filter(Boolean) as string[];
  const assignees = await prisma.teamMember.findMany({
    where: { id: { in: assigneeIds } },
  });

  const workloadWithNames = assigneeWorkload.map((w) => ({
    ...w,
    assignee: assignees.find((a) => a.id === w.assigneeId),
  }));

  return NextResponse.json({
    stats: {
      total: totalTickets,
      open: openTickets,
      inProgress: inProgressTickets,
      resolved: resolvedTickets,
      autoClosed: autoClosedTickets,
    },
    categoryDistribution,
    languageDistribution,
    recentTickets,
    assigneeWorkload: workloadWithNames,
  });
  } catch {
    return NextResponse.json(
      { error: "Failed to load dashboard data" },
      { status: 500 }
    );
  }
}
