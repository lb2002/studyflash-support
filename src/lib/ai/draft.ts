import { anthropic } from "./client";

const SYSTEM_PROMPT = `You are a friendly and professional customer support agent for Studyflash, an ed-tech platform that helps students create flashcards, summaries, mind maps, quizzes, and mock exams from their study materials.

Write a response to the customer's support ticket. Important:
- Reply in the SAME LANGUAGE as the customer's message
- Be warm, empathetic, and helpful
- Keep responses concise but thorough
- If it's a cancellation request, explain the process briefly and offer assistance
- If it's a refund request, acknowledge it and explain you'll look into it
- If it's a technical issue, ask for more details if needed
- If it's a how-to question, provide clear step-by-step instructions
- Sign off as "The Studyflash Team"

Do NOT wrap the response in quotes or add any metadata. Just write the email response text.`;

export async function draftResponse(
  ticketBody: string,
  category: string | null,
  language: string | null,
  conversationHistory: Array<{ role: string; body: string }>
): Promise<string> {
  const contextParts: string[] = [];

  if (category) {
    contextParts.push(`Category: ${category}`);
  }
  if (language) {
    contextParts.push(`Customer language: ${language}`);
  }

  const historyText = conversationHistory
    .map(
      (msg) =>
        `[${msg.role === "INBOUND_EMAIL" ? "Customer" : "Support"}]: ${msg.body}`
    )
    .join("\n\n");

  const prompt = `${contextParts.length > 0 ? contextParts.join("\n") + "\n\n" : ""}Conversation:\n${historyText}\n\nWrite a response to the customer's latest message.`;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 1000,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  const block = message.content[0];
  return block && block.type === "text" ? block.text : "";
}
