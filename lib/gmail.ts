"use client";

/**
 * Gmail connection for real sending.
 *
 * This requests an access token from Google for the gmail.send scope and keeps it in this
 * browser under the signed-in account. There is no server-side vault in this app, so that is
 * the trade: whoever has this browser can send as you until the token expires (Google issues
 * roughly one hour) or you disconnect. The token is never sent anywhere except Google.
 *
 * The client ID is build-time (`NEXT_PUBLIC_GOOGLE_CLIENT_ID`), and the origin has to be listed
 * as an Authorized JavaScript origin in Google Cloud. With no client ID, nothing here pretends
 * a connection is possible.
 */

import { scopeKey } from "@/lib/account-scope";

export const GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send";
const TOKEN_STORAGE_KEY = "iwaju_gmail_token_v1";

export interface GmailConnection {
  accessToken: string;
  email: string;
  expiresAt: number;
  scope: string;
  connectedAt: string;
}

export type GmailConnectResult =
  | { ok: true; connection: GmailConnection }
  | { ok: false; error: string };

const listeners = new Set<(connection: GmailConnection | null) => void>();

export function gmailClientId(): string | null {
  const id = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim();
  return id && id.length > 0 ? id : null;
}

export function loadGmailConnection(): GmailConnection | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(scopeKey(TOKEN_STORAGE_KEY));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GmailConnection;
    if (!parsed?.accessToken) return null;
    if (parsed.expiresAt <= Date.now() + 15_000) {
      // Keep the address for display, but an expired token cannot send.
      return { ...parsed, accessToken: "" };
    }
    return parsed;
  } catch {
    return null;
  }
}

function saveGmailConnection(connection: GmailConnection | null): void {
  if (typeof window === "undefined") return;
  const key = scopeKey(TOKEN_STORAGE_KEY);
  if (connection) window.localStorage.setItem(key, JSON.stringify(connection));
  else window.localStorage.removeItem(key);
  listeners.forEach((fn) => fn(connection));
}

export function disconnectGmail(): void {
  saveGmailConnection(null);
}

export function onGmailChange(listener: (connection: GmailConnection | null) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function loadGsi(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("Browser-only."));
  if ((window as any).google?.accounts?.oauth2) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const src = "https://accounts.google.com/gsi/client";
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Google's sign-in library could not load.")));
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Google's sign-in library could not load. Check your network or a blocking extension."));
    document.head.appendChild(script);
  });
}

function decodeJwt(token: string): Record<string, unknown> | null {
  const part = token.split(".")[1];
  if (!part) return null;
  try {
    const json = decodeURIComponent(
      atob(part.replace(/-/g, "+").replace(/_/g, "/"))
        .split("")
        .map((c) => `%${`00${c.charCodeAt(0).toString(16)}`.slice(-2)}`)
        .join("")
    );
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function connectGmail(): Promise<GmailConnectResult> {
  const clientId = gmailClientId();
  if (!clientId) {
    return {
      ok: false,
      error:
        "Gmail sending needs NEXT_PUBLIC_GOOGLE_CLIENT_ID in Vercel environment variables, with this site listed as an Authorized JavaScript origin in Google Cloud. Without it there is no Google window to open, so nothing was connected.",
    };
  }

  try {
    await loadGsi();
  } catch (err: any) {
    return { ok: false, error: err?.message || "Google's sign-in library could not load." };
  }

  const oauth2 = (window as any).google?.accounts?.oauth2;
  if (!oauth2?.initTokenClient) {
    return { ok: false, error: "Google's OAuth client is unavailable in this browser session." };
  }

  return new Promise<GmailConnectResult>((resolve) => {
    let settled = false;
    const finish = (result: GmailConnectResult) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    const client = oauth2.initTokenClient({
      client_id: clientId,
      scope: `${GMAIL_SEND_SCOPE} openid email`,
      ux_mode: "popup",
      include_granted_scopes: true,
      callback: async (response: any) => {
        if (response?.error) {
          finish({
            ok: false,
            error:
              response.error_description ||
              `Google returned "${response.error}". If the app is still unverified, your account has to be added as a test user in Google Cloud.`,
          });
          return;
        }
        const accessToken = String(response?.access_token || "");
        if (!accessToken) {
          finish({ ok: false, error: "Google returned no access token, so nothing was connected." });
          return;
        }

        const claims = response?.id_token ? decodeJwt(String(response.id_token)) : null;
        let email = typeof claims?.email === "string" ? claims.email : "";
        if (!email) {
          try {
            const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            const info = await res.json();
            email = typeof info?.email === "string" ? info.email : "";
          } catch {
            email = "";
          }
        }

        const connection: GmailConnection = {
          accessToken,
          email,
          expiresAt: Date.now() + Math.max(0, Number(response?.expires_in || 3600) * 1000 - 60_000),
          scope: String(response?.scope || GMAIL_SEND_SCOPE),
          connectedAt: new Date().toISOString(),
        };
        saveGmailConnection(connection);
        finish({ ok: true, connection });
      },
    });

    try {
      client.requestAccessToken({ prompt: "consent" });
    } catch (err: any) {
      finish({ ok: false, error: err?.message || "The Google consent window could not be opened." });
    }
  });
}

export function gmailNeedsReconnect(connection: GmailConnection | null): boolean {
  return !connection || !connection.accessToken;
}
