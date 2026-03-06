import { anthropic } from "./client";

export interface CategorizationResult {
  category: string;
  priority: string;
  language: string;
  summary_en: string;
  confidence: number;
  suggested_assignee_role: string;
}

const SYSTEM_PROMPT = `You are a support ticket classifier for Studyflash, an ed-tech platform that helps students create flashcards, summaries, mind maps, quizzes, and mock exams from their study materials.

Analyze the support ticket and return a JSON object with these fields:

- category: One of: SUBSCRIPTION_CANCELLATION, REFUND_REQUEST, FLASHCARD_ISSUES, ACCOUNT_ISSUES, BILLING_INVOICE, CONTENT_UPLOAD, TECHNICAL_ERRORS, LANGUAGE_ISSUES, DATA_LOSS, QUIZ_ISSUES, PODCAST_ISSUES, MINDMAP_ISSUES, MOCK_EXAM_ISSUES, SUMMARY_ISSUES, GENERAL_HOW_TO, MISUNDERSTANDING, GARBAGE, OTHER
- priority: One of: LOW, MEDIUM, HIGH, URGENT
  - URGENT: Data loss, account locked, payment issues needing immediate resolution
  - HIGH: Refund requests, subscription billing problems
  - MEDIUM: Feature issues (flashcards, quizzes, etc.), how-to questions
  - LOW: General feedback, misunderstandings, garbage/spam
- language: ISO 639-1 code (e.g., "de", "nl", "fr", "en")
- summary_en: A concise 1-sentence English summary of the ticket
- confidence: 0.0-1.0 confidence in your categorization
- suggested_assignee_role: One of: "support" (general inquiries, cancellations), "admin" (refunds, billing), "engineering" (bugs, technical errors)

Return ONLY valid JSON, no markdown formatting.`;

export async function categorizeTicket(
  ticketBody: string
): Promise<CategorizationResult> {
  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 500,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Classify this support ticket:\n\n${ticketBody}`,
      },
    ],
  });

  const block = message.content[0];
  const text = block && block.type === "text" ? block.text : "";

  // Strip markdown code fences if Claude wraps the JSON
  const cleaned = text
    .replace(/^```(?:json)?\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    throw new Error(`AI returned invalid JSON: ${text.slice(0, 200)}`);
  }
}
