/**
 * Apollo.io sourcing.
 *
 * Apollo answers three different questions with three different endpoints, and only one of
 * them produces a mail address:
 *
 *   organizations/search  -> companies (name, domain, industry, city, headcount)
 *   mixed_people_search   -> named people at those companies, never their email
 *   people/match          -> the actual address, and it bills Apollo credits per person
 *
 * So a lead can be real about the company and the human while still having no address at
 * all. That state is returned as `email: ""` with `emailStatus: "not_revealed"` instead of
 * being filled in with contact@company.com, because a guessed address bounces and a bouncing
 * sender teaches Gmail to distrust the domain.
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
  city: string;
  state: string;
  country: string;
  address: string;
  linkedin: string;
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
}

export interface ApolloReveal {
  email: string;
  emailStatus: ApolloEmailStatus;
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
    const website = str(org.website_url || org.website, 300);
    const domain =
      str(org.primary_domain, 200) ||
      (website ? website.replace(/^https?:\/\/(www\.)?/i, "").split(/[/?#]/)[0] : "");
    return {
      id: str(org.id, 64),
      name: str(org.name, 200),
      domain,
      website,
      industry: str(org.industry || org.industry_raw || org.stage, 200),
      employees: num(org.estimated_num_employees),
      city: str(org.city, 120),
      state: str(org.state, 120),
      country: str(org.country, 120),
      address: str(org.raw_address || [org.city, org.state, org.country].filter(Boolean).join(", "), 300),
      linkedin: str(org.linkedin_url, 300),
    };
  });

  return { ok: true, data: orgs.filter((o) => o.name) };
}

/**
 * Named decision-makers at the given domains. Apollo returns these without addresses,
 * which is why the caller must decide whether spending credits on people/match is worth it.
 */
export async function searchPeople(input: {
  domains: string[];
  titles: string[];
  locations: string[];
  perPage?: number;
}): Promise<ApolloResult<ApolloPerson[]>> {
  // Apollo documents these filters as repeated query parameters, while most SDK examples post them
  // as JSON. Both are sent: the key stays out of the URL so it cannot land in a request log.
  const search = new URL(APOLLO_PEOPLE_SEARCH_URL);
  input.domains.slice(0, 10).forEach((d) => search.searchParams.append("q_organization_domains_list[]", d));
  input.titles.slice(0, 12).forEach((t) => search.searchParams.append("person_titles[]", t));
  input.locations.slice(0, 6).forEach((l) => search.searchParams.append("person_locations[]", l));
  search.searchParams.set("page", "1");
  search.searchParams.set("per_page", String(Math.min(Math.max(input.perPage ?? 20, 1), 100)));

  const answer = await callApollo<any>(search.toString(), {
    q_organization_domains_list: input.domains,
    person_titles: input.titles,
    person_locations: input.locations,
    page: 1,
    per_page: Math.min(Math.max(input.perPage ?? 20, 1), 100),
  });
  if (!answer.ok) return answer;

  const people = pickList(answer.data, ["people", "matches", "results", "data"]).map((p: any): ApolloPerson => {
    const org = p.organization || p.organization_mapped_from_source || {};
    const first = str(p.first_name, 80);
    const last = str(p.last_name || p.last_name_obfuscated, 80);
    return {
      id: str(p.id, 64),
      name: str(p.name) || [first, last].filter(Boolean).join(" "),
      firstName: first,
      lastName: last,
      title: str(p.title, 160),
      domain: str(org.primary_domain || p.email_domain, 200),
      organizationName: str(org.name, 200),
      linkedin: str(p.linked_in_url || p.linkedin_url, 300),
    };
  });

  return { ok: true, data: people.filter((p) => p.id || p.name) };
}

/**
 * people/match is the only call that yields an address and it bills per person, so the
 * caller asks for it explicitly rather than the search quietly spending credits.
 */
export async function revealPersonEmail(person: ApolloPerson, domain: string): Promise<ApolloReveal> {
  if (!person.id && !person.firstName) {
    return { email: "", emailStatus: "not_revealed", revealed: false, note: "Apollo returned no person id or first name to match on." };
  }

  const answer = await callApollo<any>(APOLLO_PEOPLE_MATCH_URL, {
    id: person.id || undefined,
    first_name: person.firstName || undefined,
    last_name: person.lastName || undefined,
    name: person.name || undefined,
    // Apollo's enrichment matches on the company website or name, not a domain field.
    website_url: domain ? `https://${domain}` : undefined,
    organization_name: person.organizationName || undefined,
    reveal_email_verification: true,
    reveal_personal_emails: true,
    web_call_enabled: false,
  });

  if (!answer.ok) {
    return { email: "", emailStatus: "unknown", revealed: false, note: answer.error };
  }

  const matched = answer.data?.person || answer.data?.record || answer.data?.match || answer.data;
  const email = str(matched?.email || matched?.email_address, 200).toLowerCase();
  const rawStatus = str(matched?.email_status, 60).toLowerCase();

  if (!email) {
    return {
      email: "",
      emailStatus: "unavailable",
      revealed: false,
      note: "Apollo found the person but holds no address for them, so this contact cannot be mailed.",
    };
  }

  const status: ApolloEmailStatus =
    rawStatus.includes("verif") || rawStatus.includes("guessable")
      ? "verified"
      : rawStatus.includes("predict")
        ? "predicted"
        : rawStatus.includes("unsub") || rawStatus.includes("invalid") || rawStatus.includes("bounce")
          ? "unavailable"
          : "unknown";

  return {
    email,
    emailStatus: status,
    revealed: true,
    note: rawStatus ? `Apollo reports this address as ${rawStatus}.` : "Apollo returned the address without a status.",
  };
}
