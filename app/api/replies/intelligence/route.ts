import { NextResponse } from "next/server";
import type { ReplyIntelligence, PipelineStage, GroundedFact } from "@/types";
import { failEnvelope, jsonEnvelope, okEnvelope, toLead, asStringArray } from "@/lib/agents";
import { getChatGptKey, PRIMARY_KEY_NAME } from "@/lib/chatgpt";
import { getGeminiKey, PRIMARY_GEMINI_KEY_NAME } from "@/lib/gemini";
import { writeWithFallback, providerLabel, hasAnyWriterKey } from "@/lib/outreach-writer";
import { stripCitations } from "@/lib/outreach-facts";

export const runtime = "nodejs";
export const maxDuration = 30;

const AGENT = "Reply / Conversation Intelligence Agent";
const MAX_REPLY_CHARS = 6000;

type Classification = ReplyIntelligence["classification"];

const PATTERNS: { classification: Classification; label: string; pattern: RegExp }[] = [
  { classification: "out_of_office", label: "out-of-office notice", pattern: /\b(ooo|out of office|away from (the )?office|on (annual |medical |parental )?leave|on (vacation|holiday|leave) until|limited access to (my )?email|i am currently away|i will return\b)/i },
  { classification: "auto_reply", label: "automated reply", pattern: /\b(auto(matic|matical|reply|-reply)|no-?reply|do not reply to this|delivered to an inbox|mailer-?daemon|this mailbox is monitored)/i },
  { classification: "not_now", label: "not now", pattern: /\b(next (quarter|year|fiscal)|after (the )?(holidays|ramadan|easter|dry season)|in a few months|revisit (this|later)|touch base later|come back to (us|this) later|not right now|bad timing|busy (this month|right now|season)|budget (opens|is not )?(later|next|open))/i },
  { classification: "rejection", label: "rejection", pattern: /\b(not interested|no thanks? (but)?|we'?ve decided (not|against)|remove me|unsubscribe|please stop contacting|take me off|this is not a fit|we already have (a|this) (solution|provider|in house))/i },
  { classification: "referral", label: "referral to someone else", pattern: /\b(you should (speak|talk|reach out|email) to?|best person( to speak)?|my colleague|loop(ing)? in|cc'?ing|forward(ed)? this|reach out to|speak to)/i },
  { classification: "interested", label: "interest / meeting signal", pattern: /\b(let'?s (book|schedule|set up|chat|talk|jump|connect|have (a )?call)|are you (free|available)|my calendar|book (a|some)|pick a (slot|time)|send (me |over )?(the )?(proposal|deck|pricing|more details)|sounds good|works for me|i'?m interested)/i },
  { classification: "question", label: "question back", pattern: /(\?|how much|what.?s (your|the) (price|cost)|does (it|you)|do you (support|integrat|work with)|pricing|quote|what do you (cover|charge))/i },
];

function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 2);
}

function firstMatches(text: string, pattern: RegExp, limit = 3): string[] {
  return sentences(text)
    .filter((s) => pattern.test(s))
    .slice(0, limit)
    .map((s) => s.slice(0, 240));
}

/** Rule pass. It can only say what the words on the page say, never what they mean. */
function rulePass(reply: string): ReplyIntelligence {
  const matched = PATTERNS.find((p) => p.pattern.test(reply));
  const classification: Classification = matched?.classification ?? "unclear";
  const quotes = matched ? firstMatches(reply, matched.pattern, 3) : [];
  const askedFor = firstMatches(reply, /\b(can you|could you|do you|please send|we need|i need|what|how)\b/i, 4);
  const commitments = firstMatches(reply, /\b(i will|i'?ll|we'?ll|please|let me|sending|going to)\b/i, 4);
  const objection = firstMatches(reply, /\b(budget|too expensive|already have|not (the right|our) (time|person)|no bandwidth|compliance|procurement|legal|we don'?t)/i, 3);
  const hasQuestionMark = reply.includes("?");

  let sentiment: ReplyIntelligence["sentiment"] = "neutral";
  if (classification === "interested") sentiment = "positive";
  if (classification === "rejection" || classification === "not_now") sentiment = "negative";

  let suggestedStage: PipelineStage | null = null;
  if (classification === "interested") {
    suggestedStage = /\b(calendar|book|slot|date|tuesday|wednesday|thursday|monday|friday|am|pm|o'?clock)\b/i.test(reply) ? "meeting" : "contacted";
  } else if (classification === "referral" || classification === "question" || classification === "not_now") {
    suggestedStage = "contacted";
  } else if (classification === "rejection") {
    suggestedStage = "new";
  }

  return {
    replyExcerpt: reply.slice(0, 240),
    classification,
    sentiment,
    confidence: classification === "unclear" ? 0.25 : quotes.length >= 2 ? 0.75 : 0.6,
    evidenceQuotes: quotes,
    objections: objection,
    commitments,
    whatTheyAskedFor: askedFor,
    readingBetweenTheLines:
      classification === "unclear"
        ? `No pattern in this reply matches a known response type, so no meaning is being claimed. ${hasQuestionMark ? "It does contain a question, which is worth answering directly." : ""}`.trim()
        : `This reads as ${matched?.label} because of the wording quoted above. That is a pattern match on the text, not a mind read — the substance still needs a human to decide how to answer.`,
    suggestedReply: null,
    suggestedReplyFactsUsed: [],
    followUpAdvice:
      classification === "interested"
        ? "Reply within the hour with two concrete slots. Do not add new claims to the thread while they are warm."
        : classification === "out_of_office" || classification === "auto_reply"
          ? "This is not a person responding. Do not count it as engagement or move the deal on the strength of it."
          : classification === "rejection"
            ? "Close the thread politely and mark the record. One recorded reason here is worth more than a fourth chase."
            : classification === "not_now"
              ? "Set a real date in the notes, not 'follow up later'. A not-now with no date is a soft no."
              : classification === "referral"
                ? "The referral is the lead. Ask for an introduction rather than starting cold with the new name."
                : classification === "question"
                  ? "Answer the exact question asked before adding anything else."
                  : "Read it yourself. Nothing here is confident enough to automate.",
    suggestedStage,
  };
}

interface ModelReply extends Partial<Omit<ReplyIntelligence, "suggestedReply" | "evidenceQuotes" | "suggestedReplyFactsUsed">> {
  suggestedReply?: string;
  evidenceQuotes?: unknown;
  suggestedReplyFactsUsed?: unknown;
}

export async function GET() {
  const hasChatGpt = Boolean(getChatGptKey());
  const hasGemini = Boolean(getGeminiKey());
  return NextResponse.json({
    status: "ok",
    agent: AGENT,
    hasApiKey: hasChatGpt || hasGemini,
    writers: [
      { provider: "chatgpt", envKey: PRIMARY_KEY_NAME, configured: hasChatGpt },
      { provider: "gemini", envKey: PRIMARY_GEMINI_KEY_NAME, configured: hasGemini },
    ],
    provider: hasChatGpt ? "chatgpt + rules" : hasGemini ? "gemini + rules" : "rules",
    inboxConnected: false,
    writesRecords: false,
    note: "You paste the reply in. Nothing reads an inbox, and no reply is ever sent from here.",
  });
}

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return jsonEnvelope(failEnvelope<ReplyIntelligence>(AGENT, "bad_request", "Body must be JSON."), { status: 400 });
  }

  const reply = String(body?.reply ?? body?.text ?? "").replace(/\r\n/g, "\n").slice(0, MAX_REPLY_CHARS).trim();
  if (reply.length < 2) {
    return jsonEnvelope(failEnvelope<ReplyIntelligence>(AGENT, "bad_request", "Paste the reply text: { reply: \"...\" }."), { status: 400 });
  }

  const lead = toLead(body?.lead ?? body?.account);
  const facts: GroundedFact[] = Array.isArray(body?.facts)
    ? body.facts
        .filter((f: any) => f?.verified !== false)
        .map((f: any) => ({ id: String(f.id ?? ""), field: String(f.field ?? ""), value: String(f.value ?? "").slice(0, 300), source: String(f.source ?? "crm.record") }))
    : [];

  const base = rulePass(reply);
  const lower = reply.toLowerCase();

  if (!hasAnyWriterKey()) {
    return jsonEnvelope(
      okEnvelope<ReplyIntelligence>(
        AGENT,
        "rules",
        base,
        `Read by pattern matching on the words in the reply itself — no model, no inbox access. Add ${PRIMARY_KEY_NAME} or ${PRIMARY_GEMINI_KEY_NAME} in Vercel to get intent reading and a drafted response. Nothing was written back to any record.`
      )
    );
  }

  const systemPrompt = `You are the Reply / Conversation Intelligence Agent. A prospect has replied to an outbound email and the rep pasted the reply to you. You are not connected to any inbox: everything you know is in this prompt.

Rules:
- Quote evidence verbatim from the reply. If you cannot quote it, do not assert it.
- Separate what they said from what you suspect. "readingBetweenTheLines" is allowed to be a hypothesis, but must be labelled as one.
- Do not invent warmth, urgency, budget authority or a buying committee.
- Suggest a stage only when the reply clearly supports it, otherwise null.
- For suggestedReply: use only the approvedFacts given. Never add numbers, results, client names or claims that are not in that list. Identify the sender and include an opt-out line. Under 90 words. If the reply needs information you were not given, write a reply that asks for it instead of making it up.

JSON only:
{ "classification": "interested|objection|question|referral|not_now|rejection|out_of_office|auto_reply|unclear",
  "sentiment": "positive|neutral|negative",
  "confidence": 0-1,
  "evidenceQuotes": ["verbatim spans"],
  "objections": ["..."],
  "commitments": ["what they promised to do, verbatim-grounded"],
  "whatTheyAskedFor": ["..."],
  "readingBetweenTheLines": "hypothesis, labelled as such",
  "suggestedReply": "text or empty",
  "suggestedReplyFactsUsed": ["fact ids used"],
  "followUpAdvice": "one or two sentences",
  "suggestedStage": "new|contacted|meeting|closed|null" }`;

  const userPrompt = JSON.stringify(
    {
      prospect: lead ? { company: lead.company, name: lead.name, title: lead.title, stage: lead.stage, niche: lead.niche } : null,
      whatWeSent: typeof body?.sentEmail === "string" ? body.sentEmail.slice(0, 1500) : null,
      approvedFacts: facts,
      reply,
    },
    null,
    1
  );

  const answer = await writeWithFallback<ModelReply>(systemPrompt, userPrompt, 0.2);

  if (!answer.ok) {
    if (answer.status === "no_key") {
      return jsonEnvelope(failEnvelope<ReplyIntelligence>(AGENT, "no_key", answer.message));
    }
    return jsonEnvelope(
      okEnvelope<ReplyIntelligence>(
        AGENT,
        "rules",
        base,
        `AI did not answer (${answer.message}). The reading below is the pattern-match version only.`
      )
    );
  }

  const data = answer.data || {};
  const quoted = asStringArray(data.evidenceQuotes, 6).filter((q) => lower.includes(q.toLowerCase()));
  const droppedQuotes = asStringArray(data.evidenceQuotes, 6).length - quoted.length;

  const usedFactIds = asStringArray(data.suggestedReplyFactsUsed, 12);
  const knownIds = new Set(facts.map((f) => f.id));
  const inventedFactUse = usedFactIds.filter((id) => id && !knownIds.has(id));

  const classification = (
    ["interested", "objection", "question", "referral", "not_now", "rejection", "out_of_office", "auto_reply", "unclear"] as Classification[]
  ).includes(data.classification as Classification)
    ? (data.classification as Classification)
    : base.classification;

  const result: ReplyIntelligence = {
    ...base,
    classification,
    sentiment: ["positive", "neutral", "negative"].includes(data.sentiment as string) ? (data.sentiment as ReplyIntelligence["sentiment"]) : base.sentiment,
    confidence: Number.isFinite(Number(data.confidence)) ? Math.max(0, Math.min(1, Number(data.confidence))) : base.confidence,
    evidenceQuotes: quoted.length ? quoted : base.evidenceQuotes,
    objections: asStringArray(data.objections, 6),
    commitments: asStringArray(data.commitments, 6),
    whatTheyAskedFor: asStringArray(data.whatTheyAskedFor, 6),
    readingBetweenTheLines: String(data.readingBetweenTheLines || base.readingBetweenTheLines).slice(0, 700),
    suggestedReply: data.suggestedReply ? stripCitations(String(data.suggestedReply).slice(0, 2000)) : null,
    suggestedReplyFactsUsed: usedFactIds,
    followUpAdvice: String(data.followUpAdvice || base.followUpAdvice).slice(0, 500),
    suggestedStage: ["new", "contacted", "meeting", "closed"].includes(String(data.suggestedStage)) ? (data.suggestedStage as PipelineStage) : base.suggestedStage,
  };

  const label = providerLabel(answer.modelProvider, answer.modelName);

  return jsonEnvelope(
    okEnvelope<ReplyIntelligence>(
      AGENT,
      answer.modelProvider,
      result,
      [
        `${label} analyzed the reply. No inbox is connected: this reads text you pasted.`,
        droppedQuotes > 0 ? `${droppedQuotes} quote(s) the model attributed to the reply were not found in it and were discarded.` : "Every quote the model used was found verbatim in the reply.",
        inventedFactUse.length > 0 ? `The draft cited facts that were never approved (${inventedFactUse.join(", ")}) — check the draft before using it.` : "The draft only cites facts you approved.",
      ].join(" ")
    )
  );
}
