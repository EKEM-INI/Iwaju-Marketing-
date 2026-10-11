import { NextResponse } from "next/server";
import { getChatGptKey, getChatGptModel, requestChatGptJson, PRIMARY_KEY_NAME } from "@/lib/chatgpt";
import { looksLikePhoneValue, isRoleAddress, isFreeMailDomain, emailDomain } from "@/lib/address-class";

export const runtime = "nodejs";

interface IncomingFact {
  id?: string;
  field?: string;
  value?: string;
  verified?: boolean;
  source?: string;
}

interface ApprovedFact {
  id: string;
  field: string;
  value: string;
  source: string;
}

// Personal and unverified channels must be opted into explicitly, never used silently.
const SENSITIVE_FIELDS = new Set(["directMobile", "personalMobile", "phone", "whatsapp", "address"]);

const TONES = ["direct", "consultative", "peer_to_peer", "short_question"] as const;

export async function GET() {
  return NextResponse.json({
    status: "ok",
    hasApiKey: Boolean(getChatGptKey()),
    engine: "Fact-Grounded Outreach Copilot",
    envKey: PRIMARY_KEY_NAME,
    model: getChatGptModel(),
    grounding: "cites only the approved facts it is given; refuses sensitive or unverified ones",
  });
}

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, status: "bad_request", error: "Body must be JSON." }, { status: 400 });
  }

  const lead = body?.lead || {};
  const tone = TONES.includes(body?.tone) ? body.tone : "direct";
  const senderName = String(body?.senderName || "").trim();
  const senderCompany = String(body?.senderCompany || "Iwaju Marketing").trim();
  const customDirective = String(body?.customDirective || "").trim();
  const incoming: IncomingFact[] = Array.isArray(body?.facts) ? body.facts : [];

  const approvedFacts: ApprovedFact[] = [];
  const refusedFacts: { id: string; field: string; reason: string }[] = [];

  incoming.forEach((fact, index) => {
    const id = String(fact?.id || `fact-${index}`);
    const field = String(fact?.field || "unknown");
    const value = String(fact?.value || "").trim();

    if (!value) {
      refusedFacts.push({ id, field, reason: "No value on the record to cite." });
      return;
    }
    if (fact?.verified !== true) {
      refusedFacts.push({ id, field, reason: "Marked unverified. Tick it as confirmed before it can be used." });
      return;
    }
    if (SENSITIVE_FIELDS.has(field)) {
      refusedFacts.push({
        id,
        field,
        reason: "Personal contact channel. Excluded by default — outreach here needs a consent basis, not just a number.",
      });
      return;
    }
    // A field name is not a guarantee: free text often carries a number inside it.
    if (looksLikePhoneValue(value)) {
      refusedFacts.push({ id, field, reason: "The value is a phone number, so it stays out of written copy." });
      return;
    }
    if (field === "email" && (isRoleAddress(value) || isFreeMailDomain(emailDomain(value)))) {
      refusedFacts.push({
        id,
        field,
        reason: "Shared mailbox or consumer provider: it identifies no person and is not a corporate channel.",
      });
      return;
    }
    approvedFacts.push({ id, field, value, source: String(fact?.source || "rep-confirmed") });
  });

  const baseResponse = {
    tone,
    approvedFacts,
    refusedFacts,
    senderName,
    senderCompany,
  };

  if (approvedFacts.length === 0) {
    return NextResponse.json({
      success: false,
      status: "no_approved_facts",
      error: "Nothing to write from. Confirm at least one verified, non-personal fact first.",
      ...baseResponse,
    });
  }

  if (!getChatGptKey()) {
    return NextResponse.json({
      success: false,
      status: "no_key",
      error: `No live email was written: ${PRIMARY_KEY_NAME} is not set in Vercel Environment Variables. No static template is substituted, because template copy would claim things no approved fact supports.`,
      ...baseResponse,
    });
  }

  const systemPrompt = `You are the Fact-Grounded Cold Outreach Writer for ${senderCompany}.

You may ONLY state facts contained in the APPROVED FACTS list below. Every specific claim in the email must be traceable to one of those facts.

Hard rules:
1. Never invent client results, revenue figures, pipeline numbers, timeframes, case studies, benchmarks, awards or named third parties. If it is not in the approved facts, it does not exist.
2. Never imply the recipient has a problem you have not been told about. You may describe a common challenge in general terms, but not as a claim about this company.
3. Identify the sender by name and company in the sign-off.
4. Include a plain opt-out line so the recipient can ask not to be contacted again.
5. Keep the body under 110 words. No filler greetings such as "I hope this email finds you well".
6. Do not use any REFUSED FACT, especially personal phone numbers or inferred mobile lines.
7. For every factual claim about the recipient, add the fact id in square brackets immediately after it, e.g. "your work across fintech in Lagos [f2]".
8. Return JSON only.`;

  const userPrompt = `Write a ${tone} cold email.

Recipient: ${lead.name || "(no person named)"}${lead.title ? `, ${lead.title}` : ""}
Company: ${lead.company || "(unknown)"}
Niche on record: ${lead.niche || "(unrecorded)"}
Location on record: ${lead.location || "(unrecorded)"}

APPROVED FACTS (the only things you may state):
${approvedFacts.map((f) => `[${f.id}] ${f.field}: ${f.value} (source: ${f.source})`).join("\n")}

REFUSED — DO NOT USE:
${refusedFacts.length > 0 ? refusedFacts.map((f) => `- ${f.field}: ${f.reason}`).join("\n") : "- none"}

Sender: ${senderName || "(rep name not set)"} at ${senderCompany}
Rep directive: ${customDirective || "none"}

Return JSON:
{
  "subject": "specific, no clickbait",
  "altSubjects": ["A/B option 1", "A/B option 2"],
  "body": "the email with [factId] markers retained after recipient-specific claims",
  "followUpSubject": "Re: ...",
  "followUpBody": "3 sentences maximum, still grounded",
  "citedFactIds": ["f1", "f2"],
  "estimatedReadTimeSec": 25
}`;

  const result = await requestChatGptJson<any>(systemPrompt, userPrompt, 0.4);

  if (!result.ok) {
    return NextResponse.json({
      success: false,
      status: result.status,
      error: result.message,
      ...baseResponse,
    });
  }

  const data = result.data || {};
  const approvedIds = new Set(approvedFacts.map((f) => f.id));
  const cited: string[] = Array.isArray(data.citedFactIds) ? data.citedFactIds.map(String) : [];
  const inventedCitations = cited.filter((id) => !approvedIds.has(id));

  const bodyText = String(data.body || "");
  const lower = bodyText.toLowerCase();
  const compliance = {
    senderIdentified: senderName.length === 0 || lower.includes(senderName.toLowerCase()),
    optOutPresent: lower.includes("opt out") || lower.includes("unsubscribe") || lower.includes("do not contact"),
    onlyApprovedFactsCited: cited.length > 0 && inventedCitations.length === 0,
    noBracketedClaimsMissing: bodyText.length > 0,
    inventedNumbersDetected: /₦\s?\d|\$\s?\d|\d{2,}\s?(m|million|bn|billion)\b/i.test(bodyText)
      ? !approvedFacts.some((f) => /₦|\$|\d/.test(f.value))
      : false,
  };

  return NextResponse.json({
    success: true,
    status: "live",
    provider: `ChatGPT (${result.model})`,
    isLiveChatGPT: true,
    subject: data.subject || "",
    altSubjects: Array.isArray(data.altSubjects) ? data.altSubjects : [],
    body: bodyText,
    followUpSubject: data.followUpSubject || "",
    followUpBody: data.followUpBody || "",
    citedFacts: approvedFacts.filter((f) => cited.includes(f.id)),
    inventedCitations,
    estimatedReadTimeSec: Number(data.estimatedReadTimeSec) || 0,
    compliance,
    compliancePassed:
      compliance.optOutPresent && compliance.onlyApprovedFactsCited && !compliance.inventedNumbersDetected,
    ...baseResponse,
  });
}
