import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { message } = await req.json();

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "A message string is required." },
        { status: 400 }
      );
    }

    const apiKey =
      process.env.GEMINI_API_KEY ||
      process.env.NEXT_PUBLIC_GEMINI_API_KEY;

    const systemPrompt = `You are "Iwaju AI", the executive outbound intelligence assistant embedded directly into Iwaju Marketing OS.
You are helping marketing executives, SDRs, agency founders, and clients navigate, understand, and leverage the Iwaju Marketing platform.

PLATFORM CAPABILITIES:
1. Executive Command Center (Dashboard):
   - Real-time pipeline velocity metrics: Active Leads count, Pipeline Value (in NGN/USD), Average Lead Quality Score (0-100), and Closed Won conversions.
2. High-Speed Lead Prospecting (/prospecting):
   - Multi-source scraper integrating Apollo.io Live Organizations Search API, Google Maps Places API, and DeepCrawler radar.
   - Searches targeted B2B accounts by industry and location (e.g. Lagos, Abuja, Port Harcourt, Uyo).
3. Pipeline CRM Kanban Board (/pipeline):
   - Visual Kanban columns: "New Lead", "Contacted", "Discovery / Meeting", "Closed Won".
4. Cold Outreach Copy Engine (/outreach):
   - Proven B2B cold email templates (Executive Brief, Pain Point, Social Proof, Meeting Invite).
5. Authentication:
   - Mandatory Google Workspace / Gmail account authentication gate.

Respond clearly, concisely, and authoritatively. If asked for sales pitches or outreach copy, provide high-converting, professional emails.`;

    if (apiKey) {
      try {
        const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

        const geminiRes = await fetch(geminiEndpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [{ text: `${systemPrompt}\n\nClient Question: ${message}` }],
              },
            ],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 1024,
            },
          }),
        });

        if (geminiRes.ok) {
          const geminiData = await geminiRes.json();
          const generatedText =
            geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;

          if (generatedText) {
            return NextResponse.json({
              answer: generatedText,
              provider: "Google Gemini 2.5 Flash (Live API)",
              isLiveGemini: true,
            });
          }
        }
      } catch (geminiError) {
        console.error("Gemini invocation error:", geminiError);
      }
    }

    const q = message.toLowerCase();
    let localAnswer = "";

    if (q.includes("prospect") || q.includes("scrape") || q.includes("find lead") || q.includes("radar")) {
      localAnswer = `**How Lead Prospecting Works in Iwaju Marketing:**\n- Navigate to **Lead Prospecting** in the sidebar.\n- Enter your target **Industry / Niche** and **Target Geography** (e.g. Ikoyi Lagos, Abuja, Uyo).\n- Select your data source (Apollo.io or Google Maps Places API).\n- Click **Initiate Deep Scrape** to uncover verified accounts with decision-maker contacts.\n- Click **Push to Pipeline** on any discovered lead to immediately populate your CRM!`;
    } else if (q.includes("pipeline") || q.includes("kanban") || q.includes("stage") || q.includes("crm")) {
      localAnswer = `**Iwaju Pipeline CRM Overview:**\n- Open **Pipeline CRM** from the sidebar navigation.\n- Your leads are organized into standard outbound velocity stages: *New Lead*, *Contacted*, *Meeting Booked*, and *Closed Won*.\n- Click stage transition controls (\`‹\` and \`›\`) on any card to advance deals and update total revenue metrics.`;
    } else if (q.includes("email") || q.includes("outreach") || q.includes("copy") || q.includes("template")) {
      localAnswer = `**Cold Outreach Copy Engine:**\n- Go to **Outreach Engine** in the sidebar.\n- Choose from 4 proven executive templates: *Executive Value Brief*, *Pain-Point Agitator*, *Social Proof / Case Study*, and *Low-Friction Meeting Invite*.\n- Dynamic tokens like \`{{firstName}}\` and \`{{company}}\` automatically personalize the pitch for the currently selected lead.`;
    } else if (q.includes("login") || q.includes("auth") || q.includes("google")) {
      localAnswer = `**Google Authentication Security:**\n- All users are required to sign in with their Google account before accessing leads and pipeline metrics.\n- Your session is securely stored locally and can be signed out anytime via the user avatar in the top right header.`;
    } else {
      localAnswer = `**Iwaju AI Copilot Ready:**\nI can help you navigate Iwaju Marketing:\n- 🎯 **Lead Generation**: Explaining how Apollo & Google Maps prospecting works.\n- 💼 **Pipeline CRM**: Managing deal stages and revenue metrics.\n- ✉️ **Cold Outreach**: Generating custom sales copy and emails for decision makers.\n\n*Tip: Add \`GEMINI_API_KEY="your_key"\` to your \`.env.local\` file to enable unrestricted live Gemini generative responses for any client query.*`;
    }

    return NextResponse.json({
      answer: localAnswer,
      provider: "Iwaju Outbound Intelligence",
      isLiveGemini: false,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to process question." },
      { status: 500 }
    );
  }
}
