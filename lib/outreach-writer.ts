import { getChatGptKey, requestChatGptJson, PRIMARY_KEY_NAME } from "@/lib/chatgpt";
import { getGeminiKey, requestGeminiJson, PRIMARY_GEMINI_KEY_NAME } from "@/lib/gemini";

/**
 * The outreach writer, with a second provider behind the first. ChatGPT stays the
 * primary because that is the configured role split; Gemini only answers when
 * ChatGPT is absent or failing, and whichever one answers is reported as such.
 * A failure here is returned as a failure - callers must not substitute templates.
 */

export type ModelProvider = "chatgpt" | "gemini";

export type WriterAnswer<T> =
  | { ok: true; data: T; modelProvider: ModelProvider; modelName: string }
  | { ok: false; status: "no_key" | "provider_error"; message: string; attempted: ModelProvider[] };

export function missingWriterKeyMessage(): string {
  return `No live copy was written: neither ${PRIMARY_KEY_NAME} nor ${PRIMARY_GEMINI_KEY_NAME} is set in Vercel Project Settings -> Environment Variables. No template is substituted, because template copy would claim things the approved facts do not support.`;
}

export function hasAnyWriterKey(): boolean {
  return Boolean(getChatGptKey() || getGeminiKey());
}

export async function writeWithFallback<T>(
  systemPrompt: string,
  userPrompt: string,
  temperature = 0.4
): Promise<WriterAnswer<T>> {
  const attempted: ModelProvider[] = [];
  const failures: string[] = [];

  if (getChatGptKey()) {
    attempted.push("chatgpt");
    const chatGpt = await requestChatGptJson<T>(systemPrompt, userPrompt, temperature);
    if (chatGpt.ok) return { ok: true, data: chatGpt.data, modelProvider: "chatgpt", modelName: chatGpt.model };
    failures.push(`ChatGPT: ${chatGpt.message}`);
  }

  if (getGeminiKey()) {
    attempted.push("gemini");
    const gemini = await requestGeminiJson<T>(systemPrompt, userPrompt, { temperature, grounding: false });
    if (gemini.ok) return { ok: true, data: gemini.data, modelProvider: "gemini", modelName: gemini.model };
    failures.push(`Gemini: ${gemini.message}`);
  }

  if (attempted.length === 0) {
    return { ok: false, status: "no_key", message: missingWriterKeyMessage(), attempted };
  }

  return {
    ok: false,
    status: "provider_error",
    message: `Both writers failed, so nothing was drafted. ${failures.join(" | ")}`,
    attempted,
  };
}

export function providerLabel(modelProvider: ModelProvider, modelName: string): string {
  return `${modelProvider === "chatgpt" ? "ChatGPT" : "Gemini"} (${modelName})`;
}
