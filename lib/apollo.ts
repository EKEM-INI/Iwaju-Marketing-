/**
 * Apollo.io sourcing.
 *
 * Apollo answers three different questions with three different endpoints:
 *
 *   organizations/search  -> companies (name, domain, industry, city, headcount, revenue, stage)
 *   mixed_people/api_search -> named people, plus their address and direct lines whenever the
 *                               account's entitlement already releases them
 *   people/match          -> the paid reveal for whatever the search withheld, billed per person
 *
 * Whatever Apollo does not return stays blank on the record: no contact@domain guesses, no
 * placeholder numbers, because a blank field can be chased down and an invented one gets mailed.
 */

export const APOLLO_ORGANIZATIONS_URL = "https://api.apollo.io/v1/organizations/search";
export const APOLLO_PEOPLE_SEARCH_URL = "https://api.apollo.io/api/v1/mixed_people/api_search";
export const APOLLO_PEOPLE_MATCH_URL = "https://api.apollo.io/api/v1/people/match";

export type ApolloEmailStatus =
  | "verified"
  | "predicted"
  | "unavailable"
  | "not_revealed"
  | "unknown";

export interface ApolloOrganization {
  id: string;
  name: string;
  domain: string;
  website: string;
  industry: string;
  employees: number | null;
  employeesLabel: string;
  revenue: string;
  stage: string;
  description: string;
  phone: string;
  city: string;
  state: string;
  country: string;
  address: string;
  linkedin: string;
  keywords: string[];
}

export interface ApolloPerson {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  title: string;
  domain: string;
  organizationName: string;
  linkedin: string;
  /** Present only when Apollo's account entitlement already carries the address for this person. */
  email: string;
  emailStatus: ApolloEmailStatus;
  phones: string[];
}

export interface ApolloReveal {
  email: string;
  emailStatus: ApolloEmailStatus;
  phones: string[];
  revealed: boolean;
  note: string;
}

type ApolloResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

export function apolloKey(): string | null {
  const key = process.env.APOLLO_API_KEY?.trim();
  return key && key.length > 0 ? key : null;
}

export function apolloConfigured(): boolean {
  return apolloKey() !== null;
}

async function callApollo<T>(url: string, payload: Record<string, unknown>): Promise<ApolloResult<T>> {
  const key = apolloKey();
  if (!key) {
    return { ok: false, status: 401, error: "APOLLO_API_KEY is not set in this build." };
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        "x-api-key": key,
      },
      body: JSON.stringify({ api_key: key, ...payload }),
      cache: "no-store",
    });
    const text = await res.text();
    let data: any = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      return { ok: false, status: res.status, error: `Apollo replied with a non-JSON body (HTTP ${res.status}).` };
    }
    if (!res.ok) {
      const message = data?.error || data?.message || data?.status || `HTTP ${res.status}`;
      return { ok: false, status: res.status, error: `Apollo rejected the request: ${message}` };
    }
    return { ok: true, data: data as T };
  } catch (err: any) {
    return { ok: false, status: 0, error: `Apollo could not be reached: ${err?.message || "network error"}` };
  }
}

const asArray = (value: unknown): any[] => (Array.isArray(value) ? value : []);

function str(value: unknown, max = 300): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function num(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

function firstStr(values: unknown[], max = 300): string {
  for (const value of values) {
    const s = str(value, max);
    if (s) return s;
  }
  return "";
}

/**
 * Apollo hands back placeholder addresses for people it will not release without a credit
 * (thisisredactedemail@apollo.org and similar). Treating those as real would put a bounce on
 * the domain, so they are read as "no address".
 */
function usableEmail(value: unknown): string {
  const email = str(value, 200).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return "";
  const host = email.split("@")[1] || "";
  if (host === "apollo.org" || host === "apollo.io" || host.startsWith("unavailable.")) return "";
  if (email.startsWith("thisisredacted") || email.startsWith("redacted") || email.startsWith("notavailable")) return "";
  if (email.includes("masked") || email.includes("xxxx")) return "";
  return email;
}

function usablePhones(value: unknown): string[] {
  const list = Array.isArray(value) ? value : [];
  const out: string[] = [];
  for (const entry of list) {
    const anyEntry = entry as any;
    const raw = firstStr([anyEntry?.sanitized_number, anyEntry?.number, anyEntry?.value, anyEntry?.phone], 40);
    if (!raw) continue;
    if (/[*x#]/i.test(raw)) continue;
    const digits = raw.replace(/\D/g, "");
    if (digits.length < 8) continue;
    if (!out.includes(raw)) out.push(raw);
    if (out.length >= 3) break;
  }
  return out;
}

function mapEmailStatus(raw: unknown): ApolloEmailStatus {
  const s = str(raw, 60).toLowerCase();
  if (!s) return "unknown";
  if (s.includes("unsub") || s.includes("invalid") || s.includes("bounce") || s.includes("disconnect")) return "unavailable";
  if (s.includes("verif") || s.includes("guessable") || s.includes("safe")) return "verified";
  if (s.includes("predict")) return "predicted";
  return "unknown";
}

function pickList(data: any, keys: string[]): any[] {
  for (const key of keys) {
    const list = asArray(data?.[key]);
    if (list.length > 0) return list;
  }
  return [];
}

export async function searchOrganizations(input: {
  keywordTags: string[];
  locations: string[];
  perPage?: number;
}): Promise<ApolloResult<ApolloOrganization[]>> {
  const answer = await callApollo<any>(APOLLO_ORGANIZATIONS_URL, {
    q_organization_keyword_tags: input.keywordTags,
    organization_locations: input.locations,
    page: 1,
    per_page: Math.min(Math.max(input.perPage ?? 20, 1), 100),
  });
  if (!answer.ok) return answer;

  const orgs = pickList(answer.data, ["organizations", "matches", "results"]).map((org: any): ApolloOrganization => {
    const website = firstStr([org.website_url, org.website], 300);
    const domain =
      firstStr([org.primary_domain, org.organization_domestic_url], 200).replace(/^https?:\/\/(www\.)?/i, "").split(/[/?#]/)[0] ||
      (website ? website.replace(/^https?:\/\/(www\.)?/i, "").split(/[/?#]/)[0] : "");
    return {
      id: str(org.id, 64),
      name: str(org.name, 200),
      domain,
      website,
      industry: firstStr([org.industry, org.industry_raw], 200),
      employees: num(org.estimated_num_employees),
      employeesLabel: firstStr([org.employees_range, org.estimated_num_employees_range], 60),
      revenue: firstStr([org.revenue, org.annual_revenue, org.revenue_current_usd], 60),
      stage: firstStr([org.company_stage, org.stage], 60),
      description: firstStr([org.short_description, org.description, org.about_the_company, org.tagline], 400),
      phone: firstStr([org.phone, org.phone_number, org.organization_phone_number], 40),
      city: str(org.city, 120),
      state: str(org.state, 120),
      country: str(org.country, 120),
      address: str(org.raw_address || [org.city, org.state, org.country].filter(Boolean).join(", "), 300),
      linkedin: firstStr([org.linkedin_url, org.linked_in_url], 300),
      keywords: (Array.isArray(org.keyword_tags) ? org.keyword_tags : Array.isArray(org.keywords) ? org.keywords : [])
        .map((k: unknown) => str(k, 60))
        .filter(Boolean)
        .slice(0, 12),
    };
  });

  return { ok: true, data: orgs.filter((o) => o.name) };
}

/**
 * Named decision-makers at the given domains.
 *
 * Apollo intersects the filters: domains AND job titles AND locations. That intersection is
 * routinely empty for a real company because Apollo stores a person's location as "Lagos,
 * Nigeria" while the caller asked for "Lekki", and a title as "Co-Founder & CEO" while the
 * caller asked for "ceo". When that happens the old behaviour was to report no people, skip
 * every reveal, spend nothing and hand back a list with blank emails. So any domain the
 * filtered pass missed is asked for again with no title or location filter.
 */
async function queryPeople(
  input: { domains: string[]; titles: string[]; locations: string[]; perPage?: number },
  useFilters: boolean
): Promise<ApolloResult<ApolloPerson[]>> {
  const perPage = Math.min(Math.max(input.perPage ?? 20, 1), 100);
  const titles = useFilters ? input.titles : [];
  const locations = useFilters ? input.locations : [];

  // Apollo documents these filters as repeated query parameters, while most SDK examples post them
  // as JSON. Both are sent: the key stays out of the URL so it cannot land in a request log.
  const search = new URL(APOLLO_PEOPLE_SEARCH_URL);
  input.domains.slice(0, 10).forEach((d) => search.searchParams.append("q_organization_domains_list[]", d));
  titles.slice(0, 12).forEach((t) => search.searchParams.append("person_titles[]", t));
  locations.slice(0, 6).forEach((l) => search.searchParams.append("person_locations[]", l));
  search.searchParams.set("page", "1");
  search.searchParams.set("per_page", String(perPage));

  const answer = await callApollo<any>(search.toString(), {
    q_organization_domains_list: input.domains,
    person_titles: titles,
    person_locations: locations,
    page: 1,
    per_page: perPage,
  });
  if (!answer.ok) return answer;

  const people = pickList(answer.data, ["people", "matches", "results", "data"]).map((p: any): ApolloPerson => {
    const org = p.organization || p.organization_mapped_from_source || {};
    const first = str(p.first_name, 80);
    const last = str(p.last_name || p.last_name_obfuscated, 80);
    const email = usableEmail(p.email || p.email_address);
    return {
      id: str(p.id, 64),
      name: str(p.name, 120) || [first, last].filter(Boolean).join(" "),
      firstName: first,
      lastName: last,
      title: firstStr([p.title, p.english_title], 160),
      domain: firstStr([org.primary_domain, p.email_domain, p.organization_domestic_url], 200)
        .replace(/^https?:\/\/(www\.)?/i, "")
        .split(/[/?#]/)[0],
      organizationName: str(org.name, 200),
      linkedin: firstStr([p.linked_in_url, p.linkedin_url], 300),
      email,
      emailStatus: email ? mapEmailStatus(p.email_status || p.email_state) : "not_revealed",
      phones: usablePhones(p.phone_numbers || p.phone_data),
    };
  });

  return { ok: true, data: people.filter((p) => p.id || p.name) };
}

export async function searchPeople(input: {
  domains: string[];
  titles: string[];
  locations: string[];
  perPage?: number;
}): Promise<ApolloResult<ApolloPerson[]>> {
  const strict = await queryPeople(input, true);
  if (!strict.ok) return strict;

  const wanted = input.domains.map((d) => d.toLowerCase()).filter(Boolean);
  const covered = new Set(strict.data.map((p) => p.domain.toLowerCase()).filter(Boolean));
  const missed = wanted.filter((d) => !covered.has(d));
  if (missed.length === 0) return strict;

  const loose = await queryPeople({ ...input, domains: missed.slice(0, 10) }, false);
  if (!loose.ok) return strict;

  const byKey = new Map<string, ApolloPerson>();
  for (const person of [...strict.data, ...loose.data]) {
    const key = person.id || `${person.domain}|${person.name}`;
    if (!byKey.has(key)) byKey.set(key, person);
  }
  return { ok: true, data: Array.from(byKey.values()) };
}

/**
 * people/match is the call that buys contact details. It bills per person for the address, and
 * a direct-dial number is billed on top where Apollo holds one, so both are asked for together.
 */
export async function revealPerson(person: ApolloPerson, domain: string): Promise<ApolloReveal> {
  if (!person.id && !person.firstName) {
    return { email: "", emailStatus: "not_revealed", phones: [], revealed: false, note: "Apollo returned no person id or first name to match on." };
  }

  const answer = await callApollo<any>(APOLLO_PEOPLE_MATCH_URL, {
    id: person.id || undefined,
    first_name: person.firstName || undefined,
    last_name: person.lastName || undefined,
    name: person.name || undefined,
    // Apollo's enrichment matches on the company website or name, not a domain field.
    website_url: domain ? `https://${domain}` : person.domain ? `https://${person.domain}` : undefined,
    organization_name: person.organizationName || undefined,
    reveal_email_verification: true,
    reveal_personal_emails: true,
    reveal_phone_number: true,
    web_call_enabled: false,
  });

  if (!answer.ok) {
    return { email: "", emailStatus: "unknown", phones: [], revealed: false, note: answer.error };
  }

  const matched = answer.data?.person || answer.data?.record || answer.data?.match || answer.data;
  const email = usableEmail(matched?.email || matched?.email_address);
  const phones = usablePhones(matched?.phone_numbers || matched?.phone_updates || matched?.phone_data);
  const rawStatus = str(matched?.email_status, 60).toLowerCase();

  if (!email && phones.length === 0) {
    return {
      email: "",
      emailStatus: matched ? "unavailable" : "unknown",
      phones: [],
      revealed: false,
      note: matched
        ? "Apollo matched this person but holds no mailable address or direct line for them. The contact is real; the channel is not."
        : "Apollo returned no match for this person.",
    };
  }

  return {
    email,
    emailStatus: email ? mapEmailStatus(matched?.email_status) : "unavailable",
    phones,
    revealed: true,
    note: [
      email ? `Apollo reports the address as ${rawStatus || "unclassified"}.` : "Apollo returned no address for this person.",
      phones.length ? `Apollo returned ${phones.length} direct line(s).` : "",
    ]
      .filter(Boolean)
      .join(" "),
  };
}
