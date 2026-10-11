import { NextResponse } from "next/server";
import {
  isPlaceholderPhone,
  isRoleAddress,
  isFreeMailDomain,
  emailDomain,
  normaliseCompanyName,
  registrableDomain,
} from "@/lib/verification";

export const runtime = "nodejs";

export type HygieneAction =
  | "clear_phone"
  | "clear_claim"
  | "mark_needs_contact"
  | "merge_duplicate"
  | "review_only";

export interface HygieneProposal {
  id: string;
  type:
    | "duplicate_account"
    | "duplicate_contact"
    | "no_human_contact"
    | "placeholder_phone"
    | "invalid_domain"
    | "unsupported_claim"
    | "stale_record"
    | "implausible_value"
    | "personal_channel"
    | "role_address";
  severity: "high" | "medium" | "low";
  leadIds: string[];
  reason: string;
  suggestion: string;
  /** Reversible on the client: the rep's notes are kept so an undo restores them. */
  action: HygieneAction;
  evidence: string[];
}

interface Group {
  type: HygieneProposal["type"];
  severity: "high" | "medium" | "low";
  leadIds: string[];
  reason: string;
  suggestion: string;
  action: HygieneAction;
  evidence: string[];
}

const MAX_LEADS = 200;

const CLAIM_PATTERNS = [
  /APOLLO LIVE VERIFIED/i,
  /MX (record )?verif/i,
  /verified record/i,
  /100%\s*(MX )?valid/i,
  /deliverability/i,
  /corporate (registry|filing)/i,
  /handshake confirmed/i,
];

function daysBetween(iso: string | undefined, now: number): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.floor((now - t) / 86400000);
}

function hostOf(website: string): string {
  return registrableDomain(website || "");
}

export async function GET() {
  return NextResponse.json({
    status: "ok",
    agent: "Data Hygiene & Duplicate",
    mode: "proposes only — no record is merged, edited or deleted here",
  });
}

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const input = Array.isArray(body?.leads) ? body.leads : [];
  const leads = input.slice(0, MAX_LEADS);
  if (leads.length === 0) {
    return NextResponse.json({ error: "No leads supplied to inspect." }, { status: 400 });
  }

  const now = Date.now();
  const groups: Group[] = [];

  // --- duplicate accounts: same registrable website domain, or near-identical name ---
  const byDomain = new Map<string, string[]>();
  const byName = new Map<string, string[]>();
  const byEmail = new Map<string, string[]>();

  for (const lead of leads) {
    const id = String(lead?.id ?? "");
    const domain = hostOf(lead?.website || "") || emailDomain(lead?.email || "");
    if (domain && domain.includes(".")) {
      byDomain.set(domain, [...(byDomain.get(domain) || []), id]);
    }
    const name = normaliseCompanyName(String(lead?.company || ""));
    if (name) byName.set(name, [...(byName.get(name) || []), id]);
    const email = String(lead?.email || "").toLowerCase();
    if (email.includes("@")) byEmail.set(email, [...(byEmail.get(email) || []), id]);
  }

  // A name match inside the same domain is the same finding as the domain match,
  // so domain groups are collected first and name groups only add unseen id-sets.
  const seenAccountPairs = new Set<string>();

  for (const [domain, ids] of byDomain) {
    if (ids.length > 1) {
      const key = [...ids].sort().join("|");
      seenAccountPairs.add(key);
      groups.push({
        type: "duplicate_account",
        severity: "high",
        leadIds: ids,
        reason: `${ids.length} records claim the same company domain "${domain}".`,
        suggestion: "Review and merge into one account, keeping the record with the most evidence.",
        action: "merge_duplicate",
        evidence: [`registrable domain: ${domain}`, ...ids.map((id) => `lead ${id}`)],
      });
    }
  }

  for (const [name, ids] of byName) {
    const key = [...ids].sort().join("|");
    const domains = new Set(
      ids.map((id) => hostOf(String(leads.find((l: any) => String(l.id) === id)?.website || "")))
    );
    if (ids.length > 1 && domains.size === 1 && !seenAccountPairs.has(key)) {
      seenAccountPairs.add(key);
      groups.push({
        type: "duplicate_account",
        severity: "high",
        leadIds: ids,
        reason: `Identical company name "${name}" appears on ${ids.length} records with no domain difference.`,
        suggestion: "Merge these records; they are almost certainly the same account.",
        action: "merge_duplicate",
        evidence: [`normalised name: ${name}`],
      });
    }
  }

  for (const [email, ids] of byEmail) {
    if (ids.length > 1) {
      groups.push({
        type: "duplicate_contact",
        severity: "medium",
        leadIds: ids,
        reason: `The same address "${email}" is the contact on ${ids.length} records.`,
        suggestion: "Confirm which account this person actually belongs to before sending anything.",
        action: "review_only",
        evidence: [`email: ${email}`],
      });
    }
  }

  // --- per-record findings ---
  for (const lead of leads) {
    const id = String(lead?.id ?? "");
    const company = String(lead?.company ?? "");
    const name = String(lead?.name ?? "");
    const email = String(lead?.email ?? "");
    const phone = String(lead?.phone ?? "");
    const notes = String(lead?.notes ?? "");
    const evidence: string[] = [];

    if (company && name && normaliseCompanyName(name).startsWith(normaliseCompanyName(company))) {
      groups.push({
        type: "no_human_contact",
        severity: "high",
        leadIds: [id],
        reason: "The contact-name field contains the company name, so nobody is actually named.",
        suggestion: "Source a real person before outreach; do not send to this record as-is.",
        action: "mark_needs_contact",
        evidence: [`name: "${name}"`, `company: "${company}"`],
      });
    }

    if (phone && isPlaceholderPhone(phone)) {
      groups.push({
        type: "placeholder_phone",
        severity: "high",
        leadIds: [id],
        reason: `"${phone}" is a placeholder pattern, not a sourced number.`,
        suggestion: "Delete the value. Dialling it wastes rep time and may reach a stranger.",
        action: "clear_phone",
        evidence: [`phone: ${phone}`],
      });
    }

    if (email && isRoleAddress(email)) {
      groups.push({
        type: "role_address",
        severity: "medium",
        leadIds: [id],
        reason: `"${email}" is a shared mailbox, so it cannot identify a decision maker.`,
        suggestion: "Keep as a company contact point only; do not personalise to this address.",
        action: "review_only",
        evidence: [`email local part: ${email.split("@")[0]}`],
      });
    } else if (email && isFreeMailDomain(emailDomain(email))) {
      groups.push({
        type: "personal_channel",
        severity: "medium",
        leadIds: [id],
        reason: `"${email}" is a consumer mailbox, not corporate contact data.`,
        suggestion: "Treat as personal: lower priority, and check consent rules before cold mail.",
        action: "review_only",
        evidence: [`domain: ${emailDomain(email)}`],
      });
    }

    const domain = emailDomain(email);
    if (!domain || !domain.includes(".") || domain.includes(" ")) {
      groups.push({
        type: "invalid_domain",
        severity: "high",
        leadIds: [id],
        reason: domain ? `"${domain}" is not a valid mail domain.` : "No usable email address on this record.",
        suggestion: "Re-source the address; nothing sent here will arrive.",
        action: "review_only",
        evidence: [`email: ${email || "(empty)"}`],
      });
    }

    const claimMatch = CLAIM_PATTERNS.find((pattern) => pattern.test(notes));
    if (claimMatch) {
      groups.push({
        type: "unsupported_claim",
        severity: "high",
        leadIds: [id],
        reason: `The record asserts "${claimMatch.source.replace(/\\/g, "")}" but no verification run is attached to it.`,
        suggestion: "Strip the claim or re-run the Contact Resolution agent to back it with evidence.",
        action: "clear_claim",
        evidence: [`notes excerpt: ${notes.slice(0, 120)}`],
      });
    }

    const dealValue = Number(lead?.dealValue ?? 0);
    if (!Number.isFinite(dealValue) || dealValue <= 0) {
      groups.push({
        type: "implausible_value",
        severity: "low",
        leadIds: [id],
        reason: `Deal value is ${lead?.dealValue === undefined ? "missing" : `recorded as ${dealValue}`}.`,
        suggestion: "Set a value from a real quote or leave it blank rather than guessing.",
        action: "review_only",
        evidence: [`dealValue: ${String(lead?.dealValue)}`],
      });
    }

    const ageDays = daysBetween(lead?.lastContactedAt || lead?.createdAt, now);
    const stage = String(lead?.stage ?? "new");
    if (ageDays !== null && ageDays > 90 && stage === "new") {
      groups.push({
        type: "stale_record",
        severity: "low",
        leadIds: [id],
        reason: `Created or last touched ${ageDays} days ago and still sitting in "new".`,
        suggestion: "Re-verify or close it; stale records distort pipeline reporting.",
        action: "review_only",
        evidence: [`age: ${ageDays} days`, `stage: ${stage}`],
      });
    }
  }

  const proposals: HygieneProposal[] = groups.map((group) => ({
    ...group,
    // Stable across scans: re-running the same data must not look like a new proposal.
    id: [group.type, ...[...group.leadIds].sort()].join(":"),
  }));

  const summary = {
    leadsInspected: leads.length,
    truncated: input.length > leads.length,
    proposals: proposals.length,
    high: proposals.filter((p) => p.severity === "high").length,
    medium: proposals.filter((p) => p.severity === "medium").length,
    low: proposals.filter((p) => p.severity === "low").length,
    affectedLeads: new Set(proposals.flatMap((p) => p.leadIds)).size,
  };

  return NextResponse.json({
    success: true,
    agent: "Data Hygiene & Duplicate",
    note: "Nothing was changed. Each proposal needs your approval, and every apply can be undone.",
    summary,
    proposals,
  });
}
