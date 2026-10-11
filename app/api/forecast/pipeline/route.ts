import { NextResponse } from "next/server";
import type { ForecastLine, PipelineForecast, PipelineStage, ConsentRecord } from "@/types";
import type { EvidenceCounts } from "@/lib/icp";
import { deterministicEnvelope, failEnvelope, jsonEnvelope, toLead, MAX_RECORDS } from "@/lib/agents";
import { STAGE_LABELS, STAGE_WEIGHTS, WEIGHT_ASSUMPTION, isStale, lastTouchDays, riskFlags, type RecordContext } from "@/lib/rules";
import type { OutboundChannel } from "@/lib/consent";

const AGENT = "Forecast / Pipeline Risk Agent";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    agent: AGENT,
    provider: "deterministic",
    usesModel: false,
    method: "declared stage weights x logged value, plus risk flags read straight off each record",
    currenciesConverted: false,
    note: "Mixed currencies are reported per currency. No FX source is wired up, so none are added together.",
  });
}

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return jsonEnvelope(failEnvelope<PipelineForecast>(AGENT, "bad_request", "Body must be JSON."), { status: 400 });
  }

  const rawList: unknown[] = Array.isArray(body?.leads) ? body.leads : [];
  const leads = rawList.map(toLead).filter((l): l is NonNullable<typeof l> => l !== null).slice(0, MAX_RECORDS * 5);

  if (leads.length === 0) {
    return jsonEnvelope(failEnvelope<PipelineForecast>(AGENT, "bad_request", "Send { leads: [ ... ] } — the forecast reads the CRM you already have."), { status: 400 });
  }

  const evidence: Record<string, EvidenceCounts> =
    body?.evidenceByLead && typeof body.evidenceByLead === "object" ? body.evidenceByLead : {};
  const consent: Record<string, Partial<Record<OutboundChannel, ConsentRecord>>> =
    body?.consentByLead && typeof body.consentByLead === "object" ? body.consentByLead : {};
  const target = Number(body?.target);
  const targetCurrency = String(body?.targetCurrency || "NGN").toUpperCase();

  const lines: ForecastLine[] = leads.map((lead) => {
    const ctx: RecordContext = { lead, evidence: evidence[String(lead.id)], consent: consent[String(lead.id)] };
    const flags = riskFlags(ctx);
    const weight = STAGE_WEIGHTS[lead.stage];
    const amount = Number(lead.dealValue) || 0;
    const days = lastTouchDays(lead);

    const nextAction =
      lead.stage === "closed"
        ? "Ask for a referral while the result is fresh."
        : flags.length === 0
          ? `Keep the cadence: ${weight * 100}% weighted at ${STAGE_LABELS[lead.stage]}.`
          : `Fix the blocker first: ${flags[0]}`;

    return {
      leadId: String(lead.id),
      company: lead.company || lead.name || "Unnamed account",
      stage: lead.stage,
      amount,
      currency: (lead.currency || "NGN").toUpperCase(),
      stageWeight: weight,
      weightedAmount: Math.round(amount * weight),
      riskFlags: flags,
      riskScore: Math.min(100, flags.length * 22 + (days !== null && days > 45 ? 20 : 0)),
      nextAction,
    };
  });

  const byCurrencyMap = new Map<string, { count: number; gross: number; weighted: number }>();
  lines.forEach((line) => {
    if (line.stage === "closed") return;
    const bucket = byCurrencyMap.get(line.currency) || { count: 0, gross: 0, weighted: 0 };
    bucket.count += 1;
    bucket.gross += line.amount;
    bucket.weighted += line.weightedAmount;
    byCurrencyMap.set(line.currency, bucket);
  });

  const byCurrency = [...byCurrencyMap.entries()]
    .map(([currency, v]) => ({ currency, ...v }))
    .sort((a, b) => b.weighted - a.weighted);

  const primaryCurrency = byCurrency[0]?.currency || targetCurrency;
  const inPrimary = lines.filter((l) => l.currency === primaryCurrency);
  const open = inPrimary.filter((l) => l.stage !== "closed");
  const won = inPrimary.filter((l) => l.stage === "closed");

  const grossPipeline = open.reduce((sum, l) => sum + l.amount, 0);
  const weightedForecast = inPrimary.reduce((sum, l) => sum + l.weightedAmount, 0);
  const committed = won.reduce((s, l) => s + l.amount, 0) + open.filter((l) => l.stage === "meeting").reduce((s, l) => s + Math.round(l.amount * 0.5), 0);
  const bestCase = won.reduce((s, l) => s + l.amount, 0) + open.filter((l) => l.stage === "meeting").reduce((s, l) => s + l.amount, 0);

  const stages: PipelineStage[] = ["new", "contacted", "meeting", "closed"];
  const byStage = stages.map((stage) => {
    const stageLines = inPrimary.filter((l) => l.stage === stage);
    const gross = stageLines.reduce((sum, l) => sum + l.amount, 0);
    return {
      stage,
      label: STAGE_LABELS[stage],
      count: stageLines.length,
      gross,
      weight: STAGE_WEIGHTS[stage],
      weighted: Math.round(gross * STAGE_WEIGHTS[stage]),
    };
  });

  const leadById = new Map(leads.map((l) => [String(l.id), l]));
  const stalled = lines
    .filter((l) => l.stage !== "closed")
    .filter((l) => {
      const source = leadById.get(l.leadId);
      return source ? isStale(source, 21) : false;
    })
    .sort((a, b) => b.riskScore - a.riskScore);

  const riskiest = [...lines]
    .filter((l) => l.stage !== "closed" && l.riskFlags.length > 0)
    .sort((a, b) => b.riskScore - a.riskScore || b.amount - a.amount)
    .slice(0, 8);

  const unvalued = lines.filter((l) => l.amount <= 0 && l.stage !== "closed");

  const assumptions = [
    WEIGHT_ASSUMPTION,
    "Weighted forecast is logged value x stage weight. It carries no adjustment for how good your close rate actually is, because no closed-won history is stored to learn one from.",
    "Deal values are whatever the rep typed. None of them has been confirmed with the buyer.",
    byCurrency.length > 1
      ? `Pipeline holds ${byCurrency.map((c) => `${c.currency} (${c.count})`).join(", ")}. The headline totals, committed and best-case figures cover the ${primaryCurrency} slice only: no FX rate source is wired up, so adding currencies together would be arithmetic fiction. ${byCurrency.length} currency view(s) are broken out above.`
      : "Single-currency view: the totals above are one currency only.",
    unvalued.length > 0
      ? `${unvalued.length} open record(s) have no deal value and therefore contribute 0 to every total on this page, whatever their real size.`
      : "Every open record carries a value, so no deal is silently contributing zero.",
    "A record counts as stalled after 21 days with no logged touch.",
  ];

  const forecast: PipelineForecast = {
    currency: primaryCurrency,
    openCount: open.length,
    grossPipeline,
    weightedForecast,
    coverageRatio: Number.isFinite(target) && target > 0 ? Math.round((weightedForecast / target) * 100) / 100 : null,
    committed,
    bestCase,
    winRateAssumption: "Meeting-stage deals are halved for the committed view and taken whole for the best case. Both are stated conventions, not measured odds.",
    byStage,
    byCurrency,
    riskiest,
    stalled: stalled.slice(0, 8),
    assumptions,
    lines,
  };

  const zeroEvidence = lines.filter((l) => !evidence[l.leadId]).length;

  return jsonEnvelope(
    deterministicEnvelope<PipelineForecast>(
      AGENT,
      forecast,
      `${lines.length} record(s) in ${byCurrency.length} currency view(s). ${zeroEvidence > 0 ? `${zeroEvidence} have never been audited by the Contact Resolution agent, so their trust contribution is unknown rather than assumed.` : "All records carry verification evidence."} Every number traces to a stage weight and a logged value shown above.`
    )
  );
}
