import { Lead, SlaItem, SlaAuditReport, SlaStatus } from "@/types";

export const NEW_LEAD_SLA_HOURS = 24;
export const CONTACTED_FOLLOWUP_SLA_HOURS = 72;
export const MEETING_FOLLOWUP_SLA_HOURS = 24;
export const APPROACHING_THRESHOLD_HOURS = 6;

export const HIGH_PRIORITY_SCORE_MIN = 65;
export const HIGH_PRIORITY_DEAL_VALUE_MIN = 500_000;

export function isLeadHighPriority(lead: Lead): boolean {
  if (lead.score !== undefined && lead.score >= HIGH_PRIORITY_SCORE_MIN) {
    return true;
  }
  if (lead.dealValue && lead.dealValue >= HIGH_PRIORITY_DEAL_VALUE_MIN) {
    return true;
  }
  if (Array.isArray(lead.tags)) {
    return lead.tags.some((t) => /hot|vip|priority|urgent|tier\s*a|tier-a/i.test(t));
  }
  return false;
}

export function targetSlaForStage(stage: Lead["stage"]): number {
  switch (stage) {
    case "new":
      return NEW_LEAD_SLA_HOURS;
    case "contacted":
      return CONTACTED_FOLLOWUP_SLA_HOURS;
    case "meeting":
      return MEETING_FOLLOWUP_SLA_HOURS;
    case "closed":
      return 0;
    default:
      return NEW_LEAD_SLA_HOURS;
  }
}

export function evaluateLeadSla(lead: Lead, now: Date = new Date()): SlaItem | null {
  if (lead.stage === "closed") {
    return null;
  }

  const isHighPri = isLeadHighPriority(lead);
  const targetSlaHours = targetSlaForStage(lead.stage);

  const rawTimestamp =
    lead.stage === "new"
      ? lead.createdAt || lead.lastContactedAt || new Date().toISOString()
      : lead.lastContactedAt || lead.createdAt || new Date().toISOString();

  const touchDate = new Date(rawTimestamp);
  const validTouchTime = isNaN(touchDate.getTime()) ? now.getTime() : touchDate.getTime();
  const elapsedMillis = Math.max(0, now.getTime() - validTouchTime);
  const elapsedHours = Math.floor(elapsedMillis / (1000 * 60 * 60));
  const overdueHours = Math.max(0, elapsedHours - targetSlaHours);

  let status: SlaStatus = "healthy";
  if (overdueHours > 0) {
    status = "breached";
  } else if (targetSlaHours - elapsedHours <= APPROACHING_THRESHOLD_HOURS) {
    status = "approaching";
  }

  let breachReason = "";
  let recommendedAction = "";

  if (lead.stage === "new") {
    if (status === "breached") {
      breachReason = `New lead created ${elapsedHours}h ago has not received an initial outbound touch (SLA: ${targetSlaHours}h).`;
      recommendedAction = "Dispatch executive cold introduction email or phone call immediately.";
    } else if (status === "approaching") {
      breachReason = `New lead created ${elapsedHours}h ago is approaching the 24h SLA deadline (${targetSlaHours - elapsedHours}h remaining).`;
      recommendedAction = "Schedule initial touch before SLA deadline expires.";
    } else {
      breachReason = `Within target SLA (${targetSlaHours - elapsedHours}h remaining).`;
      recommendedAction = "Prepare personalized outreach copy from verified company signals.";
    }
  } else if (lead.stage === "contacted") {
    if (status === "breached") {
      breachReason = `Contacted ${elapsedHours}h ago without a logged follow-up touch (SLA: ${targetSlaHours}h / 3 days).`;
      recommendedAction = "Send Step 2 value-proposition follow-up or case study nudge.";
    } else if (status === "approaching") {
      breachReason = `Follow-up SLA is approaching (${targetSlaHours - elapsedHours}h remaining).`;
      recommendedAction = "Queue follow-up email in Outbox.";
    } else {
      breachReason = `Cadence healthy (${targetSlaHours - elapsedHours}h until follow-up SLA).`;
      recommendedAction = "Awaiting reply or scheduled sequence step.";
    }
  } else if (lead.stage === "meeting") {
    if (status === "breached") {
      breachReason = `Meeting booked ${elapsedHours}h ago with no logged confirmation or preparation touch (SLA: ${targetSlaHours}h).`;
      recommendedAction = "Send meeting agenda confirmation and pre-call executive briefing.";
    } else if (status === "approaching") {
      breachReason = `Meeting follow-up SLA approaching (${targetSlaHours - elapsedHours}h remaining).`;
      recommendedAction = "Send calendar reminder and agenda.";
    } else {
      breachReason = `Meeting preparation on track (${targetSlaHours - elapsedHours}h remaining).`;
      recommendedAction = "Review Pre-Call Tactical Brief in Pipeline Workbench.";
    }
  }

  return {
    leadId: String(lead.id),
    company: lead.company || "Unnamed Company",
    name: lead.name || "Decision Maker",
    title: lead.title || "",
    email: lead.email || "",
    phone: lead.phone || "",
    stage: lead.stage,
    dealValue: Number(lead.dealValue) || 0,
    currency: lead.currency || "NGN",
    score: lead.score || 0,
    isHighPriority: isHighPri,
    status,
    targetSlaHours,
    elapsedHours,
    overdueHours,
    lastTouchTimestamp: rawTimestamp,
    breachReason,
    recommendedAction,
  };
}

export function auditLeadsSla(leads: Lead[], now: Date = new Date()): SlaAuditReport {
  const evaluatedItems: SlaItem[] = [];

  for (const lead of leads) {
    const item = evaluateLeadSla(lead, now);
    if (item) {
      evaluatedItems.push(item);
    }
  }

  // Sort order:
  // 1. Breached items first (highest deal value first)
  // 2. Approaching items second
  // 3. Healthy items last
  const priorityOrder: Record<SlaStatus, number> = {
    breached: 0,
    approaching: 1,
    healthy: 2,
  };

  evaluatedItems.sort((a, b) => {
    const pDiff = priorityOrder[a.status] - priorityOrder[b.status];
    if (pDiff !== 0) return pDiff;
    // Within same status, high priority first, then highest deal value
    if (a.isHighPriority !== b.isHighPriority) {
      return a.isHighPriority ? -1 : 1;
    }
    return b.dealValue - a.dealValue || b.overdueHours - a.overdueHours;
  });

  const highPriorityItems = evaluatedItems.filter((i) => i.isHighPriority);
  const breachedItems = evaluatedItems.filter((i) => i.status === "breached");
  const approachingItems = evaluatedItems.filter((i) => i.status === "approaching");
  const healthyItems = evaluatedItems.filter((i) => i.status === "healthy");

  const primaryCurrency = evaluatedItems[0]?.currency || "NGN";
  const totalAtRiskDealValue = breachedItems.reduce((acc, i) => acc + (i.dealValue || 0), 0);

  return {
    timestamp: now.toISOString(),
    totalEvaluated: evaluatedItems.length,
    highPriorityCount: highPriorityItems.length,
    breachedCount: breachedItems.length,
    approachingCount: approachingItems.length,
    healthyCount: healthyItems.length,
    totalAtRiskDealValue,
    currency: primaryCurrency,
    items: evaluatedItems,
  };
}
