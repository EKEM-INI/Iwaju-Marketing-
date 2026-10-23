import { NextResponse } from "next/server";
import { getChatGptKey, getChatGptModel, PRIMARY_KEY_NAME } from "@/lib/chatgpt";
import { getGeminiKey, PRIMARY_GEMINI_KEY_NAME } from "@/lib/gemini";
import { writeWithFallback, providerLabel, hasAnyWriterKey } from "@/lib/outreach-writer";

export const runtime = "nodejs";

export async function GET() {
  const hasChatGpt = Boolean(getChatGptKey());
  const hasGemini = Boolean(getGeminiKey());
  return NextResponse.json({
    status: "ok",
    hasApiKey: hasChatGpt || hasGemini,
    engine: "AI Lead Sorting & Qualification Brain",
    writers: [
      { provider: "chatgpt", envKey: PRIMARY_KEY_NAME, model: getChatGptModel(), configured: hasChatGpt },
      { provider: "gemini", envKey: PRIMARY_GEMINI_KEY_NAME, configured: hasGemini },
    ],
    order: "ChatGPT first, Gemini fallback when ChatGPT is unconfigured or failing",
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { leads = [], sortBy = "deal_potential", customDirective = "" } = body;

    let aiFailure: string | null = null;

    if (hasAnyWriterKey() && Array.isArray(leads) && leads.length > 0) {
      try {
        const systemPrompt = `You are the Lead Intelligence & Sorting Brain of Iwaju Marketing OS.
Your mission is to deeply review candidate B2B leads, evaluate their commercial potential, analyze their buying signals and pain points, score them, and sort them in optimal outreach order.

For each lead provided, you must output:
- leadId: string (must match the input lead.id)
- company: string
- qualificationScore: number (0 to 100)
- tier: "Tier A - High Priority" | "Tier B - Medium Priority" | "Tier C - Low / Nurture"
- dealProbability: number (0.00 to 1.00)
- primaryPainPoint: string (1 concise sentence describing what this company urgently struggles with in their market)
- strategicAngle: string (the exact hook to use in outbound sales, e.g. "Lead with infrastructure consolidation", "Pitch executive CAC compliance")
- recommendedAction: string (e.g. "Send CEO cold email sequence today", "Book discovery call via WhatsApp", "Hold for Q2 expansion")
- rank: number (1 being the highest priority)

Also provide an overarching portfolio summary:
- executiveSummary: 2-3 sentences analyzing the total pipeline health and top target opportunities.
- averageScore: number
- tierACount: number
- totalDealValueEstimate: string

Always respond with valid JSON matching this schema:
{
  "executiveSummary": "...",
  "averageScore": 88,
  "tierACount": 3,
  "totalDealValueEstimate": "₦85,000,000",
  "sortedLeads": [
    {
      "leadId": "...",
      "company": "...",
      "rank": 1,
      "qualificationScore": 96,
      "tier": "Tier A - High Priority",
      "dealProbability": 0.88,
      "primaryPainPoint": "...",
      "strategicAngle": "...",
      "recommendedAction": "..."
    }
  ]
}`;

        // Cap to first 40 leads to stay within token limits while analyzing priority batch
        const leadsForPrompt = leads.slice(0, 40).map((l: any) => ({
          id: l.id,
          name: l.name,
          title: l.title,
          company: l.company,
          niche: l.niche,
          location: l.location,
          dealValue: l.dealValue,
          email: l.email,
          stage: l.stage,
          notes: l.notes ? String(l.notes).slice(0, 300) : "",
        }));

        const userPrompt = `Please go through, qualify, and sort these ${leadsForPrompt.length} leads (from total ${leads.length} in pipeline).
Sorting priority: ${sortBy}
Additional directive: ${customDirective || "Prioritize high deal values and verified corporate decision makers."}

Leads data:
${JSON.stringify(leadsForPrompt, null, 2)}`;

        const result = await writeWithFallback<any>(systemPrompt, userPrompt, 0.2, { maxOutputTokens: 4000 });

        if (result.ok && Array.isArray(result.data?.sortedLeads) && result.data.sortedLeads.length > 0) {
          const isChatGPT = result.modelProvider === "chatgpt";
          return NextResponse.json({
            success: true,
            status: "live",
            provider: providerLabel(result.modelProvider, result.modelName),
            modelProvider: result.modelProvider,
            modelName: result.modelName,
            isLiveChatGPT: isChatGPT,
            isLiveGemini: result.modelProvider === "gemini",
            executiveSummary: result.data.executiveSummary,
            averageScore: Number(result.data.averageScore) || 85,
            tierACount: Number(result.data.tierACount) || 1,
            totalDealValueEstimate: result.data.totalDealValueEstimate || "₦0",
            sortedLeads: result.data.sortedLeads,
          });
        }
        aiFailure = result.ok ? "AI returned no sorted leads." : result.message;
      } catch (e: any) {
        aiFailure = e?.message || "Lead sorting failed.";
        console.warn("AI lead sorting error, using rule fallback:", e?.message);
      }
    }

    // Rule-based fallback: orders the real stored leads by recorded deal value.
    // No analysis is performed, so no insight fields are invented.
    const sorted = [...leads].sort((a: any, b: any) => {
      const valA = Number(a.dealValue) || 0;
      const valB = Number(b.dealValue) || 0;
      return valB - valA;
    });

    const evaluatedLeads = sorted.map((lead: any, idx: number) => {
      const val = Number(lead.dealValue) || 0;
      const isTierA = idx === 0 && val > 0;
      const isTierB = idx > 0 && idx < Math.ceil(sorted.length / 3) && val > 0;

      return {
        leadId: lead.id,
        company: lead.company,
        rank: idx + 1,
        qualificationScore: Number(lead.score) || 0,
        tier: isTierA
          ? "Tier A - High Priority"
          : isTierB
          ? "Tier B - Medium Priority"
          : "Tier C - Low / Nurture",
        dealProbability: 0,
        primaryPainPoint: "Not analysed - AI key not configured or model failed.",
        strategicAngle: "Not analysed - AI key not configured or model failed.",
        recommendedAction: isTierA
          ? "Send personalized executive cold email sequence within 2 hours"
          : "Queue for automated multi-touch follow up sequence",
      };
    });

    return NextResponse.json({
      success: true,
      status: "rules",
      provider: "Rule-based ordering (no AI used)",
      isLiveChatGPT: false,
      isLiveGemini: false,
      error: hasAnyWriterKey() ? aiFailure : null,
      notice: hasAnyWriterKey()
        ? `AI sorting failed (${aiFailure}). Showing plain deal-value ordering instead.`
        : `No lead analysis was performed. Set ${PRIMARY_KEY_NAME} or ${PRIMARY_GEMINI_KEY_NAME} in environment variables to enable AI qualification.`,
      executiveSummary: `Sorted ${leads.length} stored leads by recorded deal value. No live AI qualification ran.`,
      averageScore: Math.round(
        evaluatedLeads.reduce((acc: number, l: any) => acc + l.qualificationScore, 0) /
          (evaluatedLeads.length || 1)
      ),
      tierACount: evaluatedLeads.filter((l: any) => l.tier.startsWith("Tier A")).length,
      totalDealValueEstimate: `₦${leads
        .reduce((acc: number, l: any) => acc + (Number(l.dealValue) || 0), 0)
        .toLocaleString()}`,
      sortedLeads: evaluatedLeads,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to sort leads." },
      { status: 500 }
    );
  }
}
