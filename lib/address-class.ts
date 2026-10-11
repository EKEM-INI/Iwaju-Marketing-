// Pure, dependency-free address and company-name classification.
// Kept separate from lib/verification.ts so client components can use it
// without pulling `node:dns` into the browser bundle.

const FREE_MAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.co.uk",
  "ymail.com",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "msn.com",
  "aol.com",
  "icloud.com",
  "me.com",
  "protonmail.com",
  "proton.me",
  "mail.ru",
  "yandex.com",
  "gmx.com",
  "mail.com",
  "gmx.net",
]);

const ROLE_LOCAL_PARTS = new Set([
  "info",
  "sales",
  "support",
  "contact",
  "hello",
  "admin",
  "office",
  "enquiries",
  "inquiries",
  "careers",
  "jobs",
  "press",
  "media",
  "marketing",
  "billing",
  "accounts",
  "service",
  "team",
  "general",
  "mail",
  "postmaster",
  "noreply",
  "no-reply",
]);

// Known placeholders minted by earlier versions of the Apollo route, plus generic
// all-zero shapes. A number in this list was never sourced from anything.
const PLACEHOLDER_PHONES = [
  "+234 800 000 0000",
  "+234 8000000000",
  "+1 (415) 500-0000",
  "+14155000000",
  "0000000000",
  "+234 000 000 0000",
];

const MULTI_LEVEL_SUFFIXES = [
  "co.ng",
  "com.ng",
  "net.ng",
  "org.ng",
  "co.uk",
  "org.uk",
  "co.ke",
  "co.za",
  "com.gh",
  "com.au",
  "co.nz",
  "com.br",
  "com.cn",
  "co.in",
];

export function normaliseCompanyName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[.,&]/g, " ")
    .replace(/\b(ltd|limited|inc|llc|plc|ng|ltda|llp|and sons|holdings|group)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripScheme(url: string): string {
  return url
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split(/[/?#]/)[0]
    .trim();
}

/** True when the person field is really the account name, i.e. there is no human on the record. */
export function nameDuplicatesCompany(name: string, company: string): boolean {
  const n = normaliseCompanyName(name || "");
  const c = normaliseCompanyName(company || "");
  if (!n || !c) return false;
  return n === c || n.startsWith(c);
}

export function registrableDomain(host: string): string {
  const clean = stripScheme(host);
  const labels = clean.split(".").filter(Boolean);
  if (labels.length < 2) return clean;
  const lastTwo = labels.slice(-2).join(".");
  if (labels.length >= 3 && MULTI_LEVEL_SUFFIXES.includes(lastTwo)) {
    return labels.slice(-3).join(".");
  }
  return lastTwo;
}

export function emailDomain(email: string): string {
  const at = email.lastIndexOf("@");
  return at === -1 ? "" : email.slice(at + 1).toLowerCase().trim();
}

export function emailLocalPart(email: string): string {
  const at = email.lastIndexOf("@");
  return at === -1 ? email.toLowerCase().trim() : email.slice(0, at).toLowerCase().trim();
}

export function isFreeMailDomain(domain: string): boolean {
  return FREE_MAIL_DOMAINS.has(registrableDomain(domain));
}

export function isRoleAddress(email: string): boolean {
  const local = emailLocalPart(email).split(/[.+_-]/)[0];
  return ROLE_LOCAL_PARTS.has(local);
}

export function looksLikePhoneNumber(phone: string): boolean {
  const digits = phone.replace(/[^\d]/g, "");
  return digits.length >= 7 && digits.length <= 15;
}

export function isPlaceholderPhone(phone: string): boolean {
  const digits = phone.replace(/[^\d]/g, "");
  if (PLACEHOLDER_PHONES.some((p) => p.replace(/[^\d]/g, "") === digits)) return true;
  // A number that is mostly zeros was not sourced from anywhere.
  const significant = digits.replace(/0/g, "").length;
  return digits.length > 0 && significant <= 2;
}

/** True when the value is nothing but digits and phone punctuation, i.e. a reachable number. */
export function looksLikePhoneValue(value: string): boolean {
  const digits = value.replace(/[^\d]/g, "");
  const leftover = value.replace(/\d/g, "").replace(/[\s()+.-]/g, "");
  return digits.length >= 9 && digits.length <= 15 && leftover.length === 0;
}
