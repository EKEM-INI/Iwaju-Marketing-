import type { ConsentRecord } from "@/types";
import { isFreeMailDomain, emailDomain, isPlaceholderPhone } from "@/lib/address-class";
import { scopeKey } from "@/lib/account-scope";

/**
 * Reachability rules for the channels a human has to answer on: phone, WhatsApp
 * and voice. Nothing here sends anything. Its only job is to say whether a
 * channel may even be proposed for a given record, and why.
 */

export type OutboundChannel = "email" | "phone" | "whatsapp" | "voice";

export const CONSENT_STORAGE_KEY = "iwaju_consent_v1";

/** Personal contact data is not kept indefinitely; past this point it needs a fresh yes. */
export const CONSENT_VALID_DAYS = 365;
export const PERSONAL_DATA_RETENTION_DAYS = 730;

export interface ChannelDecision {
  channel: OutboundChannel;
  allowed: boolean;
  reason: string;
  requires: string | null;
}

export function emptyConsent(leadId: string): Record<OutboundChannel, ConsentRecord | undefined> {
  return { email: undefined, phone: undefined, whatsapp: undefined, voice: undefined };
}

export function consentFor(
  store: Record<string, Partial<Record<OutboundChannel, ConsentRecord>>>,
  leadId: string,
  channel: OutboundChannel
): ConsentRecord | undefined {
  return store?.[leadId]?.[channel];
}

export function consentIsLive(record: ConsentRecord | undefined, now = Date.now()): { ok: boolean; reason: string } {
  if (!record) return { ok: false, reason: "No consent recorded for this channel." };
  if (!record.granted) return { ok: false, reason: "Consent was explicitly declined or never given." };
  if (!record.grantedAt) return { ok: false, reason: "Consent has no date, so it cannot be proven." };
  const grantedAt = Date.parse(record.grantedAt);
  if (Number.isNaN(grantedAt)) return { ok: false, reason: "Consent date is unreadable." };
  const ageDays = Math.floor((now - grantedAt) / 86400000);
  if (ageDays > CONSENT_VALID_DAYS) {
    return { ok: false, reason: `Consent is ${ageDays} days old. Consent is treated as valid for ${CONSENT_VALID_DAYS} days, then it must be re-given.` };
  }
  if (record.retainUntil) {
    const until = Date.parse(record.retainUntil);
    if (!Number.isNaN(until) && until <= now) {
      return { ok: false, reason: "The retention window on this contact detail has expired; the number should be removed, not dialled." };
    }
  }
  return { ok: true, reason: `Consented on ${record.grantedAt.slice(0, 10)} (${record.source || "source not stated"}).` };
}

/**
 * The single gate every agent calls before proposing a channel.
 * `hasNumber` / `hasEmail` describe what the record actually holds.
 */
export function decideChannel(
  channel: OutboundChannel,
  input: {
    consent?: ConsentRecord;
    phone?: string;
    email?: string;
    stage?: string;
    replied?: boolean;
  }
): ChannelDecision {
  if (channel === "email") {
    const email = (input.email || "").trim().toLowerCase();
    if (!email) {
      return { channel, allowed: false, reason: "No email on this record.", requires: "an email address" };
    }
    if (isFreeMailDomain(emailDomain(email))) {
      return {
        channel,
        allowed: Boolean(input.consent && consentIsLive(input.consent).ok),
        reason: isFreeMailDomain(emailDomain(email))
          ? `${email} is a consumer mailbox. Treat it as personal data: a reply or an explicit opt-in is required before cold mail.`
          : "",
        requires: "recorded consent or an inbound reply",
      };
    }
    return { channel, allowed: true, reason: "Corporate mailbox on the company's own domain. Opt-out must be offered in the message.", requires: null };
  }

  if (channel === "phone" || channel === "whatsapp" || channel === "voice") {
    const phone = (input.phone || "").trim();
    if (!phone) {
      return { channel, allowed: false, reason: "No number on this record.", requires: "a sourced number" };
    }
    if (isPlaceholderPhone(phone)) {
      return {
        channel,
        allowed: false,
        reason: `"${phone}" is a placeholder pattern, not a sourced number. It was never dial-able.`,
        requires: "a real number from the contact",
      };
    }
    const consent = consentIsLive(input.consent);
    if (!consent.ok) {
      return {
        channel,
        allowed: false,
        reason: `${channel === "phone" ? "A call" : channel === "whatsapp" ? "A WhatsApp message" : "A voice note"} to ${phone} needs recorded consent. ${consent.reason}`,
        requires: `consent for ${channel}`,
      };
    }
    if (channel === "whatsapp" && !input.replied && input.stage === "new") {
      return {
        channel,
        allowed: true,
        reason: `${consent.reason} WhatsApp is still a personal space: keep the first message to one line and make opting out easy.`,
        requires: null,
      };
    }
    return { channel, allowed: true, reason: consent.reason, requires: null };
  }

  return { channel, allowed: false, reason: "Unknown channel.", requires: null };
}

export function recordConsent(
  store: Record<string, Partial<Record<OutboundChannel, ConsentRecord>>>,
  leadId: string,
  channel: OutboundChannel,
  granted: boolean,
  source: string
): Record<string, Partial<Record<OutboundChannel, ConsentRecord>>> {
  const now = new Date().toISOString();
  const retainUntil = new Date(Date.now() + PERSONAL_DATA_RETENTION_DAYS * 86400000).toISOString();
  const next = { ...store };
  next[leadId] = { ...(next[leadId] || {}), [channel]: { leadId, channel, granted, grantedAt: granted ? now : null, source, retainUntil: granted ? retainUntil : null } };
  return next;
}

/** Load/save are browser-only; the server never holds consent, which is why agents ask for it per call. */
export function loadConsentStore(): Record<string, Partial<Record<OutboundChannel, ConsentRecord>>> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(scopeKey(CONSENT_STORAGE_KEY));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveConsentStore(store: Record<string, Partial<Record<OutboundChannel, ConsentRecord>>>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(scopeKey(CONSENT_STORAGE_KEY), JSON.stringify(store));
  } catch {
    // private mode: consent then lives only for this session
  }
}
