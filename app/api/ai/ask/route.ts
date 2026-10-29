import { NextResponse } from "next/server";
import { getGeminiKey } from "@/lib/gemini";
import { getChatGptKey, getChatGptModel } from "@/lib/chatgpt";

export async function GET() {
  const geminiKey = getGeminiKey();
  const chatGptKey = getChatGptKey();
  const hasApiKey = Boolean(geminiKey || chatGptKey);

  return NextResponse.json({
    status: "ok",
    hasApiKey,
    providers: [
      { provider: "gemini", configured: Boolean(geminiKey) },
      { provider: "chatgpt", configured: Boolean(chatGptKey) },
    ],
    model: geminiKey ? "gemini-3.8-flash" : chatGptKey ? getChatGptModel() : "none",
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { message, apiKey: clientApiKey } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "A message string is required." },
        { status: 400 }
      );
    }

    const headerApiKey = req.headers.get("x-gemini-api-key");
    const geminiKey =
      (clientApiKey && clientApiKey.trim()) ||
      (headerApiKey && headerApiKey.trim()) ||
      getGeminiKey();
    const chatGptKey = getChatGptKey();

    if (!geminiKey && !chatGptKey) {
      return NextResponse.json({
        answer: "⚠️ **AI API Key Missing:** Neither `GEMINI_API_KEY` nor `OPENAI_API_KEY` was detected in your Vercel Environment Variables. Please make sure you added your key under Vercel Project Settings → Environment Variables and redeployed your application.",
        provider: "Configuration Error",
        isLiveGemini: false,
      });
    }

    const systemPrompt = `You are "Iwaju AI Copilot", the intelligent outbound sales and platform copilot for Iwaju Marketing OS.
You provide authentic, highly contextual, intelligent responses.

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

    let lastError: any = null;

    // 1. Try Gemini with 4-tier model cascading
    if (geminiKey) {
      const modelsToTry = [
        "gemini-3.8-flash",
        "gemini-flash-latest",
        "gemini-flash-lite-latest",
        "gemini-2.5-flash-lite",
      ];

      for (const modelName of modelsToTry) {
        try {
          const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiKey.trim()}`;

          const contents = [
            {
              role: "user",
              parts: [{ text: `${systemPrompt}\n\nClient Question: ${message}` }],
            },
          ];

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
            lastError =
              geminiData?.error?.message ||
              `Model ${modelName} returned status ${geminiRes.status}`;
          }
        } catch (err: any) {
          lastError = err.message;
        }
      }
    }

    // 2. Fallback to ChatGPT if OpenAI key is present
    if (chatGptKey) {
      try {
        const model = getChatGptModel();
        const openAiRes = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${chatGptKey}`,
          },
          body: JSON.stringify({
            model,
            temperature: 0.7,
            max_tokens: 2048,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: message },
            ],
          }),
        });

        const openAiData = await openAiRes.json();
        if (openAiRes.ok) {
          const answer = openAiData?.choices?.[0]?.message?.content;
          if (answer) {
            return NextResponse.json({
              answer,
              provider: `ChatGPT (${model})`,
              isLiveGemini: false,
              model,
            });
          }
        } else {
          lastError = openAiData?.error?.message || `OpenAI returned status ${openAiRes.status}`;
        }
      } catch (openAiErr: any) {
        lastError = openAiErr.message;
      }
    }

    return NextResponse.json({
      answer: `⚠️ **AI Copilot Error:** ${lastError || "Failed to reach Google Gemini and OpenAI APIs"}.\n\nPlease ensure your API keys in Vercel are active.`,
      provider: "AI Provider Error",
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
