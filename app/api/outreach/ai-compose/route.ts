import { NextResponse } from "next/server";

export async function GET() {
  const apiKey =
    process.env.CHATGPT_API ||
    process.env.OPENAI_API_KEY ||
    process.env.CHATGPT_API_KEY;

  return NextResponse.json({
    status: "ok",
    hasApiKey: Boolean(apiKey && apiKey.trim().length > 0),
    engine: "ChatGPT Outreach Email Composer Brain",
    envKey: "CHATGPT_API",
  });
}

export async function POST(req: Request) {
  try {
    const reqData = await req.json();
    const {
      lead = {},
      angle = "value_led", // "value_led" | "pain_point" | "quick_question" | "peer_to_peer" | "case_study"
      senderName = "Cyril Charles",
      senderCompany = "Iwaju Marketing",
      senderTitle = "Managing Partner",
      customDirective = "",
      facts = [],
    } = reqData;

    const apiKey =
      process.env.CHATGPT_API ||
      process.env.OPENAI_API_KEY ||
      process.env.CHATGPT_API_KEY;

    if (apiKey && apiKey.trim().length > 0 && lead.company) {
      try {
        const systemPrompt = `You are the Elite Cold Email Copywriter Brain of Iwaju Marketing OS.
You compose hyper-personalized, concise, high-converting B2B cold emails to C-level executives and business owners.

Principles:
1. Under 110 words for the main body. No fluff, no "I hope this email finds you well", no robotic openings.
2. Hook: Reference specific researched evidence (e.g. verified corporate filings, tech stack, company niche, location).
3. Value Proposition: Quantifiable impact (e.g., pipeline acceleration, deal retention, CAC reduction).
4. Low-friction Call To Action: E.g., "Open to a 5-minute call Thursday?" or "Worth a brief chat this week?"
5. Tone: Respectful, razor-sharp, peer-to-peer.
6. Return JSON only.`;

        const userPrompt = `Compose cold email sequence for:
Recipient: ${lead.name || "Executive"} (${lead.title || "Managing Director"})
Company: ${lead.company}
Niche: ${lead.niche || "Enterprise"}
Location: ${lead.location || "Nigeria"}
Deal Value Target: ${lead.dealValue ? `₦${Number(lead.dealValue).toLocaleString()}` : "Enterprise Retainer"}
Angle: ${angle}
Sender: ${senderName}, ${senderTitle} at ${senderCompany}
Verified Facts & Signals: ${JSON.stringify(facts.length > 0 ? facts : lead.facts || [])}
Custom Directive: ${customDirective || "Keep tone direct, professional, and concise."}

Required JSON format:
{
  "subject": "Primary attention-grabbing subject line",
  "altSubjects": ["Alternative A/B Subject 1", "Alternative A/B Subject 2"],
  "body": "The email text with clean paragraph breaks",
  "followUpSubject": "Re: subject line",
  "followUpBody": "Short 3-sentence follow-up sequence for 3 days later",
  "hookFactUsed": "The specific fact or evidence item referenced in the opening",
  "estimatedReadTimeSec": 25,
  "confidenceScore": 0.94
}`;

        const openAiRes = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey.trim()}`,
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            response_format: { type: "json_object" },
            temperature: 0.4,
          }),
        });

        if (openAiRes.ok) {
          const aiJson = await openAiRes.json();
          const content = aiJson?.choices?.[0]?.message?.content;
          if (content) {
            const parsed = JSON.parse(content);
            if (parsed.subject && parsed.body) {
              return NextResponse.json({
                success: true,
                provider: "ChatGPT (GPT-4o-mini)",
                isLiveChatGPT: true,
                ...parsed,
              });
            }
          }
        }
      } catch (e: any) {
        console.warn("ChatGPT email compose error, using heuristic fallback:", e?.message);
      }
    }

    // Heuristic Fallback
    const recipientName = lead.name ? lead.name.split(" ")[0] : "there";
    const companyName = lead.company || "your firm";
    const nicheName = lead.niche || "your market";
    const cityName = lead.location ? lead.location.split(",")[0].trim() : "Nigeria";

    let subject = `${companyName} outbound deal velocity in ${cityName}`;
    let emailBody = `Hi ${recipientName},\n\nI noticed ${companyName}'s rapid presence in ${nicheName} across ${cityName}.\n\nMost firms in your tier face high customer acquisition friction when scaling retainers past ₦20M+. We built an autonomous outbound engine that delivers qualified enterprise meetings directly into your calendar with zero manual SDR overhead.\n\nWould you be open to a brief 6-minute intro call this Thursday at 2 PM to review the benchmark?`;

    if (angle === "pain_point") {
      subject = `Quick observation regarding ${companyName}'s outbound pipeline`;
      emailBody = `Hi ${recipientName},\n\nScaling commercial retainers in ${nicheName} usually comes down to one bottleneck: deal discovery takes too long, and manual email prospecting burns rep hours.\n\nWe deployed an automated agent fleet for companies in ${cityName} that verifies executive decision makers and secures high-intent meetings.\n\nWorth exploring if this fits ${companyName}'s targets for next month?`;
    } else if (angle === "quick_question") {
      subject = `Quick question for ${lead.name || companyName}`;
      emailBody = `Hi ${recipientName},\n\nAre you currently looking to expand ${companyName}'s corporate client acquisition in ${cityName} over the next two quarters?\n\nIf so, I have a quick 1-page playbook showing how peer firms in ${nicheName} automated their outbound pipeline.\n\nMind if I send the link over?`;
    }

    return NextResponse.json({
      success: true,
      provider: "Built-in Heuristic Brain",
      isLiveChatGPT: false,
      notice:
        "Using built-in email copywriting templates. Set CHATGPT_API in Vercel to enable live ChatGPT autonomous email composing.",
      subject,
      altSubjects: [
        `Idea for ${companyName} + ${nicheName}`,
        `${recipientName} — quick question on ${companyName}`,
      ],
      body: emailBody,
      followUpSubject: `Re: ${subject}`,
      followUpBody: `Hi ${recipientName},\n\nFollowing up briefly on my earlier note regarding ${companyName}'s enterprise pipeline in ${cityName}.\n\nDo you have 5 minutes next Tuesday for a quick walkthrough?`,
      hookFactUsed: `Verified corporate operations in ${cityName} within ${nicheName}`,
      estimatedReadTimeSec: 25,
      confidenceScore: 0.9,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to compose email." },
      { status: 500 }
    );
  }
}
