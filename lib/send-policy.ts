"use client";

/**
 * What a run is allowed to put on the wire, and the record of what already went out.
 *
 * Review mode holds every drafted message until a person approves it. Bypass mode sends whatever
 * the run approved without asking again - it skips the click, not the eligibility rules that made
 * the contact approvable. Both ceilings are checked here, in the browser that owns the data,
 * before any request reaches Gmail.
 *
 * There is no server-side store in this app, so the day counter belongs to the account that wrote
 * it. A second browser starts its own day at zero. That is a real limit of this design and the
 * Outbox states it instead of implying a guarantee it cannot make.
 */

import { scopeKey } from "@/lib/account-scope";

const POLICY_KEY = "iwaju_send_policy_v1";
const LEDGER_KEY = "iwaju_send_ledger_v1";

export const SEND_LEDGER_UPDATED_EVENT = "iwaju-send-ledger-updated";

export type SendMode = "review" | "bypass";

export interface SendPolicy {
  mode: SendMode;
  capPerRun: number;
  capPerDay: number;
  updatedAt: string;
}

export interface SendLedgerEntry {
  id: string;
  leadId: string;
  company: string;
  to: string;
  subject: string;
  messageId: string;
  sentAt: string;
  campaignId?: string;
  mode: SendMode;
}

export const DEFAULT_POLICY: SendPolicy = {
  mode: "review",
  capPerRun: 25,
  capPerDay: 100,
  updatedAt: new Date().toISOString(),
};

function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function loadSendPolicy(): SendPolicy {
  if (typeof window === "undefined") return DEFAULT_POLICY;
  try {
    const raw = window.localStorage.getItem(scopeKey(POLICY_KEY));
    if (!raw) return DEFAULT_POLICY;
    const parsed = JSON.parse(raw) as Partial<SendPolicy>;
    return {
      mode: parsed.mode === "bypass" ? "bypass" : "review",
      capPerRun: Math.max(1, Math.min(100, Number(parsed.capPerRun) || DEFAULT_POLICY.capPerRun)),
      capPerDay: Math.max(1, Math.min(500, Number(parsed.capPerDay) || DEFAULT_POLICY.capPerDay)),
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : DEFAULT_POLICY.updatedAt,
    };
  } catch {
    return DEFAULT_POLICY;
  }
}

export function saveSendPolicy(policy: Omit<SendPolicy, "updatedAt">): SendPolicy {
  const next: SendPolicy = { ...policy, updatedAt: new Date().toISOString() };
  if (typeof window === "undefined") return next;
  window.localStorage.setItem(scopeKey(POLICY_KEY), JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(SEND_LEDGER_UPDATED_EVENT));
  return next;
}

function loadLedger(): SendLedgerEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(scopeKey(LEDGER_KEY));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as SendLedgerEntry[]) : [];
  } catch {
    return [];
  }
}

function saveLedger(entries: SendLedgerEntry[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(scopeKey(LEDGER_KEY), JSON.stringify(entries.slice(-500)));
  window.dispatchEvent(new CustomEvent(SEND_LEDGER_UPDATED_EVENT));
}

export function listSentHistory(limit = 60): SendLedgerEntry[] {
  return loadLedger().slice(-limit).reverse();
}

export function sentToday(): number {
  const today = dayKey(new Date().toISOString());
  return loadLedger().filter((entry) => dayKey(entry.sentAt) === today).length;
}

export function alreadySentTo(email: string): SendLedgerEntry | null {
  const target = email.trim().toLowerCase();
  return loadLedger().find((entry) => entry.to.toLowerCase() === target) || null;
}

export function recordSend(entry: Omit<SendLedgerEntry, "id" | "sentAt">): SendLedgerEntry {
  const full: SendLedgerEntry = {
    ...entry,
    id: `send-${Date.now()}-${Math.round(Math.random() * 1e4)}`,
    sentAt: new Date().toISOString(),
  };
  saveLedger([...loadLedger(), full]);
  return full;
}

export interface SendPermission {
  allowed: boolean;
  reason: string;
}

/**
 * The single gate every sender calls. `runSent` counts what this run has already put on the wire;
 * the daily count comes from the ledger.
 */
export function canSend(
  policy: SendPolicy,
  runSent: number,
  target: { email: string; sourcedFrom?: string; emailStatus?: string }
): SendPermission {
  const email = target.email.trim().toLowerCase();
  if (!email) return { allowed: false, reason: "No email address on this record. Nothing was invented to fill it." };
  if (target.sourcedFrom === "demo") {
    return { allowed: false, reason: "Demo pool record: this address was never sourced, so it cannot be mailed." };
  }
  if (target.sourcedFrom === "google_maps" && !target.emailStatus) {
    return { allowed: false, reason: "Places confirmed the business exists but returned no address. Find the person first." };
  }
  if (target.emailStatus === "unavailable") {
    return { allowed: false, reason: "Apollo holds no deliverable address for this contact." };
  }
  if (alreadySentTo(email)) {
    return { allowed: false, reason: `${email} already received a message from this account. The same record is not mailed twice.` };
  }
  if (runSent >= policy.capPerRun) {
    return { allowed: false, reason: `Run ceiling reached (${policy.capPerRun} per run). The rest stay queued for the next run.` };
  }
  if (sentToday() >= policy.capPerDay) {
    return { allowed: false, reason: `Daily ceiling reached (${policy.capPerDay} per day). Nothing more leaves today.` };
  }
  return { allowed: true, reason: "" };
}
