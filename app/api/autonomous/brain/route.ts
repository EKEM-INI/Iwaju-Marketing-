import { NextResponse } from "next/server";
import { requestChatGptJson, getChatGptModel, missingKeyMessage, PRIMARY_KEY_NAME } from "@/lib/chatgpt";
import type { AgentReport, LeadVerdict, LeadVerdictStatus } from "@/types";

interface RawVerdict {
  leadId?: unknown;
  company?: unknown;
  status?: unknown;
  qualificationScore?: unknown;
  confidence?: unknown;
  reliableFields?: unknown;
  issues?: unknown;
  recommendedAction?: unknown;
  rationale?: unknown;
}

function toNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normaliseVerdict(raw: RawVerdict, knownLeadIds: Set<string>): LeadVerdict | null {
  const leadId = typeof raw.leadId === "string" ? raw.leadId : "";
  if (!leadId || !knownLeadIds.has(leadId)) return null;

  const statusValue = String(raw.status || "");
  const status: LeadVerdictStatus =
    statusValue === "qualified" || statusValue === "disqualified" ? (statusValue as LeadVerdictStatus) : "needs_review";

  return {
    leadId,
    company: typeof raw.company === "string" ? raw.company : "",
    status,
    qualificationScore: Math.max(0, Math.min(100, Math.round(toNumber(raw.qualificationScore, 50)))),
    confidence: Math.max(0, Math.min(1, toNumber(raw.confidence, 0.5))),
    reliableFields: Array.isArray(raw.reliableFields) ? raw.reliableFields.map(String) : [],
    issues: Array.isArray(raw.issues) ? raw.issues.map(String) : [],
    recommendedAction: typeof raw.recommendedAction === "string" ? raw.recommendedAction : "Review manually",
    rationale: typeof raw.rationale === "string" ? raw.rationale : "",
  };
}

export async function GET() {
  return NextResponse.json({
    status: "ok",
    role: "Lead qualification, verification, email copy and reporting. Does not source leads.",
    envKey: PRIMARY_KEY_NAME,
    model: getChatGptModel(),
    ready: true,
  });
}

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, status: "bad_request", error: "Body must be JSON." }, { status: 400 });
  }

  const leads = Array.isArray(body?.leads) ? body.leads : [];
  if (leads.length === 0) {
    return NextResponse.json({
      success: false,
      status: "no_leads",
      error: "No leads were supplied to qualify. Run an Apollo prospecting search first, then qualify the records it stored.",
      verdicts: [],
      report: null,
    });
  }

  const knownLeadIds = new Set<string>(leads.map((l: any) => String(l.id)));
  const niche = body?.targetNiche || "not specified";
  const city = body?.targetCity || "not specified";

  const systemPrompt = `You are the Lead Qualification and Reporting Brain of Iwaju Marketing OS.

Your job is AUDIT, not discovery. You never invent companies, contacts, phone numbers, emails, deal values or any other record. You only reason about the lead records handed to you, and you judge whether each one is trustworthy enough to spend outreach effort on.

For every lead you receive, return exactly one verdict:
- "qualified": the contact data is internally consistent and the account fits the target.
- "needs_review": promising but at least one field is doubtful or missing.
- "disqualified": bad fit, dead contact data, or records that contradict each other.

Checks to apply on the real data only:
- Does the email domain match the company website domain? A Gmail/Outlook/Yahoo/Yandex address for a stated corporate contact is a red flag.
- Is the phone number present, correctly formatted, and plausible for the stated location?
- Do name and title exist and look like a real decision maker rather than a generic role address (info@, sales@, support@)?
- Is the deal value consistent with the company size and stage recorded, or an unsupported guess?
- Do the notes and tags contradict each other?

Confidence is about YOUR assessment, not a claim that any record was verified against a registry, DNS or LinkedIn. Never describe anything as verified unless the input itself states the verification source. Set "reliableFields" to the field names you judged consistent, and "issues" to concrete problems a human can act on.

Also produce a portfolio report over the whole batch you were given.

Return JSON only, matching:
{
  "verdicts": [
    {
      "leadId": "exact input id",
      "company": "company from input",
      "status": "qualified" | "needs_review" | "disqualified",
      "qualificationScore": 0-100,
      "confidence": 0.00-1.00,
      "reliableFields": ["email", "phone"],
      "issues": ["Email uses gmail.com but company domain is example.com"],
      "recommendedAction": "Send qualified cold email today",
      "rationale": "1-2 sentences grounded only in the supplied fields."
    }
  ],
  "report": {
    "headline": "short summary line",
    "executiveSummary": "3-4 sentences on pipeline health and what the pass found",
    "dataQualityFindings": ["patterns of bad data across this batch"],
    "topTargets": [{ "leadId": "input id", "company": "name", "why": "one sentence" }],
    "nextActions": ["ordered actions for the rep"]
  }
}`;

  const userPrompt = `Target this pass was run for: niche "${niche}" in "${city}".

Qualify and audit these ${leads.length} stored leads, then write the report:

${JSON.stringify(
    leads.map((l: any) => ({
      id: l.id,
      company: l.company,
      name: l.name,
      title: l.title,
      email: l.email,
      phone: l.phone,
      website: l.website,
      niche: l.niche,
      location: l.location,
      stage: l.stage,
      dealValue: l.dealValue,
      currency: l.currency,
      score: l.score,
      tags: l.tags,
      notes: l.notes,
      createdAt: l.createdAt,
    })),
    null,
    1
  )}`;

  const result = await requestChatGptJson<{ verdicts?: RawVerdict[]; report?: any }>(systemPrompt, userPrompt, 0.2);

  if (!result.ok) {
    return NextResponse.json({
      success: false,
      status: result.status,
      error: result.status === "no_key" ? missingKeyMessage() : result.message,
      verdicts: [],
      report: null,
    });
  }

  const verdicts = (Array.isArray(result.data?.verdicts) ? result.data.verdicts : [])
    .map((v) => normaliseVerdict(v, knownLeadIds))
    .filter((v): v is LeadVerdict => v !== null);

  if (verdicts.length === 0) {
    return NextResponse.json({
      success: false,
      status: "parse_error",
      error: "ChatGPT returned no verdicts matching the supplied lead ids.",
      verdicts: [],
      report: null,
    });
  }

  const report = buildReport(result.data?.report, verdicts);

  return NextResponse.json({
    success: true,
    status: "live",
    provider: `ChatGPT (${result.model})`,
    isLiveChatGPT: true,
    verdicts,
    report,
  });
}

function buildReport(raw: any, verdicts: LeadVerdict[]): AgentReport {
  const qualifiedCount = verdicts.filter((v) => v.status === "qualified").length;
  const needsReviewCount = verdicts.filter((v) => v.status === "needs_review").length;
  const disqualifiedCount = verdicts.filter((v) => v.status === "disqualified").length;
  const averageScore = Math.round(verdicts.reduce((sum, v) => sum + v.qualificationScore, 0) / verdicts.length);

  const fallbackTop = [...verdicts]
    .sort((a, b) => b.qualificationScore - a.qualificationScore)
    .slice(0, 3)
    .map((v) => ({ leadId: v.leadId, company: v.company, why: v.rationale || v.recommendedAction }));

  const findingsFromVerdicts = Array.from(new Set(verdicts.flatMap((v) => v.issues))).slice(0, 8);

  return {
    headline: typeof raw?.headline === "string" && raw.headline ? raw.headline : `${verdicts.length} leads audited`,
    executiveSummary:
      typeof raw?.executiveSummary === "string" && raw.executiveSummary
        ? raw.executiveSummary
        : `${qualifiedCount} qualified, ${needsReviewCount} need review, ${disqualifiedCount} disqualified.`,
    reviewedCount: verdicts.length,
    qualifiedCount,
    needsReviewCount,
    disqualifiedCount,
    averageScore,
    dataQualityFindings:
      Array.isArray(raw?.dataQualityFindings) && raw.dataQualityFindings.length > 0
        ? raw.dataQualityFindings.map(String)
        : findingsFromVerdicts,
    topTargets:
      Array.isArray(raw?.topTargets) && raw.topTargets.length > 0
        ? raw.topTargets
            .filter((t: any) => typeof t?.leadId === "string")
            .map((t: any) => ({ leadId: t.leadId, company: String(t.company || ""), why: String(t.why || "") }))
        : fallbackTop,
    nextActions:
      Array.isArray(raw?.nextActions) && raw.nextActions.length > 0 ? raw.nextActions.map(String) : verdicts.slice(0, 5).map((v) => v.recommendedAction),
  };
}
