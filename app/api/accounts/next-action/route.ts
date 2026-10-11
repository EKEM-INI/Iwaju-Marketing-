import { NextResponse } from "next/server";
import { failEnvelope, jsonEnvelope, toLead, deterministicEnvelope, MAX_RECORDS } from "@/lib/agents";
import { nextBestAction, riskFlags, type RecordContext } from "@/lib/rules";
import type { EvidenceCounts } from "@/lib/icp";
import type { ConsentRecord, Lead, NextBestAction } from "@/types";
import type { OutboundChannel } from "@/lib/consent";

const AGENT = "Next-Best-Action Agent";

type ConsentStore = Record<string, Partial<Record<OutboundChannel, ConsentRecord>>>;

export async function GET() {
  return NextResponse.json({
    status: "ok",
    agent: AGENT,
    provider: "deterministic",
    usesModel: false,
    writesRecords: false,
    method: "rule ladder over stage, verification evidence, activity age, deal value and recorded consent",
  });
}

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return jsonEnvelope(failEnvelope<NextBestAction[]>(AGENT, "bad_request", "Body must be JSON."), { status: 400 });
  }

  const rawList: unknown[] = Array.isArray(body?.leads) ? body.leads : [body?.lead ?? body];
  const leads = rawList.map(toLead).filter((l): l is Lead => l !== null).slice(0, MAX_RECORDS);

  if (leads.length === 0) {
    return jsonEnvelope(failEnvelope<NextBestAction[]>(AGENT, "bad_request", "Send { leads: [ ... ] }."), { status: 400 });
  }

  const evidence: Record<string, EvidenceCounts> =
    body?.evidenceByLead && typeof body.evidenceByLead === "object" ? body.evidenceByLead : {};
  const consent: ConsentStore = body?.consentByLead && typeof body.consentByLead === "object" ? body.consentByLead : {};
  const replied: string[] = Array.isArray(body?.repliedLeadIds) ? body.repliedLeadIds.map(String) : [];
  const signalMap = body?.signalsByLead && typeof body.signalsByLead === "object" ? body.signalsByLead : {};

  const actions: NextBestAction[] = leads.map((lead) => {
    const ctx: RecordContext = {
      lead,
      evidence: evidence[String(lead.id)],
      consent: consent[String(lead.id)],
      hasReply: replied.includes(String(lead.id)),
      signals: signalMap[String(lead.id)] ?? null,
    };
    const suggestion = nextBestAction(ctx);
    const flags = riskFlags(ctx);

    return {
      leadId: String(lead.id),
      company: lead.company || lead.name || "Unnamed account",
      action: suggestion.action,
      why: flags.length > 0 ? `${suggestion.why} Open risks: ${flags.slice(0, 2).join(" ")}` : suggestion.why,
      effect: suggestion.effect,
      reversible: suggestion.reversible,
      effortMinutes: suggestion.effortMinutes,
      blockedBy: suggestion.blockedBy,
    };
  });

  const ranked = actions.sort((a, b) => a.effortMinutes - b.effortMinutes);

  return jsonEnvelope(
    deterministicEnvelope<NextBestAction[]>(
      AGENT,
      ranked,
      `${ranked.length} record(s) read by rules, not a model: no key was used and nothing was invented. Every action states what changes on the record and says whether it can be undone. Nothing here sends anything — the ladder stops at the draft.`
    )
  );
}
