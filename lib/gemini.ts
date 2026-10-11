const KEY_NAMES = ["GEMINI_API_KEY", "GOOGLE_API_KEY", "NEXT_PUBLIC_GEMINI_API_KEY"] as const;

export const PRIMARY_GEMINI_KEY_NAME = "GEMINI_API_KEY";

/** Same model order the chatbox uses, so one key configures both surfaces. */
const MODELS = ["gemini-3.8-flash", "gemini-flash-latest"];

export function getGeminiKey(): string | null {
  for (const name of KEY_NAMES) {
    const raw = process.env[name];
    if (raw && raw.trim().length > 0) return raw.trim();
  }
  return null;
}

export function missingGeminiKeyMessage(agent: string): string {
  return `${agent} needs live web evidence, and no Gemini key is configured. Add ${PRIMARY_GEMINI_KEY_NAME} (from aistudio.google.com) to Vercel Project Settings -> Environment Variables with Production scope, then redeploy. Checked names: ${KEY_NAMES.join(", ")}.`;
}

function modelsToTry(): string[] {
  const override = process.env.GEMINI_MODEL?.trim();
  return override ? [override, ...MODELS.filter((m) => m !== override)] : MODELS;
}

export interface GroundingSource {
  uri: string;
  title?: string;
}

export type GeminiResult<T> =
  | { ok: true; data: T; model: string; sources: GroundingSource[]; grounded: boolean }
  | { ok: false; status: "no_key" | "provider_error" | "parse_error"; message: string };

export interface GeminiOptions {
  temperature?: number;
  maxOutputTokens?: number;
  /** Ask Gemini to answer from live Google Search results and return the citations it used. */
  grounding?: boolean;
}

/**
 * Google has returned grounding citations under three different shapes over time.
 * Collect from all of them so a silent rename does not look like "no sources".
 */
function collectSources(candidate: any): GroundingSource[] {
  const out: GroundingSource[] = [];
  const push = (uri?: string, title?: string) => {
    if (!uri || typeof uri !== "string") return;
    if (!/^https?:\/\//i.test(uri)) return;
    if (out.some((s) => s.uri === uri)) return;
    out.push({ uri, title: typeof title === "string" && title.trim() ? title.trim() : undefined });
  };

  const meta = candidate?.groundingMetadata || {};
  (meta.groundingChunks || []).forEach((c: any) => push(c?.web?.uri, c?.web?.title));
  (meta.urlContexts || []).forEach((c: any) => push(c?.reference?.uri, c?.reference?.title));
  (meta.searchEntryPointMetadata?.urlCitationOutputList || []).forEach((c: any) =>
    push(c?.urlCitationMetadata?.uri, c?.urlCitationMetadata?.displayName)
  );
  (candidate?.groundingSupportChunks || []).forEach((c: any) => push(c?.web?.uri, c?.web?.title));
  return out;
}

function textOf(candidate: any): string {
  const parts = candidate?.content?.parts || [];
  return parts
    .map((p: any) => (typeof p?.text === "string" ? p.text : ""))
    .join("")
    .trim();
}

/** Models asked for JSON still wrap it in prose or fences sometimes; take the first balanced object/array. */
export function extractJsonText(raw: string): string | null {
  const unfenced = raw.replace(/^\s*```(?:json)?/i, "").replace(/```\s*$/, "");
  const start = unfenced.search(/[{[]/);
  if (start === -1) return null;
  const opener = unfenced[start];
  const closer = opener === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < unfenced.length; i++) {
    const ch = unfenced[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === opener) depth++;
    else if (ch === closer) {
      depth--;
      if (depth === 0) return unfenced.slice(start, i + 1);
    }
  }
  return null;
}

function baseUrl(): string {
  const base = process.env.GEMINI_BASE_URL?.trim().replace(/\/+$/, "");
  return base || "https://generativelanguage.googleapis.com";
}

export async function requestGeminiJson<T>(
  systemPrompt: string,
  userPrompt: string,
  options: GeminiOptions = {}
): Promise<GeminiResult<T>> {
  const apiKey = getGeminiKey();
  if (!apiKey) return { ok: false, status: "no_key", message: missingGeminiKeyMessage("This agent") };

  const { temperature = 0.2, maxOutputTokens = 3000, grounding = false } = options;
  let lastError = "";

  for (const model of modelsToTry()) {
    const endpoint = `${baseUrl()}/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const body: Record<string, any> = {
      contents: [
        {
          role: "user",
          parts: [{ text: `${systemPrompt}\n\n---\n\n${userPrompt}\n\nReply with JSON only.` }],
        },
      ],
      generationConfig: {
        temperature,
        maxOutputTokens,
        responseMimeType: "application/json",
      },
    };
    if (grounding) body.tools = [{ google_search: {} }];

    let res: Response;
    try {
      res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch (err: any) {
      lastError = `Network error reaching Gemini: ${err?.message}`;
      continue;
    }

    const payload = await res.json().catch(() => null);
    if (!res.ok) {
      lastError = `Gemini returned ${res.status} for model ${model}: ${
        payload?.error?.message || "no detail"
      }`;
      // A key that cannot see any of these models will fail on all of them; the message is clearer once we know it is an auth problem.
      if (res.status === 401 || res.status === 403) {
        return { ok: false, status: "provider_error", message: lastError };
      }
      continue;
    }

    const candidate = payload?.candidates?.[0];
    const text = textOf(candidate);
    if (!text) {
      const blocked = payload?.promptFeedback?.blockReason;
      lastError = blocked
        ? `Gemini blocked the prompt (${blocked}).`
        : `Gemini model ${model} returned an empty completion.`;
      continue;
    }

    const jsonText = extractJsonText(text);
    if (!jsonText) {
      lastError = `Gemini model ${model} replied without JSON. First 200 chars: ${text.slice(0, 200)}`;
      continue;
    }

    try {
      return {
        ok: true,
        data: JSON.parse(jsonText) as T,
        model,
        sources: collectSources(candidate),
        grounded: grounding,
      };
    } catch (err: any) {
      return { ok: false, status: "parse_error", message: `Gemini returned invalid JSON: ${err?.message}` };
    }
  }

  return {
    ok: false,
    status: "provider_error",
    message: lastError || "Gemini did not return a usable answer.",
  };
}
