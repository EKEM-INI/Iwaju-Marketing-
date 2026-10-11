import { promises as dns } from "node:dns";
import {
  normaliseCompanyName,
  registrableDomain,
  emailDomain,
  emailLocalPart,
  isFreeMailDomain,
  isRoleAddress,
  looksLikePhoneNumber,
  isPlaceholderPhone,
} from "@/lib/address-class";

export * from "@/lib/address-class";

export type VerificationState = "verified" | "unverified" | "contradicted";

export interface EvidenceItem {
  id: string;
  field: string;
  claim: string;
  state: VerificationState;
  confidence: number;
  source: string;
  method: string;
  checkedAt: string;
  detail: string;
}

export interface ContactRecord {
  name?: string;
  title?: string;
  email?: string;
  phone?: string;
  company?: string;
  website?: string;
}

export type ChannelClass = "corporate" | "personal" | "role" | "unknown";

export interface ContactResolution {
  verdict: "resolved" | "needs_evidence" | "contradicted";
  channelClass: ChannelClass;
  personIsHuman: boolean;
  evidence: EvidenceItem[];
  blockers: string[];
  writableFields: Record<string, boolean>;
}

export interface MxResult {
  checked: boolean;
  hasMx: boolean;
  hosts: string[];
  error?: string;
}

const mxCache = new Map<string, { at: number; result: MxResult }>();
const MX_CACHE_MS = 10 * 60 * 1000;

export async function checkMx(domain: string): Promise<MxResult> {
  const cached = mxCache.get(domain);
  if (cached && Date.now() - cached.at < MX_CACHE_MS) return cached.result;

  let result: MxResult;
  try {
    const records = await Promise.race([
      dns.resolveMx(domain),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("DNS lookup timed out")), 4000)),
    ]);
    const hosts = (records || [])
      .sort((a, b) => a.priority - b.priority)
      .map((r) => r.exchange.toLowerCase().replace(/\.$/, ""))
      .filter(Boolean);
    result = { checked: true, hasMx: hosts.length > 0, hosts };
  } catch (err: any) {
    const code = err?.code || "";
    // ENODATA / ENOTFOUND / ECONNREFUSED all mean "this domain cannot receive mail"
    // in a way the rep needs to know, so they are a real finding, not a skipped check.
    if (["ENODATA", "ENOTFOUND", "ESERVFAIL", "EFORMERR"].includes(code)) {
      result = { checked: true, hasMx: false, hosts: [], error: code };
    } else {
      result = { checked: false, hasMx: false, hosts: [], error: err?.message || String(err) };
    }
  }

  mxCache.set(domain, { at: Date.now(), result });
  return result;
}

function evidence(partial: Omit<EvidenceItem, "id" | "checkedAt">): EvidenceItem {
  return {
    ...partial,
    id: `ev-${partial.field}-${partial.method}-${Math.random().toString(36).slice(2, 8)}`,
    checkedAt: new Date().toISOString(),
  };
}

const HIGH_IMPACT_FIELDS = ["email", "phone", "decisionMaker", "dealValue"];

/** Sources that involve an actual external check, as opposed to reading the record back. */
const REAL_CHECK_SOURCES = new Set(["dns"]);

/**
 * A high-impact field may only be written from a check that actually ran against a
 * real source. Model judgement, heuristics and inherited notes never qualify.
 */
export function canAutoApply(field: string, items: EvidenceItem[]): boolean {
  if (!HIGH_IMPACT_FIELDS.includes(field)) return true;
  const relevant = items.filter((e) => e.field === field);
  if (relevant.length === 0) return false;
  if (relevant.some((e) => e.state === "contradicted")) return false;
  return relevant.some(
    (e) => e.state === "verified" && e.confidence >= 0.8 && REAL_CHECK_SOURCES.has(e.source)
  );
}

export async function resolveContact(input: ContactRecord): Promise<ContactResolution> {
  const evidenceItems: EvidenceItem[] = [];
  const blockers: string[] = [];

  const name = (input.name || "").trim();
  const email = (input.email || "").trim().toLowerCase();
  const phone = (input.phone || "").trim();
  const company = (input.company || "").trim();
  const website = (input.website || "").trim();
  const title = (input.title || "").trim();

  // --- identity: is there a human at all? ---
  const nameIsCompany =
    company.length > 0 &&
    name.length > 0 &&
    (normaliseCompanyName(name) === normaliseCompanyName(company) ||
      normaliseCompanyName(name).startsWith(normaliseCompanyName(company)));

  if (!name) {
    blockers.push("No contact name on record.");
    evidenceItems.push(
      evidence({
        field: "decisionMaker",
        claim: "Decision maker identity",
        state: "unverified",
        confidence: 0,
        source: "crm.record",
        method: "presence_check",
        detail: "The record has no person name, so no identity can be resolved.",
      })
    );
  } else if (nameIsCompany) {
    blockers.push("The name field holds the company name, not a person.");
    evidenceItems.push(
      evidence({
        field: "decisionMaker",
        claim: "Decision maker identity",
        state: "contradicted",
        confidence: 0.95,
        source: "crm.record",
        method: "name_vs_company_comparison",
        detail: `"${name}" matches the account name, so this record has no human contact.`,
      })
    );
  } else {
    evidenceItems.push(
      evidence({
        field: "decisionMaker",
        claim: "A person name is present",
        state: "unverified",
        confidence: 0.4,
        source: "crm.record",
        method: "presence_check",
        detail: `"${name}" is present but not confirmed against any employer source.`,
      })
    );
  }

  if (!title) blockers.push("No job title recorded.");

  // --- email channel ---
  const eDomain = emailDomain(email);
  let channelClass: ChannelClass = "unknown";
  let personIsHuman = !nameIsCompany && name.length > 0;

  if (!email || !eDomain) {
    blockers.push("No usable email address.");
    evidenceItems.push(
      evidence({
        field: "email",
        claim: "Email address present",
        state: "unverified",
        confidence: 0,
        source: "crm.record",
        method: "presence_check",
        detail: "The record has no email address to resolve.",
      })
    );
  } else {
    const isRole = isRoleAddress(email);
    const isFree = isFreeMailDomain(eDomain);

    if (isRole) {
      channelClass = "role";
      personIsHuman = false;
      blockers.push(`"${email}" is a shared role address, so it does not identify a person.`);
      evidenceItems.push(
        evidence({
          field: "email",
          claim: "Address type",
          state: "verified",
          confidence: 0.99,
          source: "address-syntax",
          method: "role_address_check",
          detail: `"${email}" is a generic mailbox, not a personal one.`,
        })
      );
    } else if (isFree) {
      channelClass = "personal";
      blockers.push(`"${eDomain}" is a free consumer mailbox: a personal channel, not a corporate one.`);
      evidenceItems.push(
        evidence({
          field: "email",
          claim: "Address type",
          state: "verified",
          confidence: 0.99,
          source: "address-syntax",
          method: "free_mail_check",
          detail: `"${email}" is on a consumer provider, so treat it as personal contact data.`,
        })
      );
    } else {
      channelClass = "corporate";
    }

    // domain vs stated website
    if (website) {
      const siteDomain = registrableDomain(website);
      const mailDomain = registrableDomain(eDomain);
      const matches = siteDomain === mailDomain;
      evidenceItems.push(
        evidence({
          field: "email",
          claim: `Email domain vs company website (${siteDomain})`,
          state: matches ? "verified" : "contradicted",
          confidence: 0.9,
          source: "domain-comparison",
          method: "registrable_domain_match",
          detail: matches
            ? `"${mailDomain}" matches the website the record carries.`
            : `Email is on "${mailDomain}" but the website is "${siteDomain}". These are different companies unless proven related.`,
        })
      );
      if (!matches) blockers.push("Email domain does not match the company website.");
    }

    // REAL DNS check
    const mx = await checkMx(eDomain);
    if (!mx.checked) {
      evidenceItems.push(
        evidence({
          field: "email",
          claim: "Mail exchanger lookup",
          state: "unverified",
          confidence: 0,
          source: "dns",
          method: "mx_lookup",
          detail: `The DNS lookup did not complete (${mx.error || "unknown reason"}), so deliverability is unknown.`,
        })
      );
    } else if (mx.hasMx) {
      evidenceItems.push(
        evidence({
          field: "email",
          claim: "Mail exchanger lookup",
          state: "verified",
          confidence: 0.85,
          source: "dns",
          method: "mx_lookup",
          detail: `"${eDomain}" publishes MX records (${mx.hosts.slice(0, 3).join(", ")}). This proves the DOMAIN accepts mail — it does not prove this specific mailbox exists.`,
        })
      );
    } else {
      evidenceItems.push(
        evidence({
          field: "email",
          claim: "Mail exchanger lookup",
          state: "contradicted",
          confidence: 0.97,
          source: "dns",
          method: "mx_lookup",
          detail: `"${eDomain}" publishes no MX records, so mail to this address cannot be delivered.`,
        })
      );
      blockers.push(`No mail server exists for ${eDomain}.`);
    }
  }

  // --- phone channel: no carrier check is wired up, so we can only reject fakes ---
  if (!phone) {
    blockers.push("No phone number recorded.");
  } else if (isPlaceholderPhone(phone)) {
    evidenceItems.push(
      evidence({
        field: "phone",
        claim: "Phone number plausibility",
        state: "contradicted",
        confidence: 0.98,
        source: "crm.record",
        method: "placeholder_detection",
        detail: `"${phone}" is a placeholder pattern, not a sourced number. Remove it rather than dial it.`,
      })
    );
    blockers.push("The phone number on this record is a placeholder.");
  } else if (!looksLikePhoneNumber(phone)) {
    evidenceItems.push(
      evidence({
        field: "phone",
        claim: "Phone number format",
        state: "contradicted",
        confidence: 0.9,
        source: "crm.record",
        method: "format_check",
        detail: `"${phone}" is not a valid international number.`,
      })
    );
  } else {
    evidenceItems.push(
      evidence({
        field: "phone",
        claim: "Phone number reachability",
        state: "unverified",
        confidence: 0.3,
        source: "crm.record",
        method: "format_check",
        detail: `"${phone}" is well formed but has not been confirmed by a carrier or live call.`,
      })
    );
  }

  const hasContradiction = evidenceItems.some((e) => e.state === "contradicted");
  const verifiedCount = evidenceItems.filter((e) => e.state === "verified").length;

  const writableFields: Record<string, boolean> = {
    email: canAutoApply("email", evidenceItems),
    phone: canAutoApply("phone", evidenceItems),
    decisionMaker: canAutoApply("decisionMaker", evidenceItems),
  };

  return {
    verdict: hasContradiction ? "contradicted" : verifiedCount >= 2 ? "resolved" : "needs_evidence",
    channelClass,
    personIsHuman,
    evidence: evidenceItems,
    blockers,
    writableFields,
  };
}
