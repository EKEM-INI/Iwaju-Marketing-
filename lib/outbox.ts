"use client";

/**
 * The outbox: drafted messages waiting on a human decision.
 *
 * Drafts used to live only in the memory of the panel that wrote them, so leaving the page
 * threw away a batch and there was nothing to approve. Persisting them per account is what makes
 * the human loop real: you can write in the morning, read each one at lunch, and approve or hold.
 */

import { scopeKey } from "@/lib/account-scope";

const OUTBOX_KEY = "iwaju_outbox_v1";
export const OUTBOX_UPDATED_EVENT = "iwaju-outbox-updated";

export type OutboxStatus = "awaiting_review" | "approved" | "held" | "sent" | "failed";

export interface OutboxItem {
  id: string;
  leadId: string;
  company: string;
  to: string;
  subject: string;
  body: string;
  campaignId?: string;
  campaignName?: string;
  provider: string;
  modelProvider: string;
  modelName: string;
  usedFactIds: string[];
  inventedNumbers: string[];
  /** Carried from the lead so a demo record can never be mailed by accident. */
  sourcedFrom?: string;
  emailStatus?: string;
  status: OutboxStatus;
  holdReason?: string;
  messageId?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

function stableId(item: Pick<OutboxItem, "leadId" | "campaignId" | "subject">): string {
  const seed = `${item.leadId}|${item.campaignId || "none"}|${item.subject}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return `obx-${hash.toString(36)}`;
}

export function draftId(draft: Pick<OutboxItem, "leadId" | "campaignId" | "subject">): string {
  return stableId(draft);
}

export function listOutbox(): OutboxItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(scopeKey(OUTBOX_KEY));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as OutboxItem[]) : [];
  } catch {
    return [];
  }
}

function write(items: OutboxItem[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(scopeKey(OUTBOX_KEY), JSON.stringify(items));
  window.dispatchEvent(new CustomEvent(OUTBOX_UPDATED_EVENT));
}

export function queueDrafts(
  drafts: Array<Omit<OutboxItem, "id" | "status" | "createdAt" | "updatedAt"> & { status?: OutboxStatus; holdReason?: string }>
): { added: number; alreadyThere: number; ids: string[] } {
  const existing = listOutbox();
  const byId = new Map(existing.map((item) => [item.id, item]));
  const ids: string[] = [];
  let added = 0;
  let alreadyThere = 0;
  const now = new Date().toISOString();

  for (const draft of drafts) {
    const id = stableId(draft);
    ids.push(id);
    if (byId.has(id)) {
      alreadyThere += 1;
      continue;
    }
    byId.set(id, {
      ...draft,
      id,
      status: draft.status || "awaiting_review",
      createdAt: now,
      updatedAt: now,
    });
    added += 1;
  }

  write(Array.from(byId.values()).sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
  return { added, alreadyThere, ids };
}

export function updateOutboxItem(id: string, patch: Partial<OutboxItem>): void {
  const items = listOutbox().map((item) =>
    item.id === id ? { ...item, ...patch, updatedAt: new Date().toISOString() } : item
  );
  write(items);
}

export function setOutboxStatus(ids: string[], status: OutboxStatus, extra?: Partial<OutboxItem>): void {
  const set = new Set(ids);
  const items = listOutbox().map((item) =>
    set.has(item.id) ? { ...item, ...extra, status, updatedAt: new Date().toISOString() } : item
  );
  write(items);
}

export function clearOutbox(status?: OutboxStatus): number {
  const all = listOutbox();
  const keep = status ? all.filter((item) => item.status !== status) : [];
  write(keep);
  return (status ? all.length - keep.length : all.length);
}

export function outboxCounts(): Record<OutboxStatus, number> {
  const counts: Record<OutboxStatus, number> = {
    awaiting_review: 0,
    approved: 0,
    held: 0,
    sent: 0,
    failed: 0,
  };
  for (const item of listOutbox()) counts[item.status] = (counts[item.status] || 0) + 1;
  return counts;
}
