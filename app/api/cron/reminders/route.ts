import { NextResponse } from "next/server";
import { Lead, SlaAuditReport, SlaItem } from "@/types";
import { auditLeadsSla } from "@/lib/sla";
import { writeWithFallback } from "@/lib/outreach-writer";
import { formatCurrency } from "@/lib/utils";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Autonomous Follow-Up Reminder Cron & SLA Alerting Engine
 *
 * Can be triggered:
 * 1. Automatically on a schedule by Vercel Cron via GET /api/cron/reminders
 * 2. Programmatically or via the UI via POST /api/cron/reminders
 */

function verifyCronAuth(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.trim().length === 0) {
    return true; // No secret configured, allow execution
  }
  const authHeader = req.headers.get("authorization");
  return authHeader === `Bearer ${secret.trim()}`;
}

async function sendSlaEmailDigest(
  recipientEmail: string,
  report: SlaAuditReport
): Promise<boolean> {
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey || resendApiKey.trim().length === 0) {
    return false;
  }

  const fromAddress =
    process.env.RESEND_FROM_EMAIL || "Iwaju Security <onboarding@resend.dev>";

  const breachedListHtml = report.items
    .filter((i) => i.status === "breached")
    .slice(0, 10)
    .map(
      (item) => `
      <tr style="border-bottom: 1px solid #1e293b;">
        <td style="padding: 12px; color: #ffffff; font-weight: 600;">${item.company}</td>
        <td style="padding: 12px; color: #cbd5e1;">${item.name} (${item.stage.toUpperCase()})</td>
        <td style="padding: 12px; color: #f87171; font-weight: 600;">+${item.overdueHours}h overdue</td>
        <td style="padding: 12px; color: #34d399; font-weight: 600;">${item.currency} ${item.dealValue.toLocaleString()}</td>
        <td style="padding: 12px; color: #94a3b8; font-size: 12px;">${item.recommendedAction}</td>
      </tr>
    `
    )
    .join("");

  const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #020617; color: #f8fafc; padding: 40px 20px; }
        .container { max-width: 680px; margin: 0 auto; background: #0f172a; border: 1px solid #1e293b; border-radius: 16px; padding: 32px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
        .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #1e293b; padding-bottom: 20px; margin-bottom: 24px; }
        .logo { font-size: 18px; font-weight: 800; color: #10b981; letter-spacing: -0.5px; }
        .title { font-size: 22px; font-weight: 700; color: #ffffff; margin-bottom: 8px; }
        .badge { display: inline-block; padding: 4px 10px; border-radius: 9999px; background: rgba(239, 68, 68, 0.15); color: #f87171; font-size: 12px; font-weight: 600; font-family: monospace; }
        .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 24px 0; }
        .stat-card { background: #020617; border: 1px solid #1e293b; border-radius: 10px; padding: 14px; text-align: center; }
        .stat-val { font-size: 22px; font-weight: 800; color: #ffffff; }
        .stat-label { font-size: 11px; text-transform: uppercase; color: #64748b; font-family: monospace; margin-top: 4px; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 13px; text-align: left; }
        th { padding: 10px 12px; color: #64748b; font-size: 11px; text-transform: uppercase; font-family: monospace; border-bottom: 1px solid #1e293b; }
        .footer { font-size: 11px; color: #64748b; margin-top: 32px; border-top: 1px solid #1e293b; padding-top: 16px; text-align: center; font-family: monospace; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="logo">⚡ IWAJU MARKETING OS • EXECUTIVE ALERT</div>
        <h1 class="title">SLA Follow-Up Breach Alert</h1>
        <p style="color: #94a3b8; font-size: 14px; margin-top: 0;">
          The autonomous reminder engine detected <strong>${report.breachedCount} high-priority lead(s)</strong> that have exceeded customer touch SLA deadlines.
        </p>

        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-val" style="color: #f87171;">${report.breachedCount}</div>
            <div class="stat-label">Breached Deals</div>
          </div>
          <div class="stat-card">
            <div class="stat-val" style="color: #fbbf24;">${report.approachingCount}</div>
            <div class="stat-label">Approaching SLA</div>
          </div>
          <div class="stat-card">
            <div class="stat-val" style="color: #34d399;">${report.currency} ${report.totalAtRiskDealValue.toLocaleString()}</div>
            <div class="stat-label">At-Risk Value</div>
          </div>
        </div>

        <h3 style="font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; color: #cbd5e1; margin-top: 24px;">Immediate Attention Required</h3>
        <table>
          <thead>
            <tr>
              <th>Company</th>
              <th>Contact / Stage</th>
              <th>Overdue</th>
              <th>Value</th>
              <th>Recommended Action</th>
            </tr>
          </thead>
          <tbody>
            ${breachedListHtml}
          </tbody>
        </table>

        <div style="margin-top: 28px; text-align: center;">
          <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://iwaju-marketing.vercel.app"}/pipeline" style="display: inline-block; background: #10b981; color: #000000; font-weight: 700; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-size: 13px;">
            Open Pipeline CRM & Resolve Breaches
          </a>
        </div>

        <div class="footer">
          Generated automatically by Iwaju Marketing OS Autonomous SLA Monitor • ${new Date().toUTCString()}
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [recipientEmail.trim().toLowerCase()],
        subject: `⚠️ Iwaju SLA Alert: ${report.breachedCount} high-priority deal(s) overdue for follow-up`,
        html: emailHtml,
      }),
    });
    return res.ok;
  } catch (err) {
    console.error("Failed to dispatch SLA email digest", err);
    return false;
  }
}

export async function GET(req: Request) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    status: "ok",
    cron: "Autonomous Follow-Up Reminder Cron",
    frequency: "Daily at 08:00 UTC (configured in vercel.json)",
    slaPolicy: {
      newLeadHours: 24,
      contactedFollowUpHours: 72,
      meetingFollowUpHours: 24,
    },
    emailConfigured: Boolean(process.env.RESEND_API_KEY),
    note: "POST { leads: [...] } to execute on-demand SLA audit and send notification digests.",
  });
}

export async function POST(req: Request) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const rawLeads = Array.isArray(body?.leads) ? (body.leads as Lead[]) : [];
    const sendEmail = Boolean(body?.sendEmailAlert);
    const recipientEmail =
      body?.recipientEmail || process.env.SLA_ALERT_EMAIL || process.env.RESEND_TO_EMAIL;
    const generateAiDrafts = Boolean(body?.generateAiFollowUps);

    const report = auditLeadsSla(rawLeads);

    // Optionally generate AI Follow-Up snippets for top breached deals
    if (generateAiDrafts && report.breachedCount > 0) {
      const breachedToDraft = report.items
        .filter((i) => i.status === "breached")
        .slice(0, 3);

      await Promise.all(
        breachedToDraft.map(async (item) => {
          try {
            const systemPrompt = `You are a B2B sales cadence expert. Write a concise, 2-sentence follow-up nudge for a rep to send a lead whose follow-up SLA has breached. Return JSON: { "snippet": "..." }`;
            const userPrompt = `Lead: ${item.name} at ${item.company} (${item.stage} stage). Elapsed time: ${item.elapsedHours} hours. Recommended move: ${item.recommendedAction}`;
            const aiRes = await writeWithFallback<{ snippet: string }>(
              systemPrompt,
              userPrompt,
              0.4
            );
            if (aiRes.ok && aiRes.data?.snippet) {
              item.suggestedFollowUpSnippet = aiRes.data.snippet;
            }
          } catch {
            // Non-blocking
          }
        })
      );
    }

    let emailSent = false;
    if (sendEmail && recipientEmail && report.breachedCount > 0) {
      emailSent = await sendSlaEmailDigest(recipientEmail, report);
      report.emailAlertSent = emailSent;
    }

    return NextResponse.json({
      success: true,
      report,
      emailSent,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to run SLA audit" },
      { status: 500 }
    );
  }
}
