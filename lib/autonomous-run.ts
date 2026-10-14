"use client";

/**
 * One autonomous run, end to end: Apollo sources, ChatGPT qualifies, ChatGPT or Gemini writes,
 * then the send step obeys whatever permission this account has been given.
 *
 * The order matters and is not negotiable here. Sourcing is Apollo's job - this module never asks
 * a language model for a name, a domain or an address, because a model will happily produce one.
 * The writers only ever see records that already exist, and they only state the facts on them.
 *
 * When a step produces nothing, the run says so and moves on with what it has. A failed Apollo
 * call does not get patched over with sample data, and an unwritten email does not get "sent".
 */

import type { Campaign, Lead, LeadVerdict } from "@/types";
import { upsertLeads, getStoredLeads, saveLeads, logActivity } from "@/lib/storage";
import { loadCampaigns } from "@/lib/campaigns";
import { loadConsentStore } from "@/lib/consent";
import { listOutbox, queueDrafts, type OutboxStatus } from "@/lib/outbox";
import { gmailNeedsReconnect, loadGmailConnection } from "@/lib/gmail";
import { loadSendPolicy, sentToday, type SendMode, type SendPolicy } from "@/lib/send-policy";
import { sendItems, type SendRunResult } from "@/lib/send-runner";

export interface RunOptions {
  niche: string;
  location: string;
  count: number;
  revealEmails: boolean;
  campaignId: string;
  senderCompany: string;
}

export interface AutonomousRunSummary {
  sourced: number;
  added: number;
  merged: number;
  addressRevealed: number;
  withPhone: number;
  qualified: number;
  needsReview: number;
  disqualified: number;
  drafted: number;
  draftsSkipped: { company: string; reason: string }[];
  queued: number;
  mode: SendMode;
  sent: number;
  held: { to: string; reason: string }[];
  failed: { to: string; error: string }[];
  waitingForApproval: number;
  providers: string[];
  notes: string[];
  log: string[];
}

type Logger = (line: string) => void;

function emptySummary(mode: SendMode): AutonomousRunSummary {
  return {
    sourced: 0,
    added: 0,
    merged: 0,
    addressRevealed: 0,
    withPhone: 0,
    qualified: 0,
    needsReview: 0,
    disqualified: 0,
    drafted: 0,
    draftsSkipped: [],
    queued: 0,
    mode,
    sent: 0,
    held: [],
    failed: [],
    waitingForApproval: 0,
    providers: [],
    notes: [],
    log: [],
  };
}

/** Apollo does the sourcing. This is the only call in a run that creates a record. */
async function sourceLeads(options: RunOptions, log: Logger): Promise<{ leads: Lead[]; provider: string; note: string; warning: string }> {
  log(`[SOURCE] Apollo search: "${options.niche}" decision-makers in ${options.location}, up to ${options.count} accounts${options.revealEmails ? ", spending credits to reveal real mailboxes" : ", no mailbox reveal (free, and nothing is mailable)"}."`);

  let data: any;
  try {
    const res = await fetch("/api/prospecting/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        niche: options.niche,
        location: options.location,
        count: options.count,
        source: "apollo",
        revealEmails: options.revealEmails,
        allowDemo: false,
      }),
    });
    data = await res.json();
  } catch (err: any) {
    return { leads: [], provider: "Apollo (unreachable)", note: "", warning: `The Apollo call never completed: ${err?.message}. No records were created.` };
  }

  if (!data?.success) {
    return { leads: [], provider: "Apollo (refused)", note: "", warning: data?.error || "Apollo returned no records and gave no reason." };
  }

  const leads = Array.isArray(data.leads) ? (data.leads as Lead[]) : [];
  const reveal = data.reveal || {};
  const note = String(data.notice || "");
  log(`[SOURCE] ${String(data.provider)} returned ${leads.length} account(s). ${note}`);
  if (reveal.attempted || reveal.alreadyReleased) {
    log(
      `[REVEAL] Purchased reveal ran for ${reveal.attempted} contact(s): ${reveal.revealed} came back with a mailbox, ${reveal.phones || 0} direct line(s) returned. Apollo already released ${reveal.alreadyReleased} address(es) for free in the search. ${String(reveal.note || "")}`
    );
  }
  const warnings = Array.isArray(data.warnings) ? data.warnings : [];
  warnings.forEach((w: string) => log(`[WARN] ${w}`));

  return {
    leads,
    provider: String(data.provider || "Apollo"),
    note,
    warning: leads.length === 0 ? "Apollo produced no accounts for this target. Nothing was invented to fill the gap." : "",
  };
}

/** ChatGPT judges records that already exist. It never sees a blank page. */
async function qualifyLeads(
  leads: Lead[],
  options: RunOptions,
  log: Logger
): Promise<{ verdicts: LeadVerdict[]; provider: string; failed: string }> {
  log(`[BRAIN] Sending ${leads.length} sourced record(s) to ChatGPT for qualification.`);
  let data: any;
  try {
    const res = await fetch("/api/autonomous/brain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leads, targetNiche: options.niche, targetCity: options.location }),
    });
    data = await res.json();
  } catch (err: any) {
    return { verdicts: [], provider: "ChatGPT (unreachable)", failed: `Qualification could not run: ${err?.message}. Every sourced record stays unqualified.` };
  }
  if (!data?.success) {
    return {
      verdicts: [],
      provider: String(data?.provider || "ChatGPT (no live result)"),
      failed: data?.error || "ChatGPT returned no verdicts for these records.",
    };
  }
  const verdicts = Array.isArray(data.verdicts) ? (data.verdicts as LeadVerdict[]) : [];
  log(`[BRAIN] ${String(data.provider)} judged ${verdicts.length} record(s).`);
  return { verdicts, provider: String(data.provider || "ChatGPT"), failed: "" };
}

/** The writer step. Campaign context gives the drafts a thread to belong to. */
async function draftEmails(
  leads: Lead[],
  campaign: Campaign,
  options: RunOptions,
  log: Logger
): Promise<{ drafts: any[]; skipped: any[]; provider: string; error: string }> {
  log(`[WRITE] ${leads.length} qualified record(s) go to the outreach writer for campaign "${campaign.name}".`);
  let data: any;
  try {
    const res = await fetch("/api/outreach/batch-compose", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campaign: { id: campaign.id, name: campaign.name, purpose: campaign.purpose },
        senderCompany: options.senderCompany,
        leads,
        consent: loadConsentStore(),
      }),
    });
    data = await res.json();
  } catch (err: any) {
    return { drafts: [], skipped: [], provider: "writer (unreachable)", error: `The writer could not be reached: ${err?.message}` };
  }
  const payload = data?.data || {};
  const drafts = Array.isArray(payload.generated) ? payload.generated : [];
  const skipped = Array.isArray(payload.skipped) ? payload.skipped : [];
  if (!data?.success) {
    return {
      drafts,
      skipped,
      provider: String(data?.provider || "no writer ran"),
      error: String(data?.error || "The writer returned no draft for any contact."),
    };
  }
  log(`[WRITE] ${String(data.provider)} wrote ${drafts.length} draft(s), skipped ${skipped.length} with a stated reason.`);
  return { drafts, skipped, provider: String(data.provider || "writer"), error: "" };
}

function describeSend(result: SendRunResult, log: Logger): void {
  result.sent.forEach((s) => log(`[SENT] ${s.to} — Gmail accepted it (id ${s.messageId || "not returned"}).`));
  result.held.forEach((h) => log(`[HELD] ${h.to} — ${h.held}`));
  result.failed.forEach((f) => log(`[FAILED] ${f.to} — ${f.error}`));
}

export async function runAutonomousPipeline(options: RunOptions, rawLog: Logger): Promise<AutonomousRunSummary> {
  const policy: SendPolicy = loadSendPolicy();
  const summary = emptySummary(policy.mode);
  const log: Logger = (line) => {
    summary.log.push(line);
    rawLog(line);
  };

  log(`[RUN] Autonomous pass started for "${options.niche}" in ${options.location}. Send permission: ${policy.mode === "bypass" ? "bypass — the run may send what it approves" : "review — every draft waits for you"} (max ${policy.capPerRun} per run, ${policy.capPerDay} per day, ${sentToday()} sent today).`);

  // 1. Source
  const sourced = await sourceLeads(options, log);
  summary.providers.push(sourced.provider);
  if (sourced.warning) summary.notes.push(sourced.warning);
  const fresh = sourced.leads;
  summary.sourced = fresh.length;
  if (fresh.length === 0) {
    log("[STOP] No records were sourced, so there is nothing to qualify, write or send.");
    return summary;
  }

  const { added, merged } = upsertLeads(fresh);
  summary.added = added;
  summary.merged = merged;
  summary.addressRevealed = fresh.filter((l) => l.email && l.emailStatus !== "unavailable").length;
  summary.withPhone = fresh.filter((l) => String(l.phone || "").trim().length > 0).length;
  log(`[CRM] ${added} new account(s) written to the pipeline, ${merged} already on file were refreshed.`);

  // 2. Qualify
  const qualified = await qualifyLeads(fresh, options, log);
  summary.providers.push(qualified.provider);
  let working = fresh;
  if (qualified.failed) {
    summary.notes.push(qualified.failed);
    log(`[BRAIN FAILED] ${qualified.failed}`);
  } else {
    const byLead = new Map(qualified.verdicts.map((v) => [String(v.leadId), v]));
    summary.qualified = qualified.verdicts.filter((v) => v.status === "qualified").length;
    summary.needsReview = qualified.verdicts.filter((v) => v.status === "needs_review").length;
    summary.disqualified = qualified.verdicts.filter((v) => v.status === "disqualified").length;

    const stamped = getStoredLeads().map((lead) => {
      const verdict = byLead.get(String(lead.id));
      return verdict ? { ...lead, score: verdict.qualificationScore } : lead;
    });
    saveLeads(stamped);

    const mailable = fresh.filter((lead) => byLead.get(String(lead.id))?.status === "qualified");
    working = mailable.length > 0 ? mailable : fresh.filter((lead) => Boolean(lead.email));
    log(
      `[QUALIFY] ${summary.qualified} qualified · ${summary.needsReview} need a human look · ${summary.disqualified} disqualified. Drafting runs against ${working.length} record(s).`
    );
    if (working.length === 0) {
      summary.notes.push("ChatGPT qualified nothing, and no sourced record carried a usable address. No drafts were written.");
      log("[STOP] Nothing survived qualification. No drafts, no sends.");
      return summary;
    }
  }

  // 3. Write
  const campaign = loadCampaigns().find((c) => c.id === options.campaignId) || null;
  if (!campaign) {
    summary.notes.push("No campaign was selected for this run, so the writer had no thread to draft into. Pick one (or create one) and run again.");
    log("[WRITE SKIPPED] No campaign selected — the writer needs a campaign to attach drafts to.");
    return summary;
  }

  const written = await draftEmails(working, campaign, options, log);
  summary.providers.push(written.provider);
  summary.drafted = written.drafts.length;
  summary.draftsSkipped = written.skipped.map((s: any) => ({ company: String(s.company || s.leadId), reason: String(s.reason) }));
  if (written.error) summary.notes.push(written.error);
  if (written.drafts.length === 0) {
    log("[STOP] No draft was written, so the Outbox has nothing new to hold.");
    return summary;
  }

  const leadsById = new Map(working.map((lead) => [String(lead.id), lead]));
  const status: OutboxStatus = policy.mode === "bypass" ? "approved" : "awaiting_review";
  const queued = queueDrafts(
    written.drafts.map((d: any) => {
      const lead = leadsById.get(String(d.leadId));
      return {
        leadId: String(d.leadId),
        company: String(d.company || lead?.company || ""),
        to: String(d.to || lead?.email || ""),
        subject: String(d.subject),
        body: String(d.body),
        campaignId: campaign.id,
        campaignName: campaign.name,
        provider: String(d.provider || written.provider),
        modelProvider: String(d.modelProvider || ""),
        modelName: String(d.modelName || ""),
        usedFactIds: Array.isArray(d.usedFactIds) ? d.usedFactIds : [],
        inventedNumbers: Array.isArray(d.inventedNumbers) ? d.inventedNumbers : [],
        sourcedFrom: lead?.sourcedFrom,
        emailStatus: lead?.emailStatus,
        status,
      };
    })
  );
  summary.queued = queued.added;
  log(`[OUTBOX] ${queued.added} draft(s) added${queued.alreadyThere ? `, ${queued.alreadyThere} already in the queue` : ""}. Status: ${status === "approved" ? "approved by the run" : "waiting on your approval"}.`);

  // 4. Send
  if (policy.mode === "review") {
    summary.waitingForApproval = listOutbox().filter((item) => queued.ids.includes(item.id) && item.status === "awaiting_review").length;
    summary.notes.push(`Review mode is on, so nothing left this run. ${summary.waitingForApproval} draft(s) wait in the Outbox for you to approve and send.`);
    log("[SEND SKIPPED] Review mode: the run stops at the Outbox.");
  } else {
    const connection = loadGmailConnection();
    if (gmailNeedsReconnect(connection)) {
      summary.notes.push("Bypass mode is on but no Gmail account is connected in this browser, so nothing could be sent. The drafts stay approved and wait in the Outbox.");
      log("[SEND BLOCKED] Bypass mode needs a connected Gmail account.");
    } else {
      const result = await sendItems(queued.ids, connection?.accessToken || "", {
        policy,
        leads: working,
        onProgress: (done, total) => log(`[SEND] ${done}/${total} processed.`),
      });
      summary.sent = result.sentCount;
      summary.held = result.held.map((h) => ({ to: h.to, reason: String(h.held) }));
      summary.failed = result.failed.map((f) => ({ to: f.to, error: String(f.error) }));
      describeSend(result, log);
      summary.notes.push(result.note);
    }
  }

  logActivity({
    id: `act-run-${Date.now()}`,
    type: "note_added",
    title: `Autonomous run: ${summary.sourced} sourced, ${summary.drafted} drafted, ${summary.sent} sent`,
    description: `Apollo sourced ${summary.sourced} account(s) for "${options.niche}" in ${options.location}. ${summary.providers.join(" · ")}. ${summary.queued} draft(s) entered the Outbox and ${summary.sent} were accepted by Gmail${summary.held.length ? `; ${summary.held.length} held by the policy` : ""}.`,
    timestamp: new Date().toISOString(),
  });

  log(
    `[DONE] Sourced ${summary.sourced} · qualified ${summary.qualified} · drafted ${summary.drafted} · sent ${summary.sent} · held ${summary.held.length} · failed ${summary.failed.length}.`
  );
  return summary;
}
