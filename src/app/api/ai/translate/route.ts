import { prisma } from "@/lib/db";
import { translateText } from "@/lib/ai/translate";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not configured. Add it to your .env file." },
      { status: 503 }
    );
  }

  try {
    const { text, targetLanguage, messageId, ticketId } = await request.json();

    const translated = await translateText(text, targetLanguage || "en");

    // Save translation to message if messageId provided
    if (messageId) {
      await prisma.message.update({
        where: { id: messageId },
        data: { bodyTranslated: translated },
      });
    }

    return NextResponse.json({ translated });
  } catch (error) {
    console.error("Translation error:", error);
    return NextResponse.json(
      { error: "Failed to translate. Make sure ANTHROPIC_API_KEY is set." },
      { status: 500 }
    );
  }
}
