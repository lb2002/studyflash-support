import { anthropic } from "./client";

export async function translateText(
  text: string,
  targetLanguage: string = "en"
): Promise<string> {
  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2000,
    messages: [
      {
        role: "user",
        content: `Translate the following text to ${targetLanguage === "en" ? "English" : targetLanguage}. Return ONLY the translation, nothing else.\n\n${text}`,
      },
    ],
  });

  const block = message.content[0];
  return block && block.type === "text" ? block.text : "";
}
