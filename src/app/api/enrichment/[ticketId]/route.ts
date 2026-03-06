import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// Mock enrichment data - in production, these would call real Sentry, PostHog, and DB APIs
function generateMockSentryData(email: string) {
  const errors = [
    {
      title: "TypeError: Cannot read property 'flashcards' of undefined",
      count: 12,
      lastSeen: "2 hours ago",
      level: "error",
    },
    {
      title: "NetworkError: Failed to fetch /api/decks",
      count: 3,
      lastSeen: "1 day ago",
      level: "warning",
    },
  ];

  // 40% chance of having errors
  return Math.random() > 0.6 ? errors : [];
}

function generateMockPostHogData(email: string) {
  return {
    sessions: [
      { id: "s1", duration: "12m 34s", date: "2026-03-01" },
      { id: "s2", duration: "5m 12s", date: "2026-02-28" },
      { id: "s3", duration: "23m 45s", date: "2026-02-27" },
    ],
    lastActive: "2026-03-01",
    totalSessions: 47,
    featureFlags: {
      "new-quiz-mode": true,
      "ai-flashcards-v2": false,
      "podcast-player": true,
    },
    events: [
      { event: "deck_created", timestamp: "2026-03-01T10:30:00Z" },
      { event: "flashcard_studied", timestamp: "2026-03-01T10:35:00Z" },
      { event: "subscription_page_viewed", timestamp: "2026-02-28T14:20:00Z" },
    ],
  };
}

function generateMockUserData(email: string) {
  const plans = ["free", "monthly", "yearly"];
  return {
    plan: plans[Math.floor(Math.random() * plans.length)],
    signupDate: "2025-09-15",
    lastLogin: "2026-03-01",
    deckCount: Math.floor(Math.random() * 30) + 1,
    cardCount: Math.floor(Math.random() * 500) + 10,
    studySessions: Math.floor(Math.random() * 100) + 5,
    language: "de",
    country: "CH",
    platform: "web",
  };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  const { ticketId } = await params;

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
  });

  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  const email = ticket.customerEmail || "unknown@example.com";

  // In production: call real APIs
  // const sentryData = await fetch(`https://sentry.io/api/0/organizations/{org}/issues/?query=user.email:${email}`)
  // const posthogData = await fetch(`https://app.posthog.com/api/persons/?email=${email}`)
  // const userData = await prisma.user.findUnique({ where: { email } })

  const enrichment = {
    sentry: generateMockSentryData(email),
    posthog: generateMockPostHogData(email),
    userData: generateMockUserData(email),
  };

  return NextResponse.json(enrichment);
}
