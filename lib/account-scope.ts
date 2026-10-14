/**
 * Accounts share one browser, so every stored record is namespaced by the signed-in
 * account. The session itself and the account directory stay global - they are what
 * the namespace is derived from, so they cannot live inside it.
 *
 * Scope is set imperatively wherever the user changes, before React renders the
 * pages that read storage: a child's mount effect runs before its parent's effect,
 * so an effect here would read with the previous account still in place.
 */

export const AUTH_USER_KEY = "iwaju_auth_user_v1";
export const REGISTERED_ACCOUNTS_KEY = "iwaju_registered_accounts_v1";

const GLOBAL_KEYS = new Set([AUTH_USER_KEY, REGISTERED_ACCOUNTS_KEY]);

/** Keys that carry a record set, and therefore belong to one account only. */
export const SCOPED_DATA_KEYS = [
  "iwaju_marketing_leads_v1",
  "iwaju_marketing_activities_v1",
  "iwaju_marketing_campaigns_v1",
  "iwaju_campaign_touches_v1",
  "iwaju_consent_v1",
  "iwaju_verification_v1",
  "iwaju_hygiene_v1",
  "iwaju_signals_v1",
  "iwaju_forecast_v1",
  "iwaju_icp_config_v1",
  "iwaju_gemini_api_key",
  "iwaju_gmail_token_v1",
  "iwaju_send_policy_v1",
  "iwaju_send_ledger_v1",
  "iwaju_outbox_v1",
] as const;

let scope: string | null = null;

export function setAccountScope(userId: string | null): void {
  scope = userId && userId.trim() ? userId.trim() : null;
}

export function getAccountScope(): string | null {
  return scope;
}

export function scopeKey(key: string): string {
  if (GLOBAL_KEYS.has(key) || !scope) return key;
  return `u:${scope}:${key}`;
}

/** Reads a key for an arbitrary account scope, used only by the claim-legacy-data flow. */
export function keyForScope(key: string, userId: string | null): string {
  if (GLOBAL_KEYS.has(key) || !userId) return key;
  return `u:${userId}:${key}`;
}

export function isScoped(): boolean {
  return scope !== null;
}
