import { NextResponse } from "next/server";

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

    // 1. If Resend API Key is set in Vercel, dispatch real email to user's inbox
    if (resendApiKey) {
      try {
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
                Thank you for creating an account on Iwaju Marketing OS. Please use the verification code below to confirm your email and access your B2B sales pipeline console:
              </div>
              <div class="code-box">
                <div class="code">${code}</div>
              </div>
              <div class="desc" style="font-size: 12px; color: #64748b;">
                This code will expire in 15 minutes. If you did not request this verification, you can safely ignore this email.
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
            to: [email],
            subject: `${code} is your Iwaju Marketing verification code`,
            html: emailHtml,
          }),
        });

        const resendData = await resendRes.json();

        if (resendRes.ok) {
          return NextResponse.json({
            success: true,
            provider: "Resend Email Dispatcher",
            messageId: resendData.id,
          });
        } else {
          console.error("Resend API delivery error:", resendData);
          return NextResponse.json(
            {
              error: `Email provider error: ${resendData?.message || "Failed to dispatch email"}`,
              details: resendData,
            },
            { status: 500 }
          );
        }
      } catch (sendErr: any) {
        console.error("Failed to send email via Resend:", sendErr);
        return NextResponse.json(
          { error: `Delivery failure: ${sendErr.message}` },
          { status: 500 }
        );
      }
    }

    // 2. If RESEND_API_KEY is not yet added in Vercel
    return NextResponse.json({
      success: false,
      notice: "RESEND_API_KEY_NOT_SET",
      error: "RESEND_API_KEY is not set in Vercel environment variables. Please add RESEND_API_KEY in your Vercel Project Settings to dispatch real emails directly to users' inboxes.",
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to process email dispatch." },
      { status: 500 }
    );
  }
}
