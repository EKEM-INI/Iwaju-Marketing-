import type { Lead } from "@/types";

export type IcpComponentKey =
  | "serviceFit"
  | "geography"
  | "firmographics"
  | "growthSignals"
  | "technology"
  | "relationship"
  | "evidenceQuality"
  | "dealValue";

export type IcpWeights = Record<IcpComponentKey, number>;

export const DEFAULT_WEIGHTS: IcpWeights = {
  serviceFit: 25,
  geography: 15,
  firmographics: 10,
  growthSignals: 15,
  technology: 5,
  relationship: 12,
  evidenceQuality: 22,
  dealValue: 8,
};

export const COMPONENT_LABELS: Record<IcpComponentKey, string> = {
  serviceFit: "Service fit",
  geography: "Geography",
  firmographics: "Firmographics",
  growthSignals: "Growth signals",
  technology: "Technology overlap",
  relationship: "Existing relationship",
  evidenceQuality: "Evidence quality",
  dealValue: "Deal size",
};

export interface IcpProfile {
  targetNiches: string[];
  targetCities: string[];
  minEmployees: number;
  maxEmployees: number;
  techKeywords: string[];
}

export const DEFAULT_PROFILE: IcpProfile = {
  targetNiches: ["commercial real estate", "fintech", "payment", "saas", "cloud", "hvac", "facility", "law", "legal"],
  targetCities: ["lagos", "abuja", "nigeria", "london", "austin", "san francisco", "nairobi"],
  minEmployees: 15,
  maxEmployees: 500,
  techKeywords: ["next.js", "react", "stripe", "aws", "hubspot", "salesforce", "cloudflare", "postgresql"],
};

/** Optional inputs a lead simply does not carry yet. Absence is reported, never guessed. */
export interface FitSignals {
  employees?: number;
  techStack?: string[];
  hiringPosts?: number;
  fundingEvents?: number;
}

export interface EvidenceCounts {
  verified: number;
  contradicted: number;
  unverified: number;
  noHumanContact?: boolean;
}

export interface ComponentScore {
  key: IcpComponentKey;
  label: string;
  measured: boolean;
  weight: number;
  rawScore: number;
  weighted: number;
  reason: string;
  inputs: string[];
}

export interface AccountFit {
  leadId: string;
  company: string;
  totalScore: number;
  components: ComponentScore[];
  unmeasured: IcpComponentKey[];
  confidence: number;
}

const DEAL_VALUE_CEILING: Record<string, number> = {
  NGN: 50_000_000,
  USD: 50_000,
  GBP: 40_000,
  EUR: 45_000,
};

function overlaps(needles: string[], haystack: string): number {
  if (needles.length === 0 || !haystack) return 0;
  const text = haystack.toLowerCase();
  const hits = needles.filter((n) => n && text.includes(n.toLowerCase()));
  return hits.length / needles.length;
}

function containsAny(needles: string[], value: string): boolean {
  const text = (value || "").toLowerCase();
  return needles.some((n) => n && text.includes(n.toLowerCase()));
}

function stageScore(stage: string): number {
  switch (stage) {
    case "closed":
      return 100;
    case "meeting":
      return 80;
    case "contacted":
      return 60;
    default:
      return 35;
  }
}

function recencyScore(iso?: string): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  const days = (Date.now() - t) / 86400000;
  if (days <= 14) return 100;
  if (days <= 45) return 80;
  if (days <= 120) return 55;
  return 25;
}

export function scoreAccount(
  lead: Lead,
  profile: IcpProfile = DEFAULT_PROFILE,
  weights: IcpWeights = DEFAULT_WEIGHTS,
  signals: FitSignals = {},
  evidence?: EvidenceCounts
): AccountFit {
  const tagsAndNiche = [lead.niche || "", (lead.tags || []).join(" ")].join(" ");
  const raw: Record<IcpComponentKey, { value: number | null; reason: string; inputs: string[] }> = {
    serviceFit: {
      value: profile.targetNiches.length === 0 ? null : Math.round(overlaps(profile.targetNiches, tagsAndNiche) * 100),
      reason:
        profile.targetNiches.length === 0
          ? "No target niches configured."
          : overlaps(profile.targetNiches, tagsAndNiche) > 0
            ? `Recorded niche/tags matched ${Math.round(overlaps(profile.targetNiches, tagsAndNiche) * 100)}% of your target terms.`
            : `Niche "${lead.niche || "unrecorded"}" matches none of your target terms.`,
      inputs: [`niche: ${lead.niche || "—"}`, `tags: ${(lead.tags || []).join(", ") || "—"}`],
    },
    geography: {
      value: lead.location
        ? containsAny(profile.targetCities, lead.location)
          ? 100
          : 25
        : null,
      reason: !lead.location
        ? "No location recorded."
        : containsAny(profile.targetCities, lead.location)
          ? `"${lead.location}" is inside your target geography.`
          : `"${lead.location}" is outside every target city you configured.`,
      inputs: [`location: ${lead.location || "—"}`],
    },
    firmographics: {
      value:
        typeof signals.employees === "number"
          ? signals.employees >= profile.minEmployees && signals.employees <= profile.maxEmployees
            ? 100
            : signals.employees > profile.maxEmployees
              ? 55
              : 35
          : null,
      reason:
        typeof signals.employees === "number"
          ? `Headcount ${signals.employees} against your ${profile.minEmployees}-${profile.maxEmployees} band.`
          : "No headcount on the record — the Apollo organisation endpoint does not return it in this build.",
      inputs: [`employees: ${signals.employees ?? "—"}`],
    },
    growthSignals: {
      value:
        typeof signals.hiringPosts === "number" || typeof signals.fundingEvents === "number"
          ? Math.min(100, (signals.hiringPosts || 0) * 30 + (signals.fundingEvents || 0) * 40)
          : null,
      reason:
        typeof signals.hiringPosts === "number" || typeof signals.fundingEvents === "number"
          ? `${signals.hiringPosts || 0} hiring post(s), ${signals.fundingEvents || 0} funding event(s).`
          : "Not measured — no Buying-Signal Monitor is running yet.",
      inputs: [`hiring: ${signals.hiringPosts ?? "—"} `, `funding: ${signals.fundingEvents ?? "—"}`],
    },
    technology: {
      value:
        Array.isArray(signals.techStack) && signals.techStack.length > 0
          ? Math.round(overlaps(profile.techKeywords, signals.techStack.join(" ")) * 100)
          : null,
      reason:
        Array.isArray(signals.techStack) && signals.techStack.length > 0
          ? `Detected stack overlaps ${Math.round(overlaps(profile.techKeywords, signals.techStack.join(" ")) * 100)}% with what you sell into.`
          : "Not measured — no technology detection has run.",
      inputs: [`stack: ${(signals.techStack || []).join(", ") || "—"}`],
    },
    relationship: {
      value: (() => {
        const base = stageScore(lead.stage);
        const touched = recencyScore(lead.lastContactedAt || lead.createdAt);
        const recency = touched === null ? base : Math.round((base + touched) / 2);
        return lead.contactMethod ? Math.min(100, recency + 10) : recency;
      })(),
      reason: `Stage "${lead.stage}"${lead.contactMethod ? `, already reached via ${lead.contactMethod}` : ", never reached"}, last activity ${lead.lastContactedAt ? "recorded" : "not recorded"}.`,
      inputs: [`stage: ${lead.stage}`, `contactMethod: ${lead.contactMethod || "—"}`],
    },
    evidenceQuality: {
      value: evidence
        ? (() => {
            const total = evidence.verified + evidence.contradicted + evidence.unverified;
            if (total === 0) return null;
            const base = (evidence.verified / total) * 100 - evidence.contradicted * 15;
            return Math.max(0, Math.min(100, Math.round(evidence.noHumanContact ? base * 0.5 : base)));
          })()
        : null,
      reason: evidence
        ? `${evidence.verified} verified, ${evidence.contradicted} contradicted, ${evidence.unverified} unverified check(s).${evidence.noHumanContact ? " No human contact on record — halved." : ""}`
        : "Not measured — the Contact Resolution agent has not audited this record.",
      inputs: evidence
        ? [`verified: ${evidence.verified}`, `contradicted: ${evidence.contradicted}`, `unverified: ${evidence.unverified}`]
        : ["no verification run"],
    },
    dealValue: {
      value: (() => {
        const value = Number(lead.dealValue) || 0;
        const ceiling = DEAL_VALUE_CEILING[lead.currency || "NGN"] || 50_000_000;
        if (value <= 0) return null;
        return Math.min(100, Math.round((Math.log10(value) / Math.log10(ceiling)) * 100));
      })(),
      reason:
        Number(lead.dealValue) > 0
          ? `Logged at ${lead.currency || "NGN"} ${Number(lead.dealValue).toLocaleString()} on a logarithmic scale, so deal size cannot dominate the ranking.`
          : "No deal value recorded.",
      inputs: [`dealValue: ${lead.dealValue}`, `currency: ${lead.currency || "NGN"}`],
    },
  };

  const components: ComponentScore[] = (Object.keys(raw) as IcpComponentKey[]).map((key) => {
    const entry = raw[key];
    const measured = entry.value !== null;
    return {
      key,
      label: COMPONENT_LABELS[key],
      measured,
      weight: weights[key],
      rawScore: measured ? (entry.value as number) : 0,
      weighted: measured ? (entry.value as number) * weights[key] : 0,
      reason: entry.reason,
      inputs: entry.inputs,
    };
  });

  const measuredComponents = components.filter((c) => c.measured && c.weight > 0);
  const weightSum = measuredComponents.reduce((sum, c) => sum + c.weight, 0);
  const totalScore = weightSum > 0 ? Math.round(measuredComponents.reduce((sum, c) => sum + c.weighted, 0) / weightSum) : 0;
  const unmeasured = components.filter((c) => !c.measured).map((c) => c.key);

  // How much of the configured weight actually had data behind it.
  const confidence = Math.round((weightSum / Math.max(1, components.reduce((s, c) => s + c.weight, 0))) * 100);

  return {
    leadId: String(lead.id),
    company: String(lead.company || ""),
    totalScore,
    components,
    unmeasured,
    confidence,
  };
}

export function rankAccounts(
  leads: Lead[],
  profile?: IcpProfile,
  weights?: IcpWeights,
  signalsFor?: (lead: Lead) => { signals?: FitSignals; evidence?: EvidenceCounts }
): AccountFit[] {
  return leads
    .map((lead) => {
      const extra = signalsFor ? signalsFor(lead) : {};
      return scoreAccount(lead, profile, weights, extra.signals, extra.evidence);
    })
    .sort((a, b) => b.totalScore - a.totalScore);
}
