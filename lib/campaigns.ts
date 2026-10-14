import type {
  Campaign,
  CampaignChannel,
  CampaignProgress,
  CampaignStats,
  CampaignStep,
  CampaignStepKind,
  CampaignTouch,
  ContactCampaignState,
  Lead,
  PipelineStage,
  TouchOutcome,
} from "@/types";
import { scopeKey } from "@/lib/account-scope";

/**
 * Campaign bookkeeping.
 *
 * There is no inbox connection in this app, so a campaign can only ever know what
 * the rep recorded. Every number in here is derived from stored touches, and the
 * metrics that would need an inbox are named as not measured rather than guessed at.
 */

export const CAMPAIGN_STORAGE_KEY = "iwaju_marketing_campaigns_v1";
export const TOUCH_STORAGE_KEY = "iwaju_campaign_touches_v1";
export const CAMPAIGNS_UPDATED_EVENT = "iwaju-campaigns-updated";
export const TOUCHES_UPDATED_EVENT = "iwaju-campaign-touches-updated";

const DAY = 86400000;

const TERMINAL_REPLY: TouchOutcome[] = ["replied"];
const TERMINAL_STOP: TouchOutcome[] = ["declined", "unsubscribed", "blocked"];

export function isTerminalOutcome(outcome: TouchOutcome | null): boolean {
  if (!outcome) return false;
  return TERMINAL_REPLY.includes(outcome) || TERMINAL_STOP.includes(outcome);
}

interface StepSeed {
  kind: CampaignStepKind;
  label: string;
  intent: string;
  waitDays: number;
}

const EMAIL_SEQUENCE: StepSeed[] = [
  { kind: "email", label: "First email", intent: "State one observed fact about their business and one reason you are writing.", waitDays: 0 },
  { kind: "email", label: "Follow-up 1", intent: "Short bump on the same thread with one extra piece of proof.", waitDays: 3 },
  { kind: "email", label: "Value email", intent: "Send something useful with no ask attached.", waitDays: 5 },
  { kind: "email", label: "Break-up email", intent: "Close the loop and leave the door open.", waitDays: 9 },
];

const PHONE_SEQUENCE: StepSeed[] = [
  { kind: "email", label: "heads-up email", intent: "Say you will call and ask for a good time.", waitDays: 0 },
  { kind: "call", label: "Call 1", intent: "Short call. Ask, do not pitch.", waitDays: 2 },
  { kind: "call", label: "Call 2 at a different hour", intent: "Second attempt outside the first calling window.", waitDays: 3 },
  { kind: "email", label: "Voicemail recap email", intent: "Summarise the voicemail in writing so there is a record.", waitDays: 2 },
];

const MIXED_SEQUENCE: StepSeed[] = [
  { kind: "email", label: "First email", intent: "One fact, one reason for writing.", waitDays: 0 },
  { kind: "call", label: "Call after the email", intent: "Reference the email you already sent.", waitDays: 3 },
  { kind: "whatsapp", label: "WhatsApp nudge", intent: "One line, one link. Only if consent is live.", waitDays: 4 },
  { kind: "email", label: "Break-up email", intent: "Close the loop politely.", waitDays: 7 },
];

const LINKEDIN_SEQUENCE: StepSeed[] = [
  { kind: "linkedin", label: "Connection request", intent: "No pitch in the invite note.", waitDays: 0 },
  { kind: "linkedin", label: "Opening message", intent: "Ask one question about their operation.", waitDays: 3 },
  { kind: "email", label: "Move to email", intent: "Take the conversation to a channel they answer on.", waitDays: 5 },
];

/**
 * The default cadence is an assumption, not a benchmark. The note says so because
 * no reply-rate data exists in this app to justify a different shape.
 */
export function defaultSteps(channel: CampaignChannel): CampaignStep[] {
  const seeds =
    channel === "phone" ? PHONE_SEQUENCE : channel === "mixed" ? MIXED_SEQUENCE : channel === "linkedin" ? LINKEDIN_SEQUENCE : EMAIL_SEQUENCE;
  return seeds.map((seed, i) => ({
    id: `step-${i + 1}`,
    order: i + 1,
    kind: seed.kind,
    label: seed.label,
    intent: seed.intent,
    waitDays: seed.waitDays,
    rationale: "Default cadence. Nothing in this app measures reply rates, so the spacing is a stated assumption you can change.",
    source: "rules" as const,
  }));
}

export function campaignAssumptions(campaign: Campaign): string[] {
  return [
    `Cadence is the app default (${campaign.steps.map((s) => `step ${s.order}: +${s.waitDays}d`).join(", ")}) unless you edited it.`,
    "Nothing here is sent automatically. A step marked done means you recorded doing it.",
    "Open, click, bounce and deliverability rates are not available without an inbox connection.",
    "A contact counts as stopped the moment you record a decline, an opt-out or a blocked channel.",
  ];
}

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter.toString(36)}`;
}

export function newCampaign(input: {
  name: string;
  purpose: string;
  channel: CampaignChannel;
  leadIds: string[];
  startAt?: string;
  targetValue?: number;
  currency?: string;
  steps?: CampaignStep[];
}): Campaign {
  const now = new Date().toISOString();
  return {
    id: nextId("campaign"),
    name: input.name.trim() || "Untitled campaign",
    purpose: input.purpose.trim(),
    channel: input.channel,
    status: "draft",
    createdAt: now,
    updatedAt: now,
    startAt: input.startAt || now,
    steps: input.steps && input.steps.length > 0 ? input.steps : defaultSteps(input.channel),
    leadIds: Array.from(new Set(input.leadIds.filter(Boolean))),
    targetValue: input.targetValue,
    currency: input.currency,
  };
}

/** Every campaign store is namespaced by the signed-in account. */
function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(scopeKey(key));
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown, event: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(scopeKey(key), JSON.stringify(value));
    window.dispatchEvent(new CustomEvent(event, { detail: value }));
  } catch {
    // quota or private mode: the screen still shows in-memory state
  }
}

export function loadCampaigns(): Campaign[] {
  return readJson<Campaign[]>(CAMPAIGN_STORAGE_KEY, []);
}

export function saveCampaigns(campaigns: Campaign[]): void {
  writeJson(CAMPAIGN_STORAGE_KEY, campaigns, CAMPAIGNS_UPDATED_EVENT);
}

export function loadTouches(): CampaignTouch[] {
  return readJson<CampaignTouch[]>(TOUCH_STORAGE_KEY, []);
}

export function saveTouches(touches: CampaignTouch[]): void {
  writeJson(TOUCH_STORAGE_KEY, touches, TOUCHES_UPDATED_EVENT);
}

export function touchesFor(campaignId: string, leadId: string, touches: CampaignTouch[]): CampaignTouch[] {
  return touches
    .filter((t) => t.campaignId === campaignId && t.leadId === leadId)
    .sort((a, b) => a.at.localeCompare(b.at) || a.stepOrder - b.stepOrder);
}

export function recordTouch(args: {
  campaign: Campaign;
  leadId: string;
  step: CampaignStep;
  outcome: TouchOutcome;
  note?: string;
  at?: string;
}): CampaignTouch {
  return {
    id: nextId("touch"),
    campaignId: args.campaign.id,
    leadId: args.leadId,
    stepId: args.step.id,
    stepOrder: args.step.order,
    kind: args.step.kind,
    outcome: args.outcome,
    at: args.at || new Date().toISOString(),
    note: args.note?.trim() || undefined,
  };
}

function daysBetween(fromIso: string, toMs: number): number {
  return Math.floor((toMs - new Date(fromIso).getTime()) / DAY);
}

export function progressForContact(
  campaign: Campaign,
  lead: Lead,
  allTouches: CampaignTouch[],
  now = Date.now()
): CampaignProgress {
  const steps = [...campaign.steps].sort((a, b) => a.order - b.order);
  const mine = touchesFor(campaign.id, lead.id, allTouches);
  const last = mine[mine.length - 1] || null;
  const base = {
    leadId: lead.id,
    company: lead.company,
    name: lead.name,
    stage: lead.stage,
    touchCount: mine.length,
    lastTouchAt: last ? last.at : null,
    lastOutcome: last ? last.outcome : null,
  };

  if (last && TERMINAL_STOP.includes(last.outcome)) {
    return { ...base, state: "stopped", nextStepId: null, nextStepLabel: "Stopped by you", nextDueAt: null, overdueDays: 0, terminal: true };
  }
  if (last && TERMINAL_REPLY.includes(last.outcome)) {
    return { ...base, state: "awaiting_reply", nextStepId: null, nextStepLabel: "They replied — sequence paused for you", nextDueAt: null, overdueDays: 0, terminal: true };
  }

  const doneOrders = new Set(mine.map((t) => t.stepOrder));
  const nextStep = steps.find((s) => !doneOrders.has(s.order)) || null;

  if (!nextStep) {
    return { ...base, state: "finished", nextStepId: null, nextStepLabel: "Sequence complete", nextDueAt: null, overdueDays: 0, terminal: true };
  }

  const anchorMs = last ? new Date(last.at).getTime() : new Date(campaign.startAt).getTime();
  const dueMs = anchorMs + nextStep.waitDays * DAY;
  const dueAt = new Date(dueMs).toISOString();

  if (campaign.status !== "active") {
    return { ...base, state: "waiting", nextStepId: nextStep.id, nextStepLabel: nextStep.label, nextDueAt: dueAt, overdueDays: 0, terminal: false };
  }

  if (dueMs > now) {
    return { ...base, state: "waiting", nextStepId: nextStep.id, nextStepLabel: nextStep.label, nextDueAt: dueAt, overdueDays: 0, terminal: false };
  }

  const late = Math.max(0, Math.floor((now - dueMs) / DAY));
  return {
    ...base,
    state: late > 0 ? "overdue" : "due_now",
    nextStepId: nextStep.id,
    nextStepLabel: nextStep.label,
    nextDueAt: dueAt,
    overdueDays: late,
    terminal: false,
  };
}

export function progressForCampaign(
  campaign: Campaign,
  leads: Lead[],
  allTouches: CampaignTouch[],
  now = Date.now()
): CampaignProgress[] {
  const byId = new Map(leads.map((l) => [String(l.id), l]));
  return campaign.leadIds
    .map((id) => byId.get(id))
    .filter((lead): lead is Lead => Boolean(lead))
    .map((lead) => progressForContact(campaign, lead, allTouches, now));
}

const STAGES: PipelineStage[] = ["new", "contacted", "meeting", "closed"];

export function statsForCampaign(
  campaign: Campaign,
  leads: Lead[],
  allTouches: CampaignTouch[],
  now = Date.now()
): CampaignStats {
  const progress = progressForCampaign(campaign, leads, allTouches, now);
  const campaignTouches = allTouches.filter((t) => t.campaignId === campaign.id);
  const touchedLeads = new Set(campaignTouches.map((t) => t.leadId));

  const count = (outcome: TouchOutcome) =>
    progress.filter((p) => p.lastOutcome === outcome).length;

  const byStage = STAGES.reduce<Record<PipelineStage, number>>(
    (acc, stage) => {
      acc[stage] = campaign.leadIds
        .map((id) => leads.find((l) => String(l.id) === id))
        .filter((l): l is Lead => Boolean(l))
        .filter((l) => l.stage === stage).length;
      return acc;
    },
    { new: 0, contacted: 0, meeting: 0, closed: 0 }
  );

  const groups = new Map<string, { total: number; count: number }>();
  campaign.leadIds.forEach((id) => {
    const lead = leads.find((l) => String(l.id) === id);
    if (!lead || !lead.dealValue) return;
    const currency = lead.currency || "NGN";
    const current = groups.get(currency) || { total: 0, count: 0 };
    current.total += lead.dealValue;
    current.count += 1;
    groups.set(currency, current);
  });

  const replied = count("replied");
  const handedOn = campaignTouches.filter(
    (t) => t.outcome === "sent" || t.outcome === "handed_off" || t.outcome === "replied"
  ).length;

  return {
    contacts: campaign.leadIds.length,
    touched: touchedLeads.size,
    untouched: Math.max(0, campaign.leadIds.length - touchedLeads.size),
    dueNow: progress.filter((p) => p.state === "due_now").length,
    overdue: progress.filter((p) => p.state === "overdue").length,
    replied,
    declined: count("declined"),
    unsubscribed: count("unsubscribed"),
    blocked: count("blocked"),
    replyRate: handedOn > 0 ? Math.round((replied / handedOn) * 100) / 100 : null,
    stepProgress: [...campaign.steps]
      .sort((a, b) => a.order - b.order)
      .map((step) => ({
        stepId: step.id,
        label: step.label,
        done: campaignTouches.filter((t) => t.stepId === step.id).length,
        pending: Math.max(0, campaign.leadIds.length - campaignTouches.filter((t) => t.stepId === step.id).length),
      })),
    byStage,
    valueByCurrency: Array.from(groups.entries()).map(([currency, v]) => ({ currency, total: v.total, count: v.count })),
    measuredFrom: "Recorded touches plus whatever Gmail accepted. Reply rates count messages that went out, not messages that were opened.",
    notMeasured: [
      "Opens — no inbox connection, so no open events",
      "Clicks — no link tracking in this app",
      "Bounces — the send-only Gmail scope cannot read your inbox, so a bounce notice never reaches this app",
      "Deliverability — no inbox provider feedback loop",
      "Time-to-reply — you record the reply, not when it arrived",
    ],
  };
}

export function removeCampaignArtifacts(campaignId: string, campaigns: Campaign[], touches: CampaignTouch[]) {
  return {
    campaigns: campaigns.filter((c) => c.id !== campaignId),
    touches: touches.filter((t) => t.campaignId !== campaignId),
  };
}
