import { NextRequest } from "next/server";
import type { CampaignStep, Lead } from "@/types";
import { badRequest, deterministicEnvelope, jsonEnvelope, okEnvelope, failEnvelope, toLead } from "@/lib/agents";
import { requestChatGptJson } from "@/lib/chatgpt";
import { decideChannel, type OutboundChannel } from "@/lib/consent";
import { stripCitations, type FactCandidate } from "@/lib/outreach-facts";

const AGENT = "campaign-writer";

const STEP_KINDS = ["email", "call", "whatsapp", "linkedin", "review"] as const;

interface DraftData {
  stepId: string;
  kind: string;
  leadId: string;
  subject: string | null;
  body: string;
  usedFactIds: string[];
  droppedClaims: string[];
  placeholders: string[];
  channelAllowed: boolean;
  channelReason: string;
  sent: false;
}

interface PriorTouch {
  stepOrder: number;
  outcome: string;
  at: string;
}

function readFacts(value: unknown): FactCandidate[] {
  if (!Array.isArray(value)) return [];
  const out: FactCandidate[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const id = String(item.id ?? "").trim().slice(0, 120);
    const label = String(item.label ?? "").trim().slice(0, 80);
    const val = String(item.value ?? "").trim().slice(0, 300);
    if (!id || !val) continue;
    out.push({
      id,
      field: String(item.field ?? "").slice(0, 40),
      label: label || id,
      value: val,
      source: String(item.source ?? "rep tick").slice(0, 60),
      approvedByDefault: true,
    });
  }
  return out;
}

function readStep(value: any): CampaignStep | null {
  if (!value || typeof value !== "object") return null;
  const kind = STEP_KINDS.includes(value.kind) ? value.kind : "email";
  const order = Number(value.order);
  return {
    id: String(value.id ?? "step-1").slice(0, 40),
    order: Number.isFinite(order) ? Math.max(1, Math.round(order)) : 1,
    kind,
    label: String(value.label ?? "Follow-up").slice(0, 80),
    intent: String(value.intent ?? "").slice(0, 400),
    waitDays: Number.isFinite(Number(value.waitDays)) ? Math.max(0, Math.round(Number(value.waitDays))) : 3,
    rationale: value.rationale ? String(value.rationale).slice(0, 300) : undefined,
    source: "rules",
  };
}

function stepToChannel(kind: CampaignStep["kind"]): OutboundChannel | null {
  if (kind === "call") return "phone";
  if (kind === "whatsapp") return "whatsapp";
  if (kind === "email") return "email";
  return null;
}

function firstNameOf(lead: Lead): string {
  const raw = (lead.name || "").trim();
  if (!raw) return "there";
  return raw.split(/\s+/)[0].replace(/[^A-Za-z' -]/g, "").slice(0, 30) || "there";
}

/**
 * The no-model draft. It only ever uses facts the rep ticked, and it leaves the
 * specific, must-be-true-by-hand parts as visible placeholders instead of filling
 * them with plausible-sounding invention.
 */
function ruleDraft(args: { lead: Lead; step: CampaignStep; facts: FactCandidate[]; priors: PriorTouch[] }): {
  subject: string | null;
  body: string;
  usedFactIds: string[];
  placeholders: string[];
} {
  const { lead, step, facts, priors } = args;
  const pick = (field: string) => facts.find((f) => f.field === field);
  const company = pick("company");
  const niche = pick("niche");
  const place = pick("location");
  const usedFactIds = [company, niche, place].filter(Boolean).map((f) => f!.id);

  const what = company?.value || "your company";
  const where = place ? ` in ${place.value}` : "";
  const sector = niche ? ` the ${niche.value} space` : "what you do";
  const priorNote = priors.length > 0
    ? `I wrote on step ${priors[priors.length - 1].stepOrder} and have not heard back, so I will keep this short.`
    : "";

  const placeholders = [
    "[one specific, checkable thing about them - a job posting, a launch, a regulation in their sector]",
    "[the outcome you are proposing, in one sentence]",
    "[your name and one line of contact detail]",
  ];

  if (step.kind === "call" || step.kind === "whatsapp") {
    return {
      subject: null,
      body: [
        `${step.label} — ${firstNameOf(lead)} at ${what}`,
        "",
        `Aim: ${step.intent || "open a conversation."}`,
        `Opening line: "Hi ${firstNameOf(lead)}, I sent a note about ${sector}${where} - did it land in the wrong place?"`,
        `If they answer: one question about ${sector}, then a single ask. Do not read a script at them.`,
        "If it goes to voicemail: stop. Record the attempt, do not leave a pitch.",
        "",
        "Nothing here dials or messages anyone. This is a plan you carry to the phone.",
      ].join("\n"),
      usedFactIds,
      placeholders: ["[what you learned from the call]"],
    };
  }

  if (step.kind === "linkedin") {
    return {
      subject: null,
      body: [
        `Hi ${firstNameOf(lead)} — I am reaching out because of ${what}${where}.`,
        "[one line explaining why you are relevant to them specifically]",
        "[one question, no attachment, no pitch deck]",
      ].join("\n"),
      usedFactIds,
      placeholders,
    };
  }

  if (step.kind === "review") {
    return {
      body: [
        `Decision point on ${what}: ${step.intent || "decide whether this stays in the sequence."}`,
        priorNote,
        "Check the record, not the memory: what did they say, what is still unproven, and is this worth another touch at all?",
      ].join("\n").replace(/\n\n+/g, "\n"),
      subject: null,
      usedFactIds,
      placeholders: ["[your decision and the date]"],
    };
  }

  return {
    subject: `${what}${place ? ` - ${place.value.split(",")[0]}` : ""}`,
    body: [
      `Hi ${firstNameOf(lead)},`,
      "",
      priorNote,
      `I am writing because ${what}${where} sits in${sector} and we work with teams in that space.`,
      placeholders[0],
      "",
      `Aim of this step: ${step.intent || "get one honest answer about whether this is worth ten minutes."}`,
      placeholders[1],
      "",
      "If this is not relevant, say so and I will take you off the list.",
      "",
      placeholders[2],
    ]
      .filter(Boolean)
      .join("\n"),
    usedFactIds,
    placeholders,
  };
}

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return badRequest(AGENT, "Body must be JSON.");
  }

  const lead = toLead(body?.lead);
  if (!lead) return badRequest(AGENT, "A campaign message needs one contact record with an id or company.");

  const step = readStep(body?.step);
  if (!step) return badRequest(AGENT, "A step is required: which point in the sequence this message is.");

  const facts = readFacts(body?.approvedFacts);
  const priors: PriorTouch[] = Array.isArray(body?.priors)
    ? body.priors
        .filter((p: any) => p && typeof p === "object")
        .slice(0, 12)
        .map((p: any) => ({ stepOrder: Number(p.stepOrder) || 0, outcome: String(p.outcome).slice(0, 24), at: String(p.at) }))
    : [];

  const channel = stepToChannel(step.kind);
  const consentEntry = body?.consent && typeof body.consent === "object" ? body.consent[lead.id] : undefined;
  const decision = channel
    ? decideChannel(channel, { consent: consentEntry?.[channel], phone: lead.phone, email: lead.email, stage: lead.stage })
    : { channel: "email" as OutboundChannel, allowed: true, reason: "No calling channel involved in this step.", requires: null };

  if (!decision.allowed) {
    return jsonEnvelope(
      deterministicEnvelope<DraftData>(
        AGENT,
        {
          stepId: step.id,
          kind: step.kind,
          leadId: lead.id,
          subject: null,
          body: "",
          usedFactIds: [],
          droppedClaims: [],
          placeholders: [],
          channelAllowed: false,
          channelReason: decision.reason,
          sent: false,
        },
        `No copy was written: ${decision.reason}`
      )
    );
  }

  const fallback = ruleDraft({ lead, step, facts, priors });

  const model = await requestChatGptJson<{ subject?: string; body?: string; factIds?: unknown }>(
    "You write short follow-up messages for a B2B sales team. You may only state facts from the approved list you are given. Anything you cannot source from that list must be written as a bracketed placeholder for the rep to fill in. You never invent company facts, numbers, dates, client names or awards. You never claim a metric. You always include a way out for the reader.",
    JSON.stringify(
      {
        campaign: { name: String(body?.campaign?.name || "").slice(0, 120), purpose: String(body?.campaign?.purpose || "").slice(0, 400) },
        step: { order: step.order, kind: step.kind, label: step.label, intent: step.intent },
        contact: { company: lead.company, niche: lead.niche, location: lead.location, firstName: firstNameOf(lead) },
        approvedFacts: facts.map((f) => ({ id: f.id, label: f.label, value: f.value })),
        history: priors,
        rules: [
          "Under 120 words.",
          "Only approvedFacts may be stated as fact; everything else is a [bracketed placeholder].",
          "Every placeholder you use must also appear in the returned placeholders note.",
          "Plain text, no markdown, no exclamation marks.",
          "Return { subject, body, factIds } where factIds lists the approved fact ids you actually used.",
        ],
      },
      null,
      2
    ),
    0.4
  );

  if (!model.ok) {
    const reason =
      model.status === "no_key"
        ? "Skeleton draft only — no ChatGPT key, so this was assembled from the ticked facts and left with placeholders."
        : `Skeleton draft only — ChatGPT could not be reached (${model.message}).`;
    return jsonEnvelope(
      deterministicEnvelope<DraftData>(
        AGENT,
        {
          stepId: step.id,
          kind: step.kind,
          leadId: lead.id,
          subject: fallback.subject,
          body: fallback.body,
          usedFactIds: fallback.usedFactIds,
          droppedClaims: [],
          placeholders: fallback.placeholders,
          channelAllowed: true,
          channelReason: decision.reason,
          sent: false,
        },
        reason
      )
    );
  }

  const rawBody = stripCitations(String(model.data?.body || "")).slice(0, 2500);
  if (!rawBody.trim()) {
    return jsonEnvelope(
      deterministicEnvelope<DraftData>(
        AGENT,
        {
          stepId: step.id,
          kind: step.kind,
          leadId: lead.id,
          subject: fallback.subject,
          body: fallback.body,
          usedFactIds: fallback.usedFactIds,
          droppedClaims: ["The model returned an empty body, so the rules draft was kept."],
          placeholders: fallback.placeholders,
          channelAllowed: true,
          channelReason: decision.reason,
          sent: false,
        },
        "The model returned nothing usable, so the rules draft is shown instead."
      )
    );
  }

  const approvedIds = new Set(facts.map((f) => f.id));
  const claimedUnapproved = Array.isArray(model.data?.factIds)
    ? model.data!.factIds.map((f) => String(f)).filter((f) => !approvedIds.has(f))
    : [];

  const droppedClaims: string[] = claimedUnapproved.map((id) => `it claimed to use "${id}", which is not on the approved list`);

  // A number in the copy must exist somewhere in the ticked facts or the record,
  // otherwise it is an invented metric, headcount or date.
  const knownText = [...facts.map((f) => f.value), lead.company, lead.niche, lead.location].join(" ").toLowerCase();
  const inventedNumbers = (rawBody.match(/\b\d[\d.,]*\b/g) || []).filter((n) => !knownText.includes(n.toLowerCase()));
  if (inventedNumbers.length > 0) {
    droppedClaims.push(`numbers not present in any ticked fact: ${Array.from(new Set(inventedNumbers)).slice(0, 6).join(", ")}`);
  }

  return jsonEnvelope(
    okEnvelope(
      AGENT,
      "chatgpt",
      {
        stepId: step.id,
        kind: step.kind,
        leadId: lead.id,
        subject: String(model.data?.subject || "").slice(0, 150) || null,
        body: rawBody,
        usedFactIds: facts.filter((f) => rawBody.toLowerCase().includes(f.value.toLowerCase())).map((f) => f.id),
        droppedClaims,
        placeholders: (rawBody.match(/\[[^\]]{3,160}\]/g) || []).slice(0, 8),
        channelAllowed: true,
        channelReason: decision.reason,
        sent: false,
      },
      droppedClaims.length > 0
        ? `Draft kept, but flagged: ${droppedClaims.join("; ")}. Nothing was sent.`
        : "Draft written from ticked facts only. Nothing was sent — copy it out or hand it to your mail app yourself."
    )
  );
}

export async function GET() {
  return jsonEnvelope(
    failEnvelope<DraftData | null>(
      AGENT,
      "no_key",
      "POST a contact, a step and the facts you have ticked. This writes draft copy for a campaign step; it does not send anything."
    )
  );
}
