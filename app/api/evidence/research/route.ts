import { NextResponse } from "next/server";
import {
  canAutoApply,
  emailDomain,
  isFreeMailDomain,
  isRoleAddress,
  looksLikePhoneValue,
  registrableDomain,
  checkMx,
  type EvidenceItem,
} from "@/lib/verification";
import { getGeminiKey, requestGeminiJson, missingGeminiKeyMessage } from "@/lib/gemini";
import { badRequest, daysBetween, domainOf, safeSources, toLead, truncateRun, failEnvelope, jsonEnvelope, okEnvelope } from "@/lib/agents";
import type { EvidenceResearchResult, PrivacyClass, ResolvedClaim } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const AGENT = "Evidence Research Agent";

interface ModelClaim {
  field?: string;
  value?: string;
  claim?: string;
  state?: string;
  confidence?: number;
  sources?: unknown;
  publishedAt?: string;
  privacy?: string;
  rationale?: string;
}

interface ModelResearch {
  queries?: unknown;
  claims?: ModelClaim[];
  questionsWorthAsking?: unknown;
}

function privacyClass(field: string, value: string): PrivacyClass {
  if (field === "phone" || field === "directMobile") {
    return looksLikePhoneValue(value) ? "personal-contact" : "unknown";
  }
  if (field === "email") {
    const domain = emailDomain(value);
    if (!domain) return "unknown";
    if (isFreeMailDomain(domain)) return "personal-contact";
    return isRoleAddress(value) ? "business-contact" : "business-contact";
  }
  if (field === "decisionMaker") return "personal-contact";
  return "company-fact";
}

function evidenceFromClaim(claim: ResolvedClaim, source: string): EvidenceItem[] {
  return [
    {
      id: `web-${claim.field}-${Math.random().toString(36).slice(2, 8)}`,
      field: claim.field,
      claim: claim.claim,
      state: claim.state === "supported" ? "verified" : claim.state === "contradicted" ? "contradicted" : "unverified",
      confidence: claim.confidence,
      source,
      method: "google_search_grounding",
      checkedAt: new Date().toISOString(),
      detail: claim.rationale,
    },
  ];
}

function healthCheck() {
  return NextResponse.json({
    status: "ok",
    agent: AGENT,
    provider: getGeminiKey() ? "google-gemini" : "none",
    hasKey: Boolean(getGeminiKey()),
    method: "Gemini with Google Search grounding; every claim must carry a live URL",
    writesRecords: false,
    highImpactPolicy: "email / phone / decision maker / deal value stay gated by the DNS-backed auto-apply rule",
  });
}

export async function GET() {
  return healthCheck();
}

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return badRequest(AGENT, "Body must be JSON.");
  }

  const rawList = Array.isArray(body?.accounts) ? body.accounts : Array.isArray(body?.leads) ? body.leads : [body?.lead ?? body?.account ?? body];
  const { items, truncated, considered } = truncateRun(rawList);
  const accounts = items.map(toLead).filter((l): l is NonNullable<typeof l> => l !== null);

  if (accounts.length === 0) {
    return badRequest(AGENT, "Send at least one account: { lead: { company, website, ... } }.");
  }
  if (!getGeminiKey()) {
    return jsonEnvelope(failEnvelope<EvidenceResearchResult>(AGENT, "no_key", missingGeminiKeyMessage(AGENT)), { status: 200 });
  }

  const focus = typeof body?.focus === "string" ? body.focus.slice(0, 300) : "";

  const results = await Promise.all(
    accounts.map(async (lead) => {
      const domain = domainOf(lead);

      const systemPrompt = `You are the Evidence Research Agent inside a sales CRM. You are a researcher, not a copywriter.

Non-negotiable rules:
- You may only report what a live search result actually says. If nothing was found, say so with state "not_found".
- Every claim needs a source URL that you truly retrieved. A claim with no URL must be reported with an empty sources array, and you must not write a confident value for it.
- Never invent phone numbers, email addresses, names, headcounts, revenue or funding figures. Never reuse a value the CRM already gave you as if you had confirmed it.
- Distinguish the company domain ("${domain || "unknown"}") from unrelated firms with similar names, and say which one you actually looked at.
- Contact details found on a personal profile (Gmail, Yahoo, a mobile number, a home address) are personal-contact data: report the privacy class honestly.
- Record dates as YYYY-MM-DD when the source shows one, otherwise leave publishedAt empty.

Answer with JSON only:
{
  "queries": ["the searches you ran"],
  "claims": [
    { "field": "one of: summary|employees|funding|techStack|hiring|decisionMaker|title|email|phone|website|linkedin|location|niche",
      "value": "the short factual value",
      "claim": "what you are asserting",
      "state": "supported|contradicted|not_found",
      "confidence": 0 to 1,
      "sources": [{ "uri": "https://...", "title": "...", "publishedAt": "YYYY-MM-DD or empty" }],
      "privacy": "business-contact|personal-contact|company-fact",
      "rationale": "one sentence on why this source is or is not trustworthy for this field" }
  ],
  "questionsWorthAsking": ["things a rep should ask on a call because public evidence is thin"]
}`;

      const userPrompt = `Account to research:
- company: ${lead.company || "(missing)"}
- stated website: ${lead.website || "(missing)"}
- registrable domain: ${domain || "(unknown)"}
- location: ${lead.location || "(missing)"}
- niche: ${lead.niche || "(missing)"}
- contact already on file: ${lead.name || "(none)"}${lead.title ? `, ${lead.title}` : ""}${lead.email ? `, ${lead.email}` : ""}
- CRM notes: ${lead.notes ? lead.notes.slice(0, 500) : "(none)"}

${focus ? `Rep's specific question: ${focus}\n` : ""}Research this account now. Target these fields in order: summary, website, decisionMaker + title, employees, funding, hiring, techStack, linkedin. Report "not_found" instead of guessing.`;

      const answer = await requestGeminiJson<ModelResearch>(systemPrompt, userPrompt, {
        temperature: 0.1,
        grounding: true,
      });

      if (!answer.ok) {
        return { error: answer.message, status: answer.status, result: null as EvidenceResearchResult | null };
      }

      const claims: ResolvedClaim[] = [];

      for (const raw of Array.isArray(answer.data?.claims) ? answer.data.claims.slice(0, 14) : []) {
        const field = String(raw?.field || "").trim().slice(0, 40);
        const value = String(raw?.value || "").trim().slice(0, 300);
        const text = String(raw?.claim || "").trim().slice(0, 400);
        if (!field || !text) continue;

        const sources = safeSources(raw?.sources);
        let state: ResolvedClaim["state"] =
          raw?.state === "supported" || raw?.state === "contradicted" || raw?.state === "not_found"
            ? raw.state
            : "not_found";
        let confidence = Number.isFinite(Number(raw?.confidence))
          ? Math.max(0, Math.min(1, Number(raw?.confidence)))
          : state === "not_found"
            ? 0
            : 0.4;
        let rationale = String(raw?.rationale || "").trim().slice(0, 400);

        // A claim the model could not cite is a hint, not evidence.
        if (sources.length === 0 && state === "supported") {
          state = "not_found";
          confidence = 0;
          rationale = `The model asserted this without retrieving a source, so it is stored as an open question: ${rationale || text}`;
        }

        const newest = sources.map((s) => daysBetween(s.publishedAt ?? null)).filter((d): d is number => d !== null);
        const freshnessDays = newest.length > 0 ? Math.min(...newest) : null;

        const privacy: PrivacyClass = privacyClass(field, value);

        const items: EvidenceItem[] = evidenceFromClaim(
          { field, value, claim: text, state, confidence, rationale } as ResolvedClaim,
          "web.search"
        );

        // Anything presenting as a company email gets a real MX lookup, so the
        // write gate rests on a check that ran here rather than on model faith.
        if (field === "email" && value.includes("@")) {
          const mailDomain = registrableDomain(emailDomain(value));
          const mx = await checkMx(mailDomain);
          if (mx.checked) {
            items.push({
              id: `dns-${Math.random().toString(36).slice(2, 8)}`,
              field: "email",
              claim: `Mail exchanger lookup for ${mailDomain}`,
              state: mx.hasMx ? "verified" : "contradicted",
              confidence: 0.85,
              source: "dns",
              method: "mx_lookup",
              checkedAt: new Date().toISOString(),
              detail: mx.hasMx
                ? `${mailDomain} publishes MX records (${mx.hosts.slice(0, 2).join(", ")}). The domain takes mail; this mailbox is still unproven.`
                : `${mailDomain} publishes no MX records, so mail to this address cannot be delivered.`,
            });
            if (!mx.hasMx) {
              state = "contradicted";
              rationale = `${rationale} Independently checked: ${mailDomain} has no mail server, so this address is unusable regardless of where it was found.`;
            }
          }
        }

        const gatedField =
          field === "decisionMaker" || field === "title" ? "decisionMaker" : field === "directMobile" ? "phone" : field;
        const autoApplyAllowed = canAutoApply(gatedField, items);

        const disposition: ResolvedClaim["disposition"] =
          state === "contradicted" ? "reject" : state === "supported" && autoApplyAllowed ? "write" : "stage_for_review";

        claims.push({
          field,
          value,
          claim: text,
          state,
          confidence: Math.round(confidence * 100) / 100,
          sources,
          freshnessDays,
          privacy,
          autoApplyAllowed,
          disposition,
          rationale,
        });
      }

      const result: EvidenceResearchResult = {
        account: lead.company || lead.name || "Unnamed account",
        domain,
        searchQueriesRun: (Array.isArray(answer.data?.queries) ? answer.data.queries : [])
          .map((q) => String(q).slice(0, 200))
          .filter(Boolean)
          .slice(0, 10),
        claims,
        questionsWorthAsking: (Array.isArray(answer.data?.questionsWorthAsking) ? answer.data.questionsWorthAsking : [])
          .map((q) => String(q).slice(0, 300))
          .filter(Boolean)
          .slice(0, 8),
        coverage: {
          checked: claims.length,
          supported: claims.filter((c) => c.state === "supported").length,
          contradicted: claims.filter((c) => c.state === "contradicted").length,
          notFound: claims.filter((c) => c.state === "not_found").length,
        },
      };

      return { error: null, status: "live" as const, result };
    })
  );

  const failed = results.find((r) => r.error);
  if (failed?.error) {
    return jsonEnvelope(
      failEnvelope<EvidenceResearchResult>(AGENT, failed.status, failed.error),
      { status: 200 }
    );
  }

  const collected = results.map((r) => r.result).filter((r): r is EvidenceResearchResult => r !== null);
  const primary = collected[0];

  if (!primary) {
    return jsonEnvelope(failEnvelope<EvidenceResearchResult>(AGENT, "provider_error", "Gemini returned no research payload."));
  }

  return jsonEnvelope(
    okEnvelope<EvidenceResearchResult & { allAccounts: EvidenceResearchResult[] }>(
      AGENT,
      "google-gemini",
      { ...primary, allAccounts: collected },
      `${collected.length} account(s) researched with live Google Search grounding. ${
        truncated ? `Capped at ${items.length} of ${considered} submitted records.` : ""
      } Nothing was written to any record: each claim is staged for your approval, and email/phone/decision-maker/deal-value stay locked behind the DNS-backed write rule.`
    )
  );
}
