"use client";

/**
 * The one place that puts a message on the wire.
 *
 * Every send goes through the same checks: the policy ceilings, whether this address has already
 * been mailed from this account, and whether the record's address is real. Approved drafts and
 * bypass-mode drafts take the identical path, so switching to bypass cannot smuggle through a
 * contact the review queue would have held.
 */

import { canSend, loadSendPolicy, recordSend, type SendPolicy } from "@/lib/send-policy";
import { listOutbox, updateOutboxItem, type OutboxItem } from "@/lib/outbox";
import { loadCampaigns, loadTouches, recordTouch, saveTouches } from "@/lib/campaigns";
import { getStoredLeads, logActivity, updateLeadStage } from "@/lib/storage";
import type { Lead } from "@/types";

export interface SingleSendResult {
  id: string;
  to: string;
  ok: boolean;
  messageId?: string;
  error?: string;
  held?: string;
}

export interface SendRunResult {
  sent: SingleSendResult[];
  held: SingleSendResult[];
  failed: SingleSendResult[];
  sentCount: number;
  note: string;
}

function leadFor(leadId: string, hints: Lead[]): Lead | undefined {
  return hints.find((l) => l.id === leadId) || getStoredLeads().find((l) => l.id === leadId);
}

function recordCampaignTouch(item: OutboxItem, messageId: string): void {
  if (!item.campaignId) return;
  const campaign = loadCampaigns().find((c) => c.id === item.campaignId);
  if (!campaign) return;
  const step = [...campaign.steps].sort((a, b) => a.order - b.order).find((s) => s.kind === "email") || campaign.steps[0];
  if (!step) return;
  const touches = loadTouches();
  saveTouches([
    ...touches,
    recordTouch({
      campaign,
      leadId: item.leadId,
      step,
      outcome: "sent",
      note: `Sent through the connected Gmail account. Gmail message id ${messageId || "not returned"}.`,
    }),
  ]);
}

export async function sendOne(
  item: OutboxItem,
  accessToken: string,
  policy: SendPolicy,
  runSent: number,
  lead?: Lead
): Promise<SingleSendResult> {
  const record = lead || leadFor(item.leadId, []);
  const permission = canSend(policy, runSent, {
    email: item.to,
    sourcedFrom: item.sourcedFrom || record?.sourcedFrom,
    emailStatus: item.emailStatus || record?.emailStatus,
  });
  if (!permission.allowed) {
    updateOutboxItem(item.id, { status: "held", holdReason: permission.reason });
    return { id: item.id, to: item.to, ok: false, held: permission.reason };
  }
  if (!record?.email?.trim()) {
    const reason = "The lead on file has no email address, so this draft has nowhere to go.";
    updateOutboxItem(item.id, { status: "held", holdReason: reason });
    return { id: item.id, to: item.to, ok: false, held: reason };
  }
  if (record.email.trim().toLowerCase() !== item.to.trim().toLowerCase()) {
    const reason = `The address on this draft (${item.to}) is not the address on the lead (${record.email}). Held rather than mailed to a stale address.`;
    updateOutboxItem(item.id, { status: "held", holdReason: reason });
    return { id: item.id, to: item.to, ok: false, held: reason };
  }

  try {
    const res = await fetch("/api/outreach/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken, to: item.to, subject: item.subject, body: item.body }),
    });
    const data = await res.json();
    if (!data?.success) {
      const error = data?.error || "The send route refused this message.";
      updateOutboxItem(item.id, { status: "failed", error });
      return { id: item.id, to: item.to, ok: false, error };
    }

    const messageId = String(data?.data?.messageId || "");
    updateOutboxItem(item.id, { status: "sent", messageId, error: undefined });
    recordSend({
      leadId: item.leadId,
      company: item.company,
      to: item.to,
      subject: item.subject,
      messageId,
      campaignId: item.campaignId,
      mode: policy.mode,
    });
    recordCampaignTouch(item, messageId);
    updateLeadStage(item.leadId, "contacted");
    logActivity({
      id: `act-send-${Date.now()}`,
      type: "stage_changed",
      title: `Email sent to ${item.company}`,
      description: `${item.to} received "${item.subject}" from ${data?.data?.from || "the connected Gmail account"}. Gmail message id ${messageId || "not returned"}.`,
      timestamp: new Date().toISOString(),
      leadId: item.leadId,
    });
    return { id: item.id, to: item.to, ok: true, messageId };
  } catch (err: any) {
    const error = err?.message || "The send request never reached Gmail.";
    updateOutboxItem(item.id, { status: "failed", error });
    return { id: item.id, to: item.to, ok: false, error };
  }
}

/**
 * Sends in the order given, one at a time. Sequential on purpose: each ceiling check has to see
 * the count the previous send wrote, otherwise a batch of thirty sails past a limit of twenty-five.
 */
export async function sendItems(
  ids: string[],
  accessToken: string,
  options?: { policy?: SendPolicy; leads?: Lead[]; onProgress?: (done: number, total: number) => void }
): Promise<SendRunResult> {
  const policy = options?.policy || loadSendPolicy();
  const hints = options?.leads || [];
  const items = listOutbox().filter((item) => ids.includes(item.id));

  const sent: SingleSendResult[] = [];
  const held: SingleSendResult[] = [];
  const failed: SingleSendResult[] = [];

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const result = await sendOne(item, accessToken, policy, sent.length, leadFor(item.leadId, hints));
    if (result.ok) sent.push(result);
    else if (result.held) held.push(result);
    else failed.push(result);
    options?.onProgress?.(index + 1, items.length);
  }

  const note = `${sent.length} message(s) accepted by Gmail, ${held.length} held by the policy, ${failed.length} failed. Held and failed messages were not delivered and stay in the Outbox.`;
  return { sent, held, failed, sentCount: sent.length, note };
}
