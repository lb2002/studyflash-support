import { NextRequest, NextResponse } from "next/server";

/**
 * Webhook endpoint for Microsoft Graph subscriptions.
 *
 * In production, this would:
 * 1. Validate the subscription during creation (respond with validationToken)
 * 2. Process change notifications for new/updated emails
 * 3. Trigger sync for affected conversations
 *
 * Setup requires:
 * - Public HTTPS endpoint
 * - Subscription created via POST /subscriptions
 * - Max lifetime: 4,230 minutes (needs periodic renewal)
 */
export async function POST(request: NextRequest) {
  // Handle subscription validation
  const validationToken = request.nextUrl.searchParams.get("validationToken");
  if (validationToken) {
    return new NextResponse(validationToken, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  // Handle change notifications
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.value) {
    for (const notification of body.value) {
      // In production: trigger sync for the affected mailbox/conversation
      // await syncEmails();
      void notification;
    }
  }

  return NextResponse.json({ status: "accepted" }, { status: 202 });
}
