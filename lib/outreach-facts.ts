import type { Lead } from "@/types";
import {
  isRoleAddress,
  isFreeMailDomain,
  emailDomain,
  normaliseCompanyName,
  isPlaceholderPhone,
} from "@/lib/address-class";

/**
 * A single line of information on the record that the writer could be allowed to state.
 * `approvedByDefault` is false whenever the value is personal, internal, or nothing
 * more than the rep's own note — the writer may only use what the rep ticks.
 */
export interface FactCandidate {
  id: string;
  field: string;
  label: string;
  value: string;
  source: string;
  approvedByDefault: boolean;
  note?: string;
}

export function factsFromLead(lead: Lead): FactCandidate[] {
  const out: FactCandidate[] = [];
  const add = (
    id: string,
    field: string,
    label: string,
    value: string,
    source: string,
    approvedByDefault: boolean,
    note?: string
  ) => {
    const trimmed = (value || "").trim();
    if (!trimmed) return;
    out.push({ id: `${lead.id}:${id}`, field, label, value: trimmed, source, approvedByDefault, note });
  };

  const email = (lead.email || "").trim().toLowerCase();
  const domain = emailDomain(email);
  const emailIsCorporate =
    Boolean(email) && !isRoleAddress(email) && !isFreeMailDomain(domain);

  const nameIsCompany =
    Boolean(lead.company) &&
    Boolean(lead.name) &&
    (normaliseCompanyName(lead.name) === normaliseCompanyName(lead.company) ||
      normaliseCompanyName(lead.name).startsWith(normaliseCompanyName(lead.company)));

  add("company", "company", "Company name", lead.company, "crm record", true);
  add("niche", "niche", "Sector / niche", lead.niche, "crm record", true);
  add("location", "location", "Location", lead.location, "crm record", true);
  add("website", "website", "Website on record", lead.website, "crm record", true);

  add(
    "decisionMaker",
    "decisionMaker",
    "Contact name and title",
    [lead.name, lead.title].filter(Boolean).join(", "),
    "crm record",
    !nameIsCompany && Boolean(lead.title) && emailIsCorporate,
    nameIsCompany
      ? "The name field repeats the company name, so there is no person to address."
      : !lead.title
      ? "No job title recorded, so seniority is a guess."
      : !emailIsCorporate
      ? "The mailbox looks shared or personal, which weakens the identity behind it."
      : undefined
  );

  add(
    "email",
    "email",
    "Email address",
    email,
    "crm record",
    false,
    emailIsCorporate
      ? "Not deliverability-checked here. Tick only if you have confirmed this address."
      : "Shared or consumer mailbox — it identifies no person."
  );

  add(
    "phone",
    "phone",
    "Phone number",
    lead.phone,
    "crm record",
    false,
    isPlaceholderPhone(lead.phone)
      ? "Placeholder pattern: this number was never sourced. Do not dial or quote it."
      : "Personal channel. Copy should not quote numbers."
  );

  add(
    "dealValue",
    "dealValue",
    "Deal value (internal)",
    lead.dealValue ? `${lead.currency || "NGN"} ${lead.dealValue.toLocaleString()}` : "",
    "crm record",
    false,
    "Internal sizing. Never stated to the prospect."
  );

  add(
    "notes",
    "notes",
    "Rep notes on the record",
    lead.notes,
    "rep note",
    false,
    "Your own note, not a sourced fact. Tick it only if you can stand behind the claim."
  );

  add("tags", "tags", "Tags", (lead.tags || []).join(", "), "crm record", false, "Labels, not evidence.");

  return out;
}

/** Removes the [factId] audit markers before copy goes into the editable email. */
export function stripCitations(text: string): string {
  return text.replace(/\s*\[[a-z0-9:_-]+\]/gi, "");
}
