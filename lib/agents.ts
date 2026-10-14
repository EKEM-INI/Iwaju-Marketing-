import type { AgentEnvelope, AgentStatus, Lead } from "@/types";
import { emailDomain, registrableDomain } from "@/lib/address-class";

/**
 * Shared plumbing for the trust-layer agents. Deliberately free of any
 * provider or Node-only import so client components can reuse it too.
 */

export const MAX_RECORDS = 40;

export function ranAt(): string {
  return new Date().toISOString();
}

export function okEnvelope<T>(agent: string, provider: string, data: T, note?: string): AgentEnvelope<T> {
  return { success: true, agent, status: "live", provider, live: provider !== "deterministic", ranAt: ranAt(), note, data };
}

/** A rules-only agent that ran successfully: honest about having used no model. */
export function deterministicEnvelope<T>(agent: string, data: T, note?: string): AgentEnvelope<T> {
  return { success: true, agent, status: "live", provider: "deterministic", live: false, ranAt: ranAt(), note, data };
}

export function failEnvelope<T>(
  agent: string,
  status: AgentStatus,
  message: string,
  provider = "none"
): AgentEnvelope<T> {
  return { success: false, agent, status, provider, live: false, ranAt: ranAt(), error: message };
}

export function jsonEnvelope<T>(envelope: AgentEnvelope<T>, init?: ResponseInit) {
  return Response.json(envelope, init);
}

export function badRequest(agent: string, message: string) {
  return jsonEnvelope(failEnvelope<null>(agent, "bad_request", message), { status: 400 });
}

export function emptyInput(agent: string, message: string) {
  return jsonEnvelope(failEnvelope<null>(agent, "empty_input", message), { status: 400 });
}

const TEXT = (v: unknown, max = 400): string =>
  typeof v === "string" ? v.trim().slice(0, max) : v == null ? "" : String(v).slice(0, max);

/**
 * Leads arrive from the browser, so treat every field as hostile input:
 * stringify, trim, cap. Numbers are coerced, never trusted.
 */
export function toLead(input: any): Lead | null {
  if (!input || typeof input !== "object") return null;
  const id = TEXT(input.id ?? input.leadId, 64);
  const company = TEXT(input.company, 200);
  if (!id && !company) return null;

  const dealValue = Number(input.dealValue);
  const stage = ["new", "contacted", "meeting", "closed"].includes(input.stage) ? input.stage : "new";

  return {
    id,
    name: TEXT(input.name, 120),
    title: TEXT(input.title, 120),
    company,
    email: TEXT(input.email, 200).toLowerCase(),
    phone: TEXT(input.phone, 40),
    website: TEXT(input.website, 200),
    niche: TEXT(input.niche, 200),
    location: TEXT(input.location, 200),
    stage,
    dealValue: Number.isFinite(dealValue) && dealValue > 0 ? Math.round(dealValue) : 0,
    currency: TEXT(input.currency, 8).toUpperCase() || "NGN",
    score: Number.isFinite(Number(input.score)) ? Math.max(0, Math.min(100, Math.round(Number(input.score)))) : 0,
    notes: TEXT(input.notes, 2000),
    tags: Array.isArray(input.tags) ? input.tags.map((t: unknown) => TEXT(t, 40)).filter(Boolean).slice(0, 20) : [],
    createdAt: TEXT(input.createdAt, 40) || new Date().toISOString(),
    lastContactedAt: input.lastContactedAt ? TEXT(input.lastContactedAt, 40) : undefined,
    contactMethod: ["email", "phone", "linkedin"].includes(input.contactMethod) ? input.contactMethod : undefined,
    sourcedFrom: ["apollo", "google_maps", "demo", "manual"].includes(input.sourcedFrom) ? input.sourcedFrom : undefined,
    emailStatus: ["verified", "predicted", "unavailable", "not_revealed", "unknown"].includes(input.emailStatus)
      ? input.emailStatus
      : undefined,
    apolloPersonId: input.apolloPersonId ? TEXT(input.apolloPersonId, 64) : undefined,
  };
}

export function toLeads(input: any, cap = MAX_RECORDS): { leads: Lead[]; truncated: boolean } {
  const raw = Array.isArray(input) ? input : [];
  const leads = raw.map(toLead).filter((l): l is Lead => l !== null);
  return { leads, truncated: raw.length > leads.length || raw.length > cap };
}

export function domainOf(lead: Lead): string | null {
  const fromSite = registrableDomain(lead.website);
  if (fromSite && fromSite.includes(".")) return fromSite;
  const fromMail = emailDomain(lead.email);
  if (fromMail) return registrableDomain(fromMail);
  return null;
}

export function daysBetween(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.round((Date.now() - t) / 86400000));
}

export function clampScore(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : fallback;
}

export function asStringArray(value: unknown, max = 12): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => (typeof v === "string" ? v.trim() : v == null ? "" : String(v)))
    .filter(Boolean)
    .slice(0, max);
}

/** Only http(s) reaches the browser as a clickable source. */
export function safeSources(value: unknown, max = 6): { uri: string; title?: string; publishedAt?: string }[] {
  if (!Array.isArray(value)) return [];
  const out: { uri: string; title?: string; publishedAt?: string }[] = [];
  for (const item of value) {
    const uri = typeof item === "string" ? item.trim() : TEXT(item?.uri, 300);
    if (!/^https?:\/\//i.test(uri)) continue;
    if (out.some((s) => s.uri === uri)) continue;
    const title = TEXT(item && typeof item !== "string" ? item.title : "", 200);
    const publishedAt = TEXT(item && typeof item !== "string" ? item.publishedAt : "", 40);
    out.push({ uri, title: title || undefined, publishedAt: publishedAt || undefined });
    if (out.length >= max) break;
  }
  return out;
}

export function truncateRun<T>(items: T[], cap = MAX_RECORDS) {
  return { items: items.slice(0, cap), truncated: items.length > cap, considered: items.length };
}
