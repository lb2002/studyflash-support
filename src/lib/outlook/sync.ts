import { createGraphClient, getSharedMailbox } from "./client";
import { prisma } from "@/lib/db";
import { categorizeTicket } from "@/lib/ai/categorize";
import { TicketCategory, TicketPriority } from "@/generated/prisma/client";

interface GraphMessage {
  id: string;
  conversationId: string;
  subject: string;
  from: {
    emailAddress: {
      name: string;
      address: string;
    };
  };
  body: {
    contentType: string;
    content: string;
  };
  receivedDateTime: string;
  isRead: boolean;
}

/**
 * Sync emails from the shared mailbox.
 * - New conversations create new tickets
 * - Messages in existing conversations are appended to the thread
 */
export async function syncEmails(since?: Date) {
  const client = createGraphClient();
  const mailbox = getSharedMailbox();

  const sinceDate = since || new Date(Date.now() - 24 * 60 * 60 * 1000); // Default: last 24h
  const filter = `receivedDateTime ge ${sinceDate.toISOString()}`;

  const response = await client
    .api(`/users/${mailbox}/messages`)
    .filter(filter)
    .select(
      "id,conversationId,subject,from,body,receivedDateTime,isRead"
    )
    .orderby("receivedDateTime ASC")
    .top(50)
    .get();

  const messages: GraphMessage[] = response.value;
  let created = 0;
  let updated = 0;

  for (const msg of messages) {
    // Check if we already have this message
    const existingMessage = await prisma.message.findUnique({
      where: { outlookMessageId: msg.id },
    });
    if (existingMessage) continue;

    // Check if we have a ticket for this conversation
    const existingTicket = await prisma.ticket.findFirst({
      where: { outlookConversationId: msg.conversationId },
    });

    if (existingTicket) {
      // Append message to existing ticket
      await prisma.message.create({
        data: {
          ticketId: existingTicket.id,
          body: msg.body.content,
          source: "INBOUND_EMAIL",
          senderName: msg.from.emailAddress.name,
          senderEmail: msg.from.emailAddress.address,
          outlookMessageId: msg.id,
        },
      });
      updated++;
    } else {
      // Create new ticket
      const ticket = await prisma.ticket.create({
        data: {
          subject: msg.subject || "No Subject",
          customerEmail: msg.from.emailAddress.address,
          customerName: msg.from.emailAddress.name,
          outlookMessageId: msg.id,
          outlookConversationId: msg.conversationId,
          source: "EMAIL",
          messages: {
            create: {
              body: msg.body.content,
              source: "INBOUND_EMAIL",
              senderName: msg.from.emailAddress.name,
              senderEmail: msg.from.emailAddress.address,
              outlookMessageId: msg.id,
            },
          },
        },
      });

      // Auto-categorize with AI
      try {
        const result = await categorizeTicket(msg.body.content);
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
      } catch (e) {
        console.error("Auto-categorization failed for ticket:", ticket.id, e);
      }

      created++;
    }
  }

  return { created, updated, total: messages.length };
}

/**
 * Send a reply to a message in the shared mailbox.
 * Uses the Graph API reply endpoint which automatically maintains thread parity.
 */
export async function sendReply(
  outlookMessageId: string,
  replyBody: string
) {
  const client = createGraphClient();
  const mailbox = getSharedMailbox();

  await client
    .api(`/users/${mailbox}/messages/${outlookMessageId}/reply`)
    .post({
      comment: replyBody,
    });
}

/**
 * Get all messages in a conversation thread.
 */
export async function getConversationThread(conversationId: string) {
  const client = createGraphClient();
  const mailbox = getSharedMailbox();

  const response = await client
    .api(`/users/${mailbox}/messages`)
    .filter(`conversationId eq '${conversationId}'`)
    .orderby("receivedDateTime ASC")
    .get();

  return response.value;
}
