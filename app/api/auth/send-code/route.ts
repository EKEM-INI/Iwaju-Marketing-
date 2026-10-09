import { NextResponse } from "next/server";

export async function GET() {
  const apiKey = process.env.RESEND_API_KEY;
  const isSet = Boolean(apiKey && apiKey.trim().length > 0);
  const prefix = isSet ? apiKey!.trim().substring(0, 5) + "..." : "none";

  return NextResponse.json({
    status: "ok",
    resendConfigured: isSet,
    keyPrefix: prefix,
    hint: isSet
      ? "Resend is configured. Note: On Resend free tier (onboarding@resend.dev), emails can ONLY be delivered to the email address registered with your Resend account."
      : "RESEND_API_KEY not found in environment variables.",
  });
}

export async function POST(req: Request) {
  try {
    const { email, code, name } = await req.json();

    if (!email || !code) {
      return NextResponse.json(
        { error: "Email and verification code are required." },
        { status: 400 }
      );
    }

    const resendApiKey = process.env.RESEND_API_KEY;

    if (!resendApiKey || resendApiKey.trim().length === 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            "RESEND_API_KEY is not detected in your Vercel environment. Please check Vercel Settings → Environment Variables and make sure you Redeploy so the key is active.",
          code, // Provide code fallback so user is not blocked
        },
        { status: 200 }
      );
    }

    const fromAddress =
      process.env.RESEND_FROM_EMAIL || "Iwaju Security <onboarding@resend.dev>";

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #080c14; color: #f1f5f9; padding: 40px 20px; }
          .container { max-width: 520px; margin: 0 auto; background: #0f172a; border: 1px solid #1e293b; border-radius: 16px; padding: 32px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
          .logo { display: inline-block; font-size: 20px; font-weight: 800; color: #10b981; letter-spacing: -0.5px; margin-bottom: 24px; }
          .title { font-size: 20px; font-weight: 700; color: #ffffff; margin-bottom: 12px; }
          .desc { font-size: 14px; color: #94a3b8; line-height: 1.6; margin-bottom: 24px; }
          .code-box { background: #020617; border: 1px solid #10b981; border-radius: 12px; padding: 18px; text-align: center; margin: 24px 0; }
          .code { font-family: 'Courier New', Courier, monospace; font-size: 32px; font-weight: 800; color: #34d399; letter-spacing: 8px; }
          .footer { font-size: 12px; color: #64748b; margin-top: 32px; border-top: 1px solid #1e293b; padding-top: 16px; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">⚡ IWAJU MARKETING OS</div>
          <div class="title">Verify your email address</div>
          <div class="desc">
            Hello ${name ? name : "there"},<br><br>
            Please use the 6-digit verification code below to verify your email and access your B2B sales pipeline console:
          </div>
          <div class="code-box">
            <div class="code">${code}</div>
          </div>
          <div class="desc" style="font-size: 12px; color: #64748b;">
            This code expires in 15 minutes. If you did not request this verification, please ignore this email.
          </div>
          <div class="footer">
            Iwaju Marketing OS • Executive Outbound Pipeline Engine
          </div>
        </div>
      </body>
      </html>
    `;

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [email.trim().toLowerCase()],
        subject: `${code} is your Iwaju Marketing verification code`,
        html: emailHtml,
      }),
    });

    const resendData = await resendRes.json();

    if (resendRes.ok && resendData?.id) {
      return NextResponse.json({
        success: true,
        messageId: resendData.id,
        recipient: email,
      });
    }

    // Capture exact error from Resend (e.g. testing domain restriction)
    const errorDetails =
      resendData?.message ||
      resendData?.error?.message ||
      resendData?.error ||
      "Resend rejected email dispatch.";

    console.error("Resend delivery failed:", resendData);

    return NextResponse.json(
      {
        success: false,
        error: errorDetails,
        code, // Return code fallback so user is not locked out
        isRestrictedAccount:
          typeof errorDetails === "string" &&
          errorDetails.toLowerCase().includes("only send testing emails to your own email"),
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("Server error sending code:", err);
    return NextResponse.json(
      {
        success: false,
        error: err.message || "Server exception during email dispatch",
      },
      { status: 500 }
    );
  }
}
