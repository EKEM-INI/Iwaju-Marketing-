import { NextRequest } from "next/server";
import type { Lead } from "@/types";
import { MAX_RECORDS, failEnvelope, jsonEnvelope, okEnvelope, toLead } from "@/lib/agents";
import { hasAnyWriterKey, missingWriterKeyMessage, providerLabel, writeWithFallback } from "@/lib/outreach-writer";
import { decideChannel } from "@/lib/consent";
import { stripCitations, factsFromLead } from "@/lib/outreach-facts";

const AGENT = "campaign-batch-writer";

/** Two drafts this similar are the same email wearing different company names. */
const NEAR_DUPLICATE_THRESHOLD = 0.8;
const CONCURRENT_CALLS = 3;

interface BatchInput {
  campaign: { id: string; name: string; purpose: string };
  leads: Lead[];
  consent: Record<string, any>;
}

interface GeneratedDraft {
  leadId: string;
  company: string;
  to: string;
  subject: string;
  body: string;
  usedFactIds: string[];
  inventedNumbers: string[];
  nearDuplicateOf: string | null;
  modelProvider: "chatgpt" | "gemini";
  modelName: string;
  provider: string;
  sent: false;
}

interface SkippedContact {
  leadId: string;
  company: string;
  reason: string;
}

interface BatchResult {
  campaign: { id: string; name: string; purpose: string };
  generated: GeneratedDraft[];
  skipped: SkippedContact[];
  stats: {
    considered: number;
    drafted: number;
    nearDuplicates: number;
    flaggedForInventedNumbers: number;
    skipped: number;
    truncated: boolean;
  };
  sent: false;
}

function systemPrompt(senderCompany: string): string {
  return `You are the Fact-Grounded Cold Outreach Writer for ${senderCompany}.

You may ONLY state facts contained in the APPROVED FACTS list for that one recipient. Every specific claim must be traceable to one of those facts.

Hard rules:
1. Never invent client results, revenue figures, pipeline numbers, timeframes, case studies, benchmarks, awards or named third parties.
2. Never imply the recipient has a problem you were not told about.
3. Write for this one recipient only. Do not write a template: use their company, sector and place in the opening line so the copy could not be pasted onto someone else unchanged.
4. Keep the body under 90 words. No "I hope this finds you well".
5. Include a plain opt-out line.
6. Plain text, no markdown, no exclamation marks.
7. Return JSON only: { "subject": string, "body": string, "usedFactIds": string[] }.`;
}

function userPrompt(campaign: BatchInput["campaign"], lead: Lead, facts: { id: string; field: string; value: string }[]): string {
  const firstName = (lead.name || "").trim().split(/\s+/)[0] || "there";
  return `Campaign: ${campaign.name}${campaign.purpose ? ` — ${campaign.purpose}` : ""}

Recipient: ${firstName}${lead.title ? `, ${lead.title}` : ""}
Company: ${lead.company || "(unknown)"}

APPROVED FACTS (the only things you may state):
${facts.map((f) => `[${f.id}] ${f.field}: ${f.value}`).join("\n")}

Write the first touch of this campaign to this recipient.

Return { "subject", "body", "usedFactIds" }.`;
}

/** Word set without stopwords, for similarity only. */
function tokenSet(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3 && !STOPWORDS.has(w))
  );
}

const STOPWORDS = new Set([
  "with", "from", "have", "this", "that", "your", "ours", "would", "could", "should", "about", "because",
  "into", "them", "they", "there", "here", "what", "when", "which", "while", "thanks", "please", "best",
]);

function similarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  a.forEach((token) => {
    if (b.has(token)) shared += 1;
  });
  return shared / Math.min(a.size, b.size);
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  });
  await Promise.all(runners);
  return results;
}

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return jsonEnvelope(failEnvelope<null>(AGENT, "bad_request", "Body must be JSON."));
  }

  const campaign = {
    id: String(body?.campaign?.id ?? "").slice(0, 64),
    name: String(body?.campaign?.name ?? "Untitled campaign").slice(0, 120),
    purpose: String(body?.campaign?.purpose ?? "").slice(0, 400),
  };

  const rawLeads: unknown[] = Array.isArray(body?.leads) ? body.leads : [];
  const leads: Lead[] = rawLeads.map(toLead).filter((l): l is Lead => l !== null);
  if (leads.length === 0) {
    return jsonEnvelope(failEnvelope<null>(AGENT, "empty_input", "Send the contacts in this campaign: { leads: [...] }."));
  }

  const consentStore = body?.consent && typeof body.consent === "object" ? body.consent : {};
  const senderCompany = String(body?.senderCompany || "Iwaju Marketing").slice(0, 120);

  if (!hasAnyWriterKey()) {
    return jsonEnvelope(
      failEnvelope<null>(AGENT, "no_key", `${missingWriterKeyMessage()} Batch drafting does not fall back to shared template copy, because every contact would then receive the same email.`)
    );
  }

  const considered = leads.slice(0, MAX_RECORDS);
  const overCap = leads.length > MAX_RECORDS;

  const outcomes = await mapWithConcurrency(considered, CONCURRENT_CALLS, async (lead) => {
    if (lead.sourcedFrom === "demo") {
      return {
        kind: "skipped" as const,
        lead,
        writerCaused: false,
        reason: "Bundled demo record. Its address was never sourced from Apollo, so no draft is written for it.",
      };
    }

    const decision = decideChannel("email", {
      consent: consentStore[lead.id]?.email,
      phone: lead.phone,
      email: lead.email,
      stage: lead.stage,
    });

    if (!decision.allowed) {
      return { kind: "skipped" as const, lead, writerCaused: false, reason: `Email channel not open: ${decision.reason}` };
    }

    const facts = factsFromLead(lead).filter((f) => f.approvedByDefault);
    if (facts.length === 0) {
      return {
        kind: "skipped" as const,
        lead,
        writerCaused: false,
        reason:
          "No field on this record is safe to state without your tick — company, sector, location and website are all blank. Nothing was invented to fill the gap.",
      };
    }

    const answer = await writeWithFallback<{ subject?: string; body?: string; usedFactIds?: unknown }>(
      systemPrompt(senderCompany),
      userPrompt(campaign, lead, facts.map((f) => ({ id: f.id, field: f.field, value: f.value }))),
      0.6
    );

    if (!answer.ok) {
      return { kind: "skipped" as const, lead, writerCaused: true, reason: `No draft written: ${answer.message}` };
    }

    const rawBody = stripCitations(String(answer.data?.body || "")).trim();
    if (!rawBody) {
      return { kind: "skipped" as const, lead, writerCaused: true, reason: "The writer returned an empty body, so nothing was drafted." };
    }

    const approvedText = facts.map((f) => f.value.toLowerCase()).join(" ");
    const inventedNumbers = Array.from(new Set(rawBody.match(/\b\d[\d.,]*\b/g) || [])).filter(
      (n) => !approvedText.includes(n.toLowerCase())
    );

    const usedFactIds = facts.filter((f) => rawBody.toLowerCase().includes(f.value.toLowerCase())).map((f) => f.id);

    return {
      kind: "draft" as const,
      lead,
      draft: {
        leadId: lead.id,
        company: lead.company,
        to: lead.email,
        subject: stripCitations(String(answer.data?.subject || "")).slice(0, 150),
        body: rawBody.slice(0, 2000),
        usedFactIds,
        inventedNumbers,
        nearDuplicateOf: null as string | null,
        modelProvider: answer.modelProvider,
        modelName: answer.modelName,
        provider: providerLabel(answer.modelProvider, answer.modelName),
        sent: false as const,
      },
    };
  });

  const generated: GeneratedDraft[] = [];
  const skipped: SkippedContact[] = [];
  const writerFailures: string[] = [];

  for (const outcome of outcomes) {
    if (outcome.kind === "skipped") {
      skipped.push({ leadId: outcome.lead.id, company: outcome.lead.company, reason: outcome.reason });
      if (outcome.writerCaused) writerFailures.push(outcome.reason);
      continue;
    }
    const draft = outcome.draft;
    const tokens = tokenSet(`${draft.subject} ${draft.body}`);
    const twin = generated.find((g) => similarity(tokens, tokenSet(`${g.subject} ${g.body}`)) >= NEAR_DUPLICATE_THRESHOLD);
    if (twin) draft.nearDuplicateOf = twin.leadId;
    generated.push(draft);
  }

  const writersUsed = Array.from(new Set(generated.map((g) => g.provider)));
  const flagged = generated.filter((g) => g.inventedNumbers.length > 0).length;
  const duplicates = generated.filter((g) => g.nearDuplicateOf).length;
  const writerFailure = writerFailures[0] || "";

  const payload: BatchResult = {
    campaign,
    generated,
    skipped,
    stats: {
      considered: considered.length,
      drafted: generated.length,
      nearDuplicates: duplicates,
      flaggedForInventedNumbers: flagged,
      skipped: skipped.length,
      truncated: overCap,
    },
    sent: false,
  };

  const note = [
    `${generated.length} unique draft(s) written by ${writersUsed.join(" + ") || "no model"}, ${skipped.length} contact(s) skipped with a reason.`,
    duplicates > 0 ? `${duplicates} draft(s) read as near-duplicates of an earlier one — reword before use.` : "",
    flagged > 0 ? `${flagged} draft(s) carry numbers no approved fact supports.` : "",
    overCap ? `Only the first ${MAX_RECORDS} of ${leads.length} contacts were worked on.` : "",
    "Nothing was sent, and nothing will be sent from here.",
  ]
    .filter(Boolean)
    .join(" ");

  return jsonEnvelope(
    writersUsed.length === 0
      ? {
          ...failEnvelope<BatchResult>(
            AGENT,
            writerFailure ? "provider_error" : "empty_input",
            writerFailure
              ? `No draft was written for any of the ${considered.length} contact(s): ${writerFailure}`
              : `No draft was written: every contact was skipped for a stated reason.`,
            "none"
          ),
          note,
          data: payload,
        }
      : okEnvelope(AGENT, writersUsed.join(" + "), payload, note)
  );
}

export async function GET() {
  return jsonEnvelope(
    failEnvelope<null>(
      AGENT,
      "no_key",
      "POST { campaign, leads, consent } to draft one grounded email per contact. It writes; it does not send."
    )
  );
}
