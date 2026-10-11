import { NextResponse } from "next/server";
import { getGeminiKey, missingGeminiKeyMessage, requestGeminiJson } from "@/lib/gemini";
import { daysBetween, domainOf, failEnvelope, jsonEnvelope, okEnvelope, safeSources, toLead, truncateRun } from "@/lib/agents";
import type { BuyingSignal, SignalKind, SignalScanResult } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const AGENT = "Buying-Signal Monitor";
const KINDS: SignalKind[] = ["hiring", "funding", "expansion", "technology", "leadership", "contract", "content"];

interface ModelSignal {
  kind?: string;
  summary?: string;
  strength?: number;
  uri?: string;
  sourceUri?: string;
  observedAsOf?: string;
}

interface ModelScan {
  signals?: ModelSignal[];
  techStack?: unknown;
  summary?: string;
}

function hostOf(uri: string): string | null {
  try {
    return new URL(uri).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

export async function GET() {
  return NextResponse.json({
    status: "ok",
    agent: AGENT,
    provider: getGeminiKey() ? "google-gemini" : "none",
    hasKey: Boolean(getGeminiKey()),
    method: "Google Search grounding via Gemini; a signal counts only if the search actually returned its URL",
    feeds: "Account Fit -> growthSignals and technology components",
  });
}

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return jsonEnvelope(failEnvelope<SignalScanResult[]>(AGENT, "bad_request", "Body must be JSON."), { status: 400 });
  }

  const rawList = Array.isArray(body?.leads) ? body.leads : Array.isArray(body?.accounts) ? body.accounts : [body?.lead ?? body?.account ?? body];
  const { items, truncated, considered } = truncateRun(rawList, 10);
  const leads = items.map(toLead).filter((l): l is NonNullable<typeof l> => l !== null);

  if (leads.length === 0) {
    return jsonEnvelope(failEnvelope<SignalScanResult[]>(AGENT, "bad_request", "Send { leads: [{ company, website }] }."), { status: 400 });
  }

  if (!getGeminiKey()) {
    return jsonEnvelope(
      failEnvelope<SignalScanResult[]>(AGENT, "no_key", missingGeminiKeyMessage(AGENT)),
      { status: 200 }
    );
  }

  const windowDays = Math.max(7, Math.min(365, Number(body?.windowDays) || 180));

  const scans: SignalScanResult[] = [];
  const errors: string[] = [];

  for (const lead of leads) {
    const domain = domainOf(lead);

    const systemPrompt = `You are the Buying-Signal Monitor. You look for recent, public reasons this account might be buying right now.

Rules:
- Search for real, recent items. Report only what a returned result actually shows.
- Every signal must carry the URL of the page you found it on. If you have no URL, do not report the signal.
- Never estimate a headcount, revenue or budget. Never report a signal "typical" for an industry.
- If you find nothing recent, return an empty signals array. That is a valid, useful answer.
- observedAsOf is the date on the page (YYYY-MM-DD). Leave empty if the page shows no date.

JSON only:
{
  "signals": [ { "kind": "hiring|funding|expansion|technology|leadership|contract|content",
                 "summary": "what happened, in one sentence, naming the role/product/city where relevant",
                 "strength": 0-100,
                 "uri": "https://...",
                 "observedAsOf": "YYYY-MM-DD or empty" } ],
  "techStack": ["technologies the account visibly uses, each backed by one of the URLs above"],
  "summary": "one sentence on whether this account looks active right now"
}`;

    const userPrompt = `Account: ${lead.company}${domain ? ` (domain ${domain})` : ""}${lead.location ? `, ${lead.location}` : ""}${lead.niche ? `, ${lead.niche}` : ""}
Known stack hints from the CRM: ${lead.tags.length ? lead.tags.join(", ") : "none"}
Look back ${windowDays} days. Searches worth running: careers pages, "${lead.company}" hiring, funding announcements, product launches, office or market expansion, new CTO/VP Sales, technology usage, contract or partnership wins.`;

    const answer = await requestGeminiJson<ModelScan>(systemPrompt, userPrompt, { grounding: true, temperature: 0.1 });

    if (!answer.ok) {
      if (answer.status === "no_key") {
        return jsonEnvelope(failEnvelope<SignalScanResult[]>(AGENT, "no_key", answer.message));
      }
      errors.push(`${lead.company}: ${answer.message}`);
      continue;
    }

    // Only URLs the search tool actually returned may certify a signal.
    const retrieved = new Set(answer.sources.map((s) => s.uri.toLowerCase()));

    const signals: BuyingSignal[] = [];
    (Array.isArray(answer.data?.signals) ? answer.data.signals : []).forEach((raw, index) => {
      const summary = String(raw?.summary || "").trim().slice(0, 300);
      if (!summary) return;
      const kind = KINDS.includes(raw?.kind as SignalKind) ? (raw.kind as SignalKind) : "content";
      const claimed = safeSources([raw?.uri ?? raw?.sourceUri])[0];
      const uri = claimed && retrieved.has(claimed.uri.toLowerCase()) ? claimed.uri : null;
      const observed = daysBetween(raw?.observedAsOf || undefined);

      signals.push({
        id: `${lead.id || lead.company}:${kind}:${index}`,
        kind,
        summary,
        strength: Math.max(0, Math.min(100, Math.round(Number(raw?.strength) || 0))),
        status: uri !== null ? "cited" : "uncited",
        sourceUri: uri,
        sourceDomain: uri !== null ? hostOf(uri) : null,
        observedAsOf: raw?.observedAsOf ? String(raw.observedAsOf).slice(0, 10) : null,
        withinDays: observed,
      });
    });

    const cited = signals.filter((s) => s.status === "cited");
    const hiringPosts = cited.filter((s) => s.kind === "hiring").length;
    const fundingEvents = cited.filter((s) => s.kind === "funding").length;
    const techStack = (Array.isArray(answer.data?.techStack) ? answer.data.techStack : [])
      .map((t) => String(t).trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 12);

    const freshness = cited.reduce((sum, s) => {
      if (s.withinDays === null) return sum + 40;
      return sum + Math.max(10, 100 - Math.round((s.withinDays / windowDays) * 100));
    }, 0);

    // Freshness is worth more than volume: one old signal should not look like momentum.
    const avgFreshness = cited.length ? Math.round(freshness / cited.length) : 0;
    const breadth = Math.min(1, cited.length / 3);
    const momentumScore = Math.round(avgFreshness * (0.5 + 0.5 * breadth));

    scans.push({
      account: lead.company || lead.name || "Unnamed account",
      domain,
      signals,
      hiringPosts,
      fundingEvents,
      techStack,
      momentumScore,
      citedCount: cited.length,
      uncitedCount: signals.length - cited.length,
    });
  }

  if (scans.length === 0) {
    return jsonEnvelope(failEnvelope<SignalScanResult[]>(AGENT, "provider_error", errors.join(" | ") || "No account could be scanned."));
  }

  const totalCited = scans.reduce((n, s) => n + s.citedCount, 0);
  const totalUncited = scans.reduce((n, s) => n + s.uncitedCount, 0);

  return jsonEnvelope(
    okEnvelope<SignalScanResult[]>(
      AGENT,
      "google-gemini",
      scans,
      `${scans.length} account(s) scanned with live search. ${totalCited} signal(s) carry a URL the search actually returned and count toward Account Fit; ${totalUncited} uncited claim(s) are shown for context only and are weighted at zero.${
        truncated ? ` Capped at ${items.length} of ${considered} submitted records.` : ""
      }${errors.length ? ` Incomplete: ${errors.join(" | ")}` : ""}`
    )
  );
}
