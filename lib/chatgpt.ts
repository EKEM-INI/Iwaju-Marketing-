const KEY_NAMES = ["CHAT_GPT_API", "OPENAI_API_KEY", "CHATGPT_API", "CHATGPT_API_KEY"] as const;

export const PRIMARY_KEY_NAME = "CHAT_GPT_API";

export function getChatGptKey(): string | null {
  for (const name of KEY_NAMES) {
    const raw = process.env[name];
    if (raw && raw.trim().length > 0) return raw.trim();
  }
  return null;
}

export function getChatGptModel(): string {
  return process.env.CHAT_GPT_MODEL?.trim() || "gpt-4o-mini";
}

function completionsUrl(): string {
  const base = process.env.CHAT_GPT_BASE_URL?.trim().replace(/\/+$/, "");
  return `${base || "https://api.openai.com"}/v1/chat/completions`;
}

export function missingKeyMessage(): string {
  return `No OpenAI API key found. Add ${PRIMARY_KEY_NAME} (an sk-... key from platform.openai.com) to Vercel Project Settings -> Environment Variables with Production scope, then redeploy. Checked names: ${KEY_NAMES.join(", ")}.`;
}

export type ChatGptResult<T> =
  | { ok: true; data: T; model: string }
  | { ok: false; status: "no_key" | "provider_error" | "parse_error"; message: string };

export async function requestChatGptJson<T>(
  systemPrompt: string,
  userPrompt: string,
  temperature = 0.2
): Promise<ChatGptResult<T>> {
  const apiKey = getChatGptKey();
  if (!apiKey) return { ok: false, status: "no_key", message: missingKeyMessage() };

  const model = getChatGptModel();

  let res: Response;
  try {
    res = await fetch(completionsUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        temperature,
      }),
    });
  } catch (err: any) {
    return { ok: false, status: "provider_error", message: `Network error reaching OpenAI: ${err?.message}` };
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    let reason = detail.slice(0, 300);
    try {
      reason = JSON.parse(detail)?.error?.message ?? reason;
    } catch {
      // keep raw text
    }
    return {
      ok: false,
      status: "provider_error",
      message: `OpenAI returned ${res.status} for model ${model}: ${reason}`,
    };
  }

  const payload = await res.json().catch(() => null);
  const content = payload?.choices?.[0]?.message?.content;
  if (!content) return { ok: false, status: "parse_error", message: "OpenAI returned an empty completion." };

  try {
    return { ok: true, data: JSON.parse(content) as T, model };
  } catch (err: any) {
    return { ok: false, status: "parse_error", message: `Model returned invalid JSON: ${err?.message}` };
  }
}
