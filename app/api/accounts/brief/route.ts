import { NextResponse } from "next/server";
import type { AccountBrief, GroundedFact, ResolvedClaim, SignalScanResult } from "@/types";
import type { EvidenceCounts } from "@/lib/icp";
import { deterministicEnvelope, failEnvelope, jsonEnvelope, okEnvelope, toLead, asStringArray, domainOf } from "@/lib/agents";
import { nextBestAction } from "@/lib/rules";
import { getChatGptKey, PRIMARY_KEY_NAME, requestChatGptJson } from "@/lib/chatgpt";
import type { ContactResolution } from "@/lib/verification";

export const runtime = "nodejs";
export const maxDuration = 30;

const AGENT = "Account Brief / Pre-Call Agent";

interface ModelBrief {
  whyNow?: string;
  risks?: unknown;
  openQuestions?: unknown;
  callPlan?: unknown;
}

export async function GET() {
  return NextResponse.json({
    status: "ok",
    agent: AGENT,
    provider: getChatGptKey() ? PRIMARY_KEY_NAME : "deterministic",
    method: "brief assembled from the stored record plus verification evidence; a model only arranges it",
    writesRecords: false,
  });
}

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return jsonEnvelope(failEnvelope<AccountBrief>(AGENT, "bad_request", "Body must be JSON."), { status: 400 });
  }

  const lead = toLead(body?.lead ?? body?.account);
  if (!lead) {
    return jsonEnvelope(failEnvelope<AccountBrief>(AGENT, "bad_request", "Send { lead: { ... } }."), { status: 400 });
  }

  const resolution: ContactResolution | null =
    body?.resolution && typeof body.resolution === "object" ? (body.resolution as ContactResolution) : null;
  const counts: EvidenceCounts | undefined =
    body?.evidence && typeof body.evidence === "object" ? body.evidence : undefined;
  const signals: SignalScanResult | null = body?.signals && typeof body.signals === "object" ? (body.signals as SignalScanResult) : null;
  const claims: ResolvedClaim[] = Array.isArray(body?.claims) ? body.claims : [];
  const approvedFacts: GroundedFact[] = Array.isArray(body?.facts)
    ? body.facts
        .filter((f: any) => f?.verified !== false)
        .map((f: any) => ({ id: String(f.id ?? ""), field: String(f.field ?? ""), value: String(f.value ?? "").slice(0, 300), source: String(f.source ?? "crm.record") }))
    : [];

  const declinedFacts: string[] = Array.isArray(body?.facts)
    ? body.facts
        .filter((f: any) => f?.verified === false)
        .map((f: any) => `${String(f.field ?? "field")}: ${String(f.value ?? "").slice(0, 120)} — on the record but not approved as a fact to state.`)
    : [];

  const snapshot = [
    lead.company || "No company name on record",
    lead.name ? `${lead.name}${lead.title ? ` — ${lead.title}` : ""}` : "No person named",
    lead.niche ? `Niche: ${lead.niche}` : "Niche not recorded",
    lead.location ? `Location: ${lead.location}` : "Location not recorded",
    domainOf(lead) ? `Domain: ${domainOf(lead)}` : "No website or matching email domain",
    `Stage: ${lead.stage}`,
    lead.dealValue > 0 ? `Logged value: ${lead.currency || "NGN"} ${lead.dealValue.toLocaleString()}` : "No deal value logged",
  ];

  const whatWeKnow = approvedFacts
    .filter((f) => f.value)
    .map((f) => `${f.field}: ${f.value} (from ${f.source})`);

  if (resolution) {
    resolution.evidence
      .filter((e) => e.state === "verified")
      .forEach((e) => whatWeKnow.push(`${e.field}: ${e.claim} — ${e.detail}`));
  }

  const whatIsUnproven = [
    ...declinedFacts,
    ...resolution?.evidence.filter((e) => e.state !== "verified").map((e) => `${e.field}: ${e.claim} — ${e.state}. ${e.detail}`) ?? [],
    ...claims.filter((c) => c.disposition !== "write").map((c) => `${c.field}: ${c.claim} (${c.state}${c.sources.length ? `, ${c.sources.length} source(s)` : ", no source"})`),
  ].slice(0, 12);

  const citedSignals = signals?.signals?.filter((s) => s.status === "cited") ?? [];
  const whyNowFallback =
    citedSignals.length > 0
      ? `Search-backed activity: ${citedSignals.slice(0, 3).map((s) => `${s.kind} — ${s.summary}${s.sourceUri ? ` (${s.sourceDomain})` : ""}`).join("; ")}.`
      : signals
        ? `${signals.account} shows ${signals.citedCount} search-backed signal(s). No recent public activity was found, so the reason to call is your own read of the account, not an event.`
        : "No Buying-Signal Monitor run is stored for this account, so nothing here claims an event happened. Treat the timing as your judgement.";

  const risksFallback = [
    ...(resolution?.blockers ?? []),
    ...claims.filter((c) => c.state === "contradicted").map((c) => `Contradicted: ${c.claim}`),
    ...(counts && counts.contradicted > 0 ? [`${counts.contradicted} contradicted check(s) on this record.`] : []),
    ...(lead.phone && !resolution ? ["Phone has not been checked by the Contact Resolution agent."] : []),
  ].slice(0, 8);

  const openQuestionsFallback = [
    !lead.name ? "Who actually makes this decision, and what is their title?" : null,
    !lead.dealValue ? "What would they pay, and who signs the release?" : null,
    !lead.niche ? "What are they buying today that we could support?" : null,
    !resolution ? "Has this contact route been verified at all?" : null,
    lead.stage === "new" ? "Why now — what changed for them this quarter?" : "What happens to them if nothing changes?",
    "What does success look like in their words, not ours?",
  ].filter((q): q is string => Boolean(q));

  const suggestion = nextBestAction({ lead, evidence: counts, signals: signals ? { momentumScore: signals.momentumScore, hiringPosts: signals.hiringPosts, fundingEvents: signals.fundingEvents, techStack: signals.techStack } : null });

  const ruleBrief: AccountBrief = {
    account: lead.company || lead.name || "Unnamed account",
    snapshot,
    whatWeKnow: whatWeKnow.length ? whatWeKnow.slice(0, 10) : ["Nothing on this record has been verified yet. Start by confirming the contact route."],
    whatIsUnproven,
    whyNow: whyNowFallback,
    risks: risksFallback.length ? risksFallback : ["No blockers were reported by the verification agents."],
    openQuestions: openQuestionsFallback,
    callPlan: [
      "Open by naming the one thing you actually know about them, and say where you learned it.",
      "Ask the first open question above and stop talking.",
      "If a contact route is unproven, confirm spelling and preferred channel before the call ends.",
      "Close on a specific next step with a date, not 'let's talk soon'.",
    ],
    suggestedNextStep: `${suggestion.action} (${suggestion.effortMinutes} min) — ${suggestion.effect}`,
  };

  if (!getChatGptKey()) {
    return jsonEnvelope(
      deterministicEnvelope<AccountBrief>(
        AGENT,
        ruleBrief,
        `Built from the stored record and the verification agents only. Add ${PRIMARY_KEY_NAME} in Vercel to have ChatGPT rewrite the narrative sections — it will still be restricted to the approved facts listed above. Nothing was invented to fill a gap.`
      )
    );
  }

  const systemPrompt = `You are the Account Brief / Pre-Call Agent for a Nigerian outbound sales team. You prepare a rep for one conversation.

Hard limits:
- Use only the approved facts, evidence items and signals in the payload. Every other field is unknown: say it is unknown instead of filling it.
- Do not invent revenue, headcount, funding, client names, case studies, percentages or dates.
- Do not flatter. If the evidence is thin, the brief must say the evidence is thin.
- Mark any statement that came from an unverified or contradicted item as unverified in the sentence itself.

JSON only:
{ "whyNow": "two sentences max", "risks": ["..."], "openQuestions": ["..."], "callPlan": ["4-6 concrete moves, in order"] }`;

  const userPrompt = JSON.stringify(
    {
      record: { company: lead.company, person: lead.name, title: lead.title, niche: lead.niche, location: lead.location, stage: lead.stage, notes: lead.notes.slice(0, 800), tags: lead.tags },
      approvedFacts,
      verifiedEvidence: resolution?.evidence.filter((e) => e.state === "verified") ?? [],
      unverifiedEvidence: resolution?.evidence.filter((e) => e.state !== "verified") ?? [],
      blockers: resolution?.blockers ?? [],
      webClaims: claims.map((c) => ({ field: c.field, claim: c.claim, state: c.state, sources: c.sources.map((s) => s.uri) })),
      citedSignals,
    },
    null,
    1
  );

  const answer = await requestChatGptJson<ModelBrief>(systemPrompt, userPrompt, 0.3);

  if (!answer.ok) {
    if (answer.status === "no_key") {
      return jsonEnvelope(failEnvelope<AccountBrief>(AGENT, "no_key", answer.message));
    }
    return jsonEnvelope(
      okEnvelope<AccountBrief>(
        AGENT,
        "deterministic",
        ruleBrief,
        `ChatGPT did not answer (${answer.message}). The brief below is the rule-based version, built only from stored data.`
      )
    );
  }

  const merged: AccountBrief = {
    ...ruleBrief,
    whyNow: String(answer.data?.whyNow || ruleBrief.whyNow).slice(0, 600),
    risks: asStringArray(answer.data?.risks, 8).length ? asStringArray(answer.data?.risks, 8) : ruleBrief.risks,
    openQuestions: asStringArray(answer.data?.openQuestions, 8).length ? asStringArray(answer.data?.openQuestions, 8) : ruleBrief.openQuestions,
    callPlan: asStringArray(answer.data?.callPlan, 6).length ? asStringArray(answer.data?.callPlan, 6) : ruleBrief.callPlan,
  };

  return jsonEnvelope(
    okEnvelope<AccountBrief>(
      AGENT,
      "chatgpt",
      merged,
      `ChatGPT (${answer.model}) arranged the narrative; every line still traces to the record, the verification agents or a cited search result. Snapshot, unproven list and the next step are computed, not written by the model.`
    )
  );
}
