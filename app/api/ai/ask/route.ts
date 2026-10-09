import { NextResponse } from "next/server";

export async function GET() {
  const apiKey =
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.NEXT_PUBLIC_GEMINI_API_KEY;

  return NextResponse.json({
    status: "ok",
    hasApiKey: Boolean(apiKey && apiKey.trim().length > 0),
    model: "gemini-3.8-flash",
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { message, history, apiKey: clientApiKey } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "A message string is required." },
        { status: 400 }
      );
    }

    const headerApiKey = req.headers.get("x-gemini-api-key");
    const apiKey =
      (clientApiKey && clientApiKey.trim()) ||
      (headerApiKey && headerApiKey.trim()) ||
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      process.env.NEXT_PUBLIC_GEMINI_API_KEY;

    if (!apiKey || apiKey.trim().length === 0) {
      return NextResponse.json({
        answer: "⚠️ **Gemini API Key Missing:** No `GEMINI_API_KEY` was detected in your Vercel Environment Variables. Please make sure you added `GEMINI_API_KEY` under your Vercel Project Settings → Environment Variables and redeployed your application.",
        provider: "Configuration Error",
        isLiveGemini: false,
      });
    }

    const systemPrompt = `You are "Iwaju AI Copilot", the intelligent outbound sales and platform copilot for Iwaju Marketing OS.
You are directly connected to Google Gemini to provide authentic, highly contextual, intelligent responses.

PLATFORM CONTEXT:
1. Executive Command Center: Live KPI metrics for leads, deals in NGN (₦) and USD ($), funnel velocity, and lead scoring.
2. Lead Prospecting (/prospecting): Advanced B2B prospecting across Nigerian commercial hubs (Ikoyi, Victoria Island Lagos, Abuja, Port Harcourt, Uyo) and global hubs using Apollo.io, Google Maps Places API, and DeepCrawler radar.
3. Pipeline CRM (/pipeline): Kanban CRM with stages: New Lead, Contacted, Meeting Booked, Closed Won. Allows dragging leads and managing contract values.
4. Cold Outreach Copy Engine (/outreach): Dynamic personalization tokens ({{firstName}}, {{company}}, {{niche}}, {{location}}).
5. Authentication: Google Workspace SSO login.

INSTRUCTIONS:
- Give genuine, in-depth, authentic answers.
- When asked to explain features or navigation, give precise instructions.
- When asked to draft sales pitches, cold emails, or value propositions, generate tailored, high-converting copy.
- Never give generic stock answers. Reason through the client's specific question.`;

    const modelsToTry = ["gemini-3.8-flash", "gemini-flash-latest"];
    let lastError: any = null;

    for (const modelName of modelsToTry) {
      try {
        const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey.trim()}`;

        // Build request payload
        const contents: any[] = [];

        // Grounding instruction
        contents.push({
          role: "user",
          parts: [{ text: `${systemPrompt}\n\nClient Question: ${message}` }],
        });

        const geminiRes = await fetch(geminiEndpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents,
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 2048,
            },
          }),
        });

        const geminiData = await geminiRes.json();

        if (geminiRes.ok) {
          const generatedText =
            geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;

          if (generatedText) {
            return NextResponse.json({
              answer: generatedText,
              provider: `Google Gemini (${modelName})`,
              isLiveGemini: true,
              model: modelName,
            });
          }
        } else {
          lastError = geminiData?.error?.message || `Model ${modelName} returned status ${geminiRes.status}`;
          console.warn(`Gemini call to ${modelName} failed:`, geminiData);
        }
      } catch (err: any) {
        lastError = err.message;
      }
    }

    return NextResponse.json({
      answer: `⚠️ **Gemini API Error:** ${lastError || "Failed to reach Google Gemini API"}.\n\nPlease ensure your \`GEMINI_API_KEY\` in Vercel is active and has access to Google Gemini in Google AI Studio.`,
      provider: "Gemini Error",
      isLiveGemini: false,
      error: lastError,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to process question." },
      { status: 500 }
    );
  }
}
