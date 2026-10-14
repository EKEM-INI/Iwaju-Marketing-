import { NextRequest } from "next/server";
import { jsonEnvelope, failEnvelope, okEnvelope } from "@/lib/agents";

const AGENT = "gmail-sender";

const GMAIL_PROFILE_URL = "https://www.googleapis.com/gmail/v1/users/me/profile";
const GMAIL_SEND_URL = "https://www.googleapis.com/gmail/v1/users/me/messages/send";

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

/** One address per line, RFC 2822 style. Gmail rejects a malformed To outright. */
function normaliseTo(value: unknown): string[] {
  const raw = Array.isArray(value) ? value.join(",") : String(value ?? "");
  return raw
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
}

function buildMime(input: {
  from: string;
  to: string[];
  subject: string;
  body: string;
  replyTo?: string;
  inReplyTo?: string;
  references?: string;
}): string {
  const lines = [
    `From: ${input.from}`,
    `To: ${input.to.join(", ")}`,
    input.subject ? `Subject: ${input.subject}` : "Subject: (no subject)",
    `Date: ${new Date().toUTCString()}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 7bit",
  ];
  if (input.replyTo) lines.push(`Reply-To: ${input.replyTo}`);
  if (input.inReplyTo) lines.push(`In-Reply-To: ${input.inReplyTo}`);
  if (input.references) lines.push(`References: ${input.references}`);
  lines.push("", input.body.replace(/\r\n/g, "\n"));
  return lines.join("\r\n");
}

function base64Url(value: string): string {
  const bytes = Buffer.from(value, "utf8");
  return bytes.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function readGoogleError(res: Response): Promise<string> {
  try {
    const data = await res.json();
    return describeGoogleError(data, res.status);
  } catch {
    return `Google returned HTTP ${res.status}.`;
  }
}

function describeGoogleError(data: any, status: number): string {
  const message = data?.error?.message || data?.error_description || data?.message;
  return message ? `Google said: ${message}` : `Google returned HTTP ${status}.`;
}

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return jsonEnvelope(failEnvelope<null>(AGENT, "bad_request", "Body must be JSON."));
  }

  const accessToken = String(body?.accessToken || "").trim();
  if (!accessToken) {
    return jsonEnvelope(
      failEnvelope<null>(
        AGENT,
        "no_token",
        "No Gmail access token was supplied, so nothing was sent. Connect Gmail in the Outbox first — this route will not send with an invented credential."
      )
    );
  }

  const to = normaliseTo(body?.to);
  if (to.length === 0 || !to.every(isEmail)) {
    return jsonEnvelope(
      failEnvelope<null>(AGENT, "bad_request", `Destination ${to[0] || "(blank)"} is not a deliverable address. Nothing was sent.`)
    );
  }

  const subject = String(body?.subject ?? "").trim().slice(0, 300);
  const message = String(body?.body ?? "").trim();
  if (!message) {
    return jsonEnvelope(failEnvelope<null>(AGENT, "bad_request", "The message body is empty, so nothing was sent."));
  }
  if (!subject) {
    return jsonEnvelope(
      failEnvelope<null>(AGENT, "bad_request", "No subject line. A blank subject lands in spam, so this send was refused.")
    );
  }

  // Confirm the token is still alive and learn which mailbox it belongs to. Gmail always
  // sends as that mailbox regardless of any From header, so this is the only honest sender value.
  let emailAddress = String(body?.from || "").trim().toLowerCase();
  try {
    const profileRes = await fetch(GMAIL_PROFILE_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (!profileRes.ok) {
      return jsonEnvelope(
        failEnvelope<null>(
          AGENT,
          "token_rejected",
          `Gmail refused the stored token (${await readGoogleError(profileRes)}). Reconnect Gmail in the Outbox; nothing was sent.`
        )
      );
    }
    const profile = await profileRes.json().catch(() => null);
    if (typeof profile?.emailAddress === "string") emailAddress = profile.emailAddress.toLowerCase();
  } catch (err: any) {
    return jsonEnvelope(
      failEnvelope<null>(
        AGENT,
        "provider_error",
        `Gmail could not be reached to check the token: ${err?.message || "network error"}. Nothing was sent.`
      )
    );
  }

  const mime = buildMime({
    from: emailAddress || "me",
    to,
    subject,
    body: message,
    replyTo: body?.replyTo ? String(body.replyTo).trim().toLowerCase() : undefined,
    inReplyTo: body?.inReplyTo ? String(body.inReplyTo).trim() : undefined,
    references: body?.references ? String(body.references).trim() : undefined,
  });

  try {
    const res = await fetch(GMAIL_SEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw: base64Url(mime) }),
      cache: "no-store",
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const detail =
        data?.error?.message || data?.error_description || data?.message || `HTTP ${res.status}`;
      return jsonEnvelope(
        failEnvelope<null>(
          AGENT,
          "provider_error",
          `Gmail refused this message: ${detail}. Nothing was sent to ${to.join(", ")}.`
        )
      );
    }

    return jsonEnvelope(
      okEnvelope(
        AGENT,
        "Gmail (gmail.send)",
        {
          sent: true,
          messageId: String(data?.id || ""),
          threadId: String(data?.threadId || ""),
          from: emailAddress,
          to,
          labelIds: Array.isArray(data?.labelIds) ? data.labelIds : [],
        },
        `Delivered to Gmail as ${emailAddress || "the connected mailbox"}. Gmail accepted message ${data?.id || "with no id"}.`
      )
    );
  } catch (err: any) {
    return jsonEnvelope(
      failEnvelope<null>(AGENT, "provider_error", `Send failed before Gmail accepted it: ${err?.message || "network error"}.`)
    );
  }
}

export async function GET() {
  return jsonEnvelope(
    failEnvelope<null>(
      AGENT,
      "no_token",
      "POST { accessToken, to, subject, body } to send one approved message through the connected Gmail account."
    )
  );
}
