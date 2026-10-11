import type { BuyingSignal, ConsentRecord, Lead, PipelineStage } from "@/types";
import type { EvidenceCounts } from "@/lib/icp";
import { isPlaceholderPhone, nameDuplicatesCompany } from "@/lib/address-class";
import { decideChannel, type OutboundChannel } from "@/lib/consent";

/**
 * Deterministic record reading shared by the Next-Best-Action and Forecast
 * agents. Both of those agents must work with no API key at all, so every
 * judgement here comes from fields the rep actually has.
 */

export const STAGE_LABELS: Record<PipelineStage, string> = {
  new: "New Lead",
  contacted: "Contacted",
  meeting: "Meeting Booked",
  closed: "Closed Won",
};

/**
 * Not a win rate measured from history — this project stores no closed-won
 * history yet. These are declared assumptions the rep can argue with.
 */
export const STAGE_WEIGHTS: Record<PipelineStage, number> = {
  new: 0.1,
  contacted: 0.25,
  meeting: 0.55,
  closed: 1,
};

export const WEIGHT_ASSUMPTION =
  "Stage weights are stated assumptions (new 10%, contacted 25%, meeting 55%, won 100%), not a win rate learned from your history. No closed-won history is stored yet, so nothing could be learned from it.";

export interface RecordContext {
  lead: Lead;
  evidence?: EvidenceCounts;
  signals?: { momentumScore: number; hiringPosts: number; fundingEvents: number; techStack: string[] } | null;
  consent?: Partial<Record<OutboundChannel, ConsentRecord>>;
  hasReply?: boolean;
}

export function daysSince(iso: string | undefined | null): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.round((Date.now() - t) / 86400000));
}

export function lastTouchDays(lead: Lead): number | null {
  return daysSince(lead.lastContactedAt || lead.createdAt);
}

export function isStale(lead: Lead, threshold = 21): boolean {
  const days = lastTouchDays(lead);
  return days !== null && days > threshold;
}

export function riskFlags(ctx: RecordContext): string[] {
  const { lead, evidence, consent } = ctx;
  const flags: string[] = [];

  const days = lastTouchDays(lead);
  if (days === null) flags.push("No activity date on this record at all.");
  else if (days > 45) flags.push(`${days} days since the last touch — the thread has gone cold.`);
  else if (days > 21 && lead.stage !== "closed") flags.push(`${days} days without a touch.`);

  if (evidence && evidence.contradicted > 0) {
    flags.push(`${evidence.contradicted} check(s) came back contradicted — the record states something that is not true.`);
  }
  if (evidence?.noHumanContact) flags.push("There is no person on this record, only a company.");
  if (evidence && evidence.verified === 0 && evidence.contradicted === 0 && lead.stage !== "new") {
    flags.push("Nothing on this record has been verified, yet it is sitting in an active stage.");
  }

  if (!lead.email) flags.push("No email: the main channel is closed.");
  if (lead.phone && isPlaceholderPhone(lead.phone)) flags.push(`"${lead.phone}" is a placeholder number, not a reachable one.`);
  if (!lead.dealValue || lead.dealValue <= 0) flags.push("No deal value, so this deal cannot be weighted into a forecast.");
  if (!lead.website) flags.push("No website, so domain evidence cannot be checked.");

  if (lead.stage === "meeting" && !consent?.phone?.granted && !lead.email) {
    flags.push("A meeting is booked but there is no channel to reschedule or confirm on.");
  }

  return flags;
}

export interface SuggestedAction {
  action: string;
  why: string;
  effect: string;
  reversible: boolean;
  effortMinutes: number;
  blockedBy: string | null;
}

/** The rule ladder: first match wins, so the rep gets one clear next move. */
export function nextBestAction(ctx: RecordContext): SuggestedAction {
  const { lead, evidence, signals, consent } = ctx;
  const days = lastTouchDays(lead);
  const nameIsCompany = nameDuplicatesCompany(lead.name, lead.company) || !lead.name;

  if (nameIsCompany && lead.stage !== "closed") {
    return {
      action: "Find a named person before touching this account",
      why: evidence?.noHumanContact
        ? "The Contact Resolution agent found the name field holding the company name, so any message goes to nobody."
        : "There is no individual on this record, so outreach has no one to address.",
      effect: "Fills the name and title fields on the lead card. Nothing is sent.",
      reversible: true,
      effortMinutes: 10,
      blockedBy: null,
    };
  }

  if (lead.phone && isPlaceholderPhone(lead.phone)) {
    return {
      action: "Clear the placeholder phone number",
      why: `"${lead.phone}" matches a pattern this app minted itself. Leaving it in makes the record look contactable when it is not.`,
      effect: "Empties the phone field. The old value stays in your notes so you can put it back.",
      reversible: true,
      effortMinutes: 1,
      blockedBy: null,
    };
  }

  if (evidence && evidence.contradicted > 0 && !lead.email) {
    return {
      action: "Replace the broken contact route",
      why: `${evidence.contradicted} contradicted check(s) and no working email. Sending anything now guarantees a bounce.`,
      effect: "Runs the Evidence Research agent against this domain and stages candidates for your approval.",
      reversible: true,
      effortMinutes: 5,
      blockedBy: null,
    };
  }

  if (!lead.website && lead.stage !== "closed") {
    return {
      action: "Record the company website",
      why: "Without a domain, the verification agents cannot compare the email against the employer, so every claim stays unproven.",
      effect: "Fills the website field on the lead card.",
      reversible: true,
      effortMinutes: 2,
      blockedBy: null,
    };
  }

  if (lead.stage === "closed") {
    return {
      action: "Ask for a referral and write down what was actually delivered",
      why: "A won deal with no record of the outcome cannot support the next sales conversation.",
      effect: "Adds a note to the lead card. Nothing is sent.",
      reversible: true,
      effortMinutes: 10,
      blockedBy: null,
    };
  }

  if (lead.stage === "meeting") {
    return {
      action: "Run the pre-call brief and send an agenda",
      why: "A booked meeting with no agenda and no proven facts on file is where deals quietly die.",
      effect: "Opens the Account Brief panel. Agenda text is copied, not sent.",
      reversible: true,
      effortMinutes: 15,
      blockedBy: null,
    };
  }

  if (lead.stage === "contacted") {
    if (ctx.hasReply) {
      return {
        action: "Reply to their message while it is fresh",
        why: "They answered. The next 24 hours decide whether this becomes a meeting.",
        effect: "Opens Reply Intelligence so the answer stays grounded in facts you approved.",
        reversible: true,
        effortMinutes: 8,
        blockedBy: null,
      };
    }
    if (days !== null && days > 14) {
      return {
        action: `Send one follow-up (${days} days since the last touch)`,
        why: "Silence past two weeks is where outbound threads die. One short, specific nudge is enough — the third generic chase is what gets you blocked.",
        effect: "Drafts in the composer from approved facts only. You send it yourself.",
        reversible: true,
        effortMinutes: 5,
        blockedBy: null,
      };
    }
    return {
      action: `Hold. Next touch in ${Math.max(1, 14 - (days ?? 0))} day(s)`,
      why: `You contacted them ${days ?? "recently"} day(s) ago. Piling on now costs more than it earns.`,
      effect: "No change to the record.",
      reversible: true,
      effortMinutes: 0,
      blockedBy: null,
    };
  }

  if (!lead.email) {
    return {
      action: "Get one working channel before starting outreach",
      why: "There is no email and no consented number, so there is nothing to send on.",
      effect: "Runs Evidence Research on this domain; candidates land in the review list rather than the record.",
      reversible: true,
      effortMinutes: 6,
      blockedBy: consent?.phone?.granted ? null : "a sourced email or recorded phone consent",
    };
  }

  const emailDecision = decideChannel("email", { email: lead.email, consent: consent?.email });
  if (!emailDecision.allowed) {
    return {
      action: "Treat this as a personal mailbox until they reply",
      why: emailDecision.reason,
      effect: "Marks the record as needing an inbound reply before cold mail continues.",
      reversible: true,
      effortMinutes: 2,
      blockedBy: emailDecision.requires,
    };
  }

  return {
    action: "Send the first grounded email",
    why: lead.dealValue > 0
      ? "Nothing has been sent yet, and the fit evidence is already on file."
      : "Nothing has been sent yet. Consider adding a deal value while you are in the record — otherwise this deal will weigh as zero in the forecast.",
    effect: "Opens the composer with only the facts you approved. Nothing goes out without you pressing send.",
    reversible: true,
    effortMinutes: 10,
    blockedBy: null,
  };
}

export function signalsAsFitInput(scan?: { hiringPosts: number; fundingEvents: number; techStack: string[] } | null) {
  if (!scan) return {};
  return {
    hiringPosts: scan.hiringPosts,
    fundingEvents: scan.fundingEvents,
    techStack: scan.techStack,
  };
}

export function strongestSignals(signals: BuyingSignal[] = [], limit = 3): BuyingSignal[] {
  return [...signals].sort((a, b) => (a.status === b.status ? b.strength - a.strength : a.status === "cited" ? -1 : 1)).slice(0, limit);
}

export function currencyOf(leads: Lead[]): string {
  const counts = new Map<string, number>();
  leads.forEach((l) => {
    const c = (l.currency || "NGN").toUpperCase();
    counts.set(c, (counts.get(c) || 0) + 1);
  });
  let best = "NGN";
  let bestCount = -1;
  counts.forEach((n, c) => {
    if (n > bestCount) {
      best = c;
      bestCount = n;
    }
  });
  return best;
}
