import { NextRequest } from "next/server";
import type { CampaignChannel, CampaignStep, ConsentRecord, Lead } from "@/types";
import {
  MAX_RECORDS,
  badRequest,
  deterministicEnvelope,
  emptyInput,
  jsonEnvelope,
  okEnvelope,
  failEnvelope,
  toLeads,
} from "@/lib/agents";
import { requestChatGptJson } from "@/lib/chatgpt";
import { decideChannel, type OutboundChannel } from "@/lib/consent";
import { defaultSteps } from "@/lib/campaigns";

const AGENT = "campaign-planner";

const CHANNELS: CampaignChannel[] = ["email", "phone", "whatsapp", "linkedin", "mixed"];
const STEP_KINDS = ["email", "call", "whatsapp", "linkedin", "review"] as const;

interface ContactCheck {
  considered: number;
  reachableByEmail: number;
  blockedForNoEmail: number;
  needingConsent: number;
  callReady: number;
  whatsappReady: number;
}

interface CampaignPlan {
  channel: CampaignChannel;
  steps: CampaignStep[];
  contactCheck: ContactCheck;
  warnings: string[];
  assumptions: string[];
}

type ConsentStore = Record<string, Partial<Record<OutboundChannel, ConsentRecord>>>;

function readConsent(value: unknown): ConsentStore {
  if (!value || typeof value !== "object") return {};
  const out: ConsentStore = {};
  for (const [leadId, channels] of Object.entries(value as Record<string, unknown>)) {
    if (!channels || typeof channels !== "object") continue;
    out[leadId.slice(0, 64)] = channels as Partial<Record<OutboundChannel, ConsentRecord>>;
  }
  return out;
}

function checkContacts(leads: Lead[], consent: ConsentStore): ContactCheck {
  const check: ContactCheck = {
    considered: leads.length,
    reachableByEmail: 0,
    blockedForNoEmail: 0,
    needingConsent: 0,
    callReady: 0,
    whatsappReady: 0,
  };
  for (const lead of leads) {
    const email = decideChannel("email", {
      consent: consent[lead.id]?.email,
      email: lead.email,
      stage: lead.stage,
    });
    const phone = decideChannel("phone", {
      consent: consent[lead.id]?.phone,
      phone: lead.phone,
      email: lead.email,
      stage: lead.stage,
    });
    const whatsapp = decideChannel("whatsapp", {
      consent: consent[lead.id]?.whatsapp,
      phone: lead.phone,
      email: lead.email,
      stage: lead.stage,
    });
    if (email.allowed) check.reachableByEmail += 1;
    else if (!lead.email) check.blockedForNoEmail += 1;
    else check.needingConsent += 1;
    if (phone.allowed) check.callReady += 1;
    if (whatsapp.allowed) check.whatsappReady += 1;
  }
  return check;
}

function stepChannel(kind: CampaignStep["kind"]): OutboundChannel | null {
  if (kind === "call") return "phone";
  if (kind === "whatsapp") return "whatsapp";
  if (kind === "email") return "email";
  return null;
}

/**
 * The cadence ladder. Rules decide the shape; the model is only ever allowed to
 * re-word intent and nudge the spacing inside a guard rail.
 */
function buildPlan(input: {
  channel: CampaignChannel;
  purpose: string;
  leads: Lead[];
  consent: ConsentStore;
}): { plan: CampaignPlan; readyForModel: CampaignStep[] } {
  const check = checkContacts(input.leads, input.consent);
  const warnings: string[] = [];
  const steps = defaultSteps(input.channel);

  const adjusted: CampaignStep[] = steps.map((step) => {
    const channel = stepChannel(step.kind);
    if (!channel || channel === "email") return step;

    const ready = channel === "phone" ? check.callReady : check.whatsappReady;
    if (ready > 0) {
      return {
        ...step,
        rationale: `${step.rationale} ${ready} of ${check.considered} contacts may be approached on ${channel} right now; the rest need recorded consent first.`,
      };
    }

    warnings.push(
      `Step ${step.order} (${step.label}) was switched to email: no contact in this list may be approached on ${channel} yet, because consent is missing or the number is not a sourced one.`
    );
    return {
      ...step,
      kind: "email",
      label: step.kind === "call" ? "Follow-up email instead of a call" : "Follow-up email instead of WhatsApp",
      intent: `${step.intent} Delivered by email because nothing here gives you permission to use ${channel} on these contacts.`,
      rationale: `Replaced automatically. ${channel === "phone" ? "Calls" : "WhatsApp"} need a live consent record; open the Reachability tab in the pipeline workbench to record one.`,
    };
  });

  if (check.considered === 0) {
    warnings.push("No contacts were supplied, so this is the generic shape of the sequence.");
  }
  if (check.blockedForNoEmail > 0) {
    warnings.push(`${check.blockedForNoEmail} contact(s) have no email at all — an email sequence cannot reach them and the record needs contact resolution first.`);
  }
  if (check.needingConsent > 0) {
    warnings.push(`${check.needingConsent} contact(s) sit on a consumer mailbox, which is personal data: they need a reply or a recorded opt-in before cold mail.`);
  }
  if (check.considered > 0 && check.considered <= 3) {
    warnings.push("Small list. Four touches on three people is easy to read as spam — consider stopping the sequence after step 2 and doing the third step by hand.");
  }

  return {
    plan: {
      channel: input.channel,
      steps: adjusted,
      contactCheck: check,
      warnings,
      assumptions: [
        "Spacing is a stated default, not a measured benchmark — this app has no reply-rate data.",
        "Nothing is sent by this planner. It only proposes the order of work you do.",
        "A step only counts as done when you record it on the campaign page.",
      ],
    },
    readyForModel: adjusted,
  };
}

function sanitiseModelSteps(raw: unknown, fallback: CampaignStep[]): CampaignStep[] {
  if (!Array.isArray(raw) || raw.length === 0) return fallback;
  const out: CampaignStep[] = [];
  raw.slice(0, 6).forEach((item, i) => {
    if (!item || typeof item !== "object") return;
    const base = fallback[i] || fallback[fallback.length - 1];
    const kind = STEP_KINDS.includes((item as any).kind) ? ((item as any).kind as CampaignStep["kind"]) : base.kind;
    const wait = Number((item as any).waitDays);
    const label = typeof item.label === "string" ? item.label.trim().slice(0, 60) : base.label;
    const intent = typeof item.intent === "string" ? item.intent.trim().slice(0, 320) : base.intent;
    if (!label || !intent) return;
    out.push({
      id: base.id,
      order: i + 1,
      kind,
      label,
      intent,
      // A model may not compress the cadence below a day or stretch it past a month.
      waitDays: Number.isFinite(wait) ? Math.max(0, Math.min(30, Math.round(wait))) : base.waitDays,
      rationale: typeof item.rationale === "string" ? item.rationale.trim().slice(0, 300) : base.rationale,
      source: "chatgpt",
    });
  });
  return out.length > 0 ? out : fallback;
}

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return badRequest(AGENT, "Body must be JSON.");
  }

  const channel = CHANNELS.includes(body?.channel) ? (body.channel as CampaignChannel) : "email";
  const purpose = typeof body?.purpose === "string" ? body.purpose.trim().slice(0, 500) : "";
  if (!purpose) return badRequest(AGENT, "A campaign needs a purpose before a sequence can be planned.");

  const { leads } = toLeads(body?.leads, MAX_RECORDS);
  if (leads.length === 0 && Array.isArray(body?.leads) && body.leads.length > 0) {
    return emptyInput(AGENT, "None of the supplied records had an id or a company, so nothing could be checked.");
  }
  const consent = readConsent(body?.consent);

  const { plan, readyForModel } = buildPlan({ channel, purpose, leads, consent });

  const model = await requestChatGptJson<{ steps: unknown }>(
    "You plan outbound B2B follow-up sequences for a small sales team. You never invent facts about a company, you never claim a metric, and you never propose a channel the permission check has blocked. You only re-word step intent and adjust spacing.",
    JSON.stringify(
      {
        campaignPurpose: purpose,
        channel,
        contactCheck: plan.contactCheck,
        permissionNotes: plan.warnings,
        steps: readyForModel.map((s) => ({ order: s.order, kind: s.kind, label: s.label, intent: s.intent, waitDays: s.waitDays })),
        sampleOfContacts: leads.slice(0, 8).map((l) => ({
          company: l.company,
          niche: l.niche,
          location: l.location,
          stage: l.stage,
          hasCorporateEmail: Boolean(l.email),
        })),
        instructions:
          "Return { steps: [...] } with the same number of steps, same order and same kind values. Rewrite label and intent to fit this specific campaign purpose. waitDays is days after the previous step: first step is 0, others between 1 and 30. Add a one-line rationale per step. Do not mention any fact about the contacts that is not in sampleOfContacts.",
      },
      null,
      2
    ),
    0.3
  );

  if (!model.ok) {
    const reason =
      model.status === "no_key"
        ? "Rules-based plan only — no ChatGPT key, so nothing was re-worded."
        : `Rules-based plan only — ChatGPT could not be reached (${model.message}).`;
    return jsonEnvelope(deterministicEnvelope(AGENT, plan, reason));
  }

  const steps = sanitiseModelSteps(model.data?.steps, plan.steps);
  const kindsChanged = steps.some((s, i) => s.kind !== plan.steps[i]?.kind);
  if (kindsChanged) {
    return jsonEnvelope(
      deterministicEnvelope(
        AGENT,
        { ...plan, steps: plan.steps },
        "ChatGPT tried to move a step onto a different channel. Channel choice belongs to the permission check, so the rules plan was kept."
      )
    );
  }

  return jsonEnvelope(
    okEnvelope(
      AGENT,
      "chatgpt",
      { ...plan, steps },
      `ChatGPT re-wrote the step wording for "${purpose}". Spacing stayed inside the 0-30 day guard rail and no channel was changed.`
    )
  );
}

export async function GET() {
  return jsonEnvelope(
    failEnvelope<CampaignPlan | null>(
      AGENT,
      "no_key",
      "POST a campaign purpose and the contacts you want sequenced. This agent only plans the order of work — it sends nothing."
    )
  );
}
