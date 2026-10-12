import type { Lead } from "@/types";

/**
 * Hand-off helpers. Nothing here transmits anything: a mailto link opens the
 * rep's own mail client, a tel link opens the dialer, and a CSV download writes
 * a file. The app never talks to a mail server, so the campaign cannot send on
 * its own and no "delivered" claim can be made.
 */

const MAILTO_LIMIT = 1600;

export interface HandoffOption {
  id: "mail" | "dial" | "whatsapp" | "copy" | "csv";
  label: string;
  available: boolean;
  reason: string;
  href?: string;
}

function clean(value: string): string {
  return (value || "").trim();
}

export function mailtoHref(email: string, subject: string, body: string): string {
  const to = encodeURIComponent(clean(email));
  const s = encodeURIComponent(clean(subject).slice(0, 200));
  let b = clean(body);
  if (b.length > MAILTO_LIMIT) b = `${b.slice(0, MAILTO_LIMIT)}\n\n[draft trimmed to fit a mail link - copy the full text instead]`;
  return `mailto:${to}?subject=${s}&body=${encodeURIComponent(b)}`;
}

/** Digits and a leading plus only, so a phone string cannot break out of the URI. */
function dialable(phone: string): string {
  const stripped = clean(phone).replace(/[^\d+]/g, "");
  return stripped.replace(/^\+/, "");
}

export function telHref(phone: string): string {
  return `tel:${dialable(phone)}`;
}

export function whatsappHref(phone: string, body: string): string {
  const digits = dialable(phone);
  const text = encodeURIComponent(clean(body).slice(0, 600));
  return `https://wa.me/${digits}${text ? `?text=${text}` : ""}`;
}

export function csvCell(value: unknown): string {
  const text = String(value ?? "").replace(/\r?\n/g, " ").replace(/"/g, '""');
  return `"${text}"`;
}

export function buildCsv(header: string[], rows: unknown[][]): string {
  return [header.map(csvCell).join(","), ...rows.map((row) => row.map(csvCell).join(","))].join("\r\n");
}

export function downloadText(filename: string, text: string, mime = "text/csv;charset=utf-8"): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") return false;
  try {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    // Revoke on the next tick so Safari has time to start the download.
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
    return true;
  } catch {
    return false;
  }
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // clipboard permission denied or unavailable; fall through
  }
  return false;
}

export function handoffOptions(args: {
  kind: string;
  lead: Lead;
  subject?: string;
  body?: string;
  channelAllowed: boolean;
  channelReason: string;
}): HandoffOption[] {
  const { kind, lead } = args;
  const body = clean(args.body || "");
  const subject = clean(args.subject || "");

  if (kind === "call") {
    const digits = dialable(lead.phone);
    return [
      {
        id: "dial",
        label: "Open the dialer",
        available: args.channelAllowed && digits.length >= 7,
        reason: !args.channelAllowed ? args.channelReason : digits.length >= 7 ? "Dials through your own phone app. This app places no call." : "No dial-able number on this record.",
        href: digits.length >= 7 ? telHref(lead.phone) : undefined,
      },
      {
        id: "copy",
        label: "Copy the call plan",
        available: body.length > 0,
        reason: body.length > 0 ? "Paste it into your notes." : "Write the draft first.",
      },
    ];
  }

  if (kind === "whatsapp") {
    const digits = dialable(lead.phone);
    return [
      {
        id: "whatsapp",
        label: "Open WhatsApp",
        available: args.channelAllowed && digits.length >= 7,
        reason: !args.channelAllowed
          ? args.channelReason
          : digits.length >= 7
          ? "Opens wa.me in your browser with the text pre-filled. You press send."
          : "No number on this record.",
        href: digits.length >= 7 ? whatsappHref(lead.phone, body) : undefined,
      },
    ];
  }

  const email = clean(lead.email);
  return [
    {
      id: "mail",
      label: "Hand off to my mail app",
      available: args.channelAllowed && Boolean(email) && body.length > 0,
      reason: !args.channelAllowed
        ? args.channelReason
        : !email
        ? "No email address on this record."
        : body.length > 0
        ? "Opens your mail client with the draft loaded. Nothing is sent until you press send there."
        : "Write the draft first.",
      href: email && body ? mailtoHref(email, subject, body) : undefined,
    },
    {
      id: "copy",
      label: "Copy the text",
      available: body.length > 0,
      reason: body.length > 0 ? "For pasting into Gmail or a bulk tool outside this app." : "Write the draft first.",
    },
  ];
}
