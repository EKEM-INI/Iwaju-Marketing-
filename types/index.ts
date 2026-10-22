export type PipelineStage = "new" | "contacted" | "meeting" | "closed";

export interface Lead {
  id: string;
  name: string;
  title: string;
  company: string;
  email: string;
  phone: string;
  website: string;
  niche: string;
  location: string;
  stage: PipelineStage;
  dealValue: number;
  currency: string;
  score: number; // 0 - 100
  notes: string;
  tags: string[];
  createdAt: string;
  lastContactedAt?: string;
  contactMethod?: "email" | "phone" | "linkedin";
  /** Where the record actually came from. Demo pool records can never enter a send queue. */
  sourcedFrom?: "apollo" | "google_maps" | "gemini" | "demo" | "manual";
  /** Apollo's own verdict on the address. Absent means no address was ever revealed. */
  emailStatus?: "verified" | "predicted" | "unavailable" | "not_revealed" | "unknown";
  apolloPersonId?: string;
}

export interface ActivityItem {
  id: string;
  type: "lead_discovered" | "lead_saved" | "stage_changed" | "outreach_generated" | "note_added";
  title: string;
  description: string;
  timestamp: string;
  leadId?: string;
  metadata?: Record<string, any>;
}

export interface ScrapingLog {
  id: string;
  timestamp: string;
  text: string;
  status: "info" | "success" | "warning";
}

export interface EmailTemplate {
  id: string;
  name: string;
  category: "Cold Intro" | "Value Proposition" | "Follow-up" | "Meeting Closer";
  subject: string;
  body: string;
  description: string;
}

export interface PipelineColumnDef {
  id: PipelineStage;
  title: string;
  color: string;
  badgeBg: string;
  borderCol: string;
}

export type EvidenceKind =
  | "dns.mx-record"
  | "linkedin.employer-and-name"
  | "crm.signature-block"
  | "corporate.registry"
  | "github.account-identity"
  | "web.cited-claim"
  | "search.cites-profile"
  | "handle.name-form"
  | "employer-only"
  | "chatgpt.assessment";

export type FactBand = "strong" | "weak";
export type FactStatus = "auto_applied" | "pending_approval" | "approved" | "rejected";

export interface FactItem {
  id: string;
  accountId: string;
  companyName: string;
  field: "email" | "decisionMaker" | "phone" | "techStack" | "dealValue" | "directMobile" | "employees" | "summary" | "website";
  fieldLabel: string;
  value: string;
  source: string;
  method: string;
  kind: "primary" | "supporting" | "weak";
  confidence: number;
  scoreBand: FactBand;
  status: FactStatus;
  rationale: string;
  timestamp: string;
}

export interface AutonomousAccount {
  id: string;
  name: string;
  domain: string;
  niche: string;
  location: string;
  dealValue: string;
  rawDealValue: number;
  stage: "new" | "discovery" | "demo" | "proposal" | "won";
  agentStatus: "active" | "enriched" | "recheck-scheduled" | "needs-review" | "not-audited";
  lastAction: string;
  owner: string;
  facts: {
    decisionMaker: string;
    title: string;
    email: string;
    phone: string;
    employees: string;
    techStack: string[];
    summary: string;
    funding?: string;
  };
  evidenceLedger: {
    id: string;
    source: string;
    fact: string;
    confidence: "verified" | "observed" | "weak";
    confidenceScore?: number;
    status?: FactStatus;
    timestamp: string;
  }[];
  agentNotes: string[];
  nextRecheck: string;
  recheckReason?: string;
}

export interface EvaluatedLead {
  leadId: string;
  company: string;
  rank: number;
  qualificationScore: number;
  tier: "Tier A - High Priority" | "Tier B - Medium Priority" | "Tier C - Low / Nurture";
  dealProbability: number;
  primaryPainPoint: string;
  strategicAngle: string;
  recommendedAction: string;
}

export interface AISortResult {
  provider: string;
  isLiveChatGPT: boolean;
  executiveSummary: string;
  averageScore: number;
  tierACount: number;
  totalDealValueEstimate: string;
  sortedLeads: EvaluatedLead[];
}

export interface GroundedFact {
  id: string;
  field: string;
  value: string;
  source: string;
}

export interface RefusedFact {
  id: string;
  field: string;
  reason: string;
}

export type ComposeStatus =
  | "live"
  | "no_key"
  | "provider_error"
  | "parse_error"
  | "no_approved_facts"
  | "bad_request";

export interface EmailCompliance {
  senderIdentified: boolean;
  optOutPresent: boolean;
  onlyApprovedFactsCited: boolean;
  noBracketedClaimsMissing: boolean;
  inventedNumbersDetected: boolean;
}

export interface AIComposedEmail {
  success: boolean;
  status: ComposeStatus;
  provider?: string;
  modelProvider?: "chatgpt" | "gemini";
  modelName?: string;
  isLiveModel: boolean;
  writersTried?: ("chatgpt" | "gemini")[];
  error?: string;
  tone: string;
  senderName?: string;
  senderCompany?: string;
  subject: string;
  altSubjects: string[];
  body: string;
  followUpSubject: string;
  followUpBody: string;
  approvedFacts: GroundedFact[];
  refusedFacts: RefusedFact[];
  citedFacts?: GroundedFact[];
  inventedCitations?: string[];
  inventedNumbers?: string[];
  estimatedReadTimeSec: number;
  compliance?: EmailCompliance;
  compliancePassed?: boolean;
}

export type LeadVerdictStatus = "qualified" | "needs_review" | "disqualified";

export interface LeadVerdict {
  leadId: string;
  company: string;
  status: LeadVerdictStatus;
  qualificationScore: number;
  confidence: number;
  reliableFields: string[];
  issues: string[];
  recommendedAction: string;
  rationale: string;
}

export interface AgentReport {
  headline: string;
  executiveSummary: string;
  reviewedCount: number;
  qualifiedCount: number;
  needsReviewCount: number;
  disqualifiedCount: number;
  averageScore: number;
  dataQualityFindings: string[];
  topTargets: { leadId: string; company: string; why: string }[];
  nextActions: string[];
}

/* ------------------------------------------------------------------ *
 * Trust-layer agents. Every agent answers through the same envelope so
 * the UI can show "no key" / "provider error" instead of fake results.
 * ------------------------------------------------------------------ */

export type AgentStatus =
  | "live"
  | "no_key"
  | "no_token"
  | "token_rejected"
  | "provider_error"
  | "parse_error"
  | "bad_request"
  | "empty_input";

export interface AgentEnvelope<T> {
  success: boolean;
  agent: string;
  status: AgentStatus;
  /** "google-gemini" when a model answered, "deterministic" when pure rules ran. */
  provider: string;
  live: boolean;
  ranAt: string;
  note?: string;
  error?: string;
  data?: T;
}

export type PrivacyClass = "business-contact" | "personal-contact" | "company-fact" | "unknown";

export interface ClaimSource {
  uri: string;
  title?: string;
  publishedAt?: string;
}

export interface ResolvedClaim {
  field: string;
  value: string;
  claim: string;
  state: "supported" | "contradicted" | "not_found";
  confidence: number;
  sources: ClaimSource[];
  /** Days between the newest cited source and now; null when nothing was cited. */
  freshnessDays: number | null;
  privacy: PrivacyClass;
  /** Computed by the server from real checks. A model cannot grant itself write access. */
  autoApplyAllowed: boolean;
  disposition: "write" | "stage_for_review" | "reject";
  rationale: string;
}

export interface EvidenceResearchResult {
  account: string;
  domain: string | null;
  searchQueriesRun: string[];
  claims: ResolvedClaim[];
  questionsWorthAsking: string[];
  coverage: { checked: number; supported: number; contradicted: number; notFound: number };
}

export type SignalKind =
  | "hiring"
  | "funding"
  | "expansion"
  | "technology"
  | "leadership"
  | "contract"
  | "content";

export interface BuyingSignal {
  id: string;
  kind: SignalKind;
  summary: string;
  strength: number;
  /** "cited" = a live search result backs it. "uncited" = model claim, shown but not trusted. */
  status: "cited" | "uncited";
  sourceUri: string | null;
  sourceDomain: string | null;
  observedAsOf: string | null;
  withinDays: number | null;
}

export interface SignalScanResult {
  account: string;
  domain: string | null;
  signals: BuyingSignal[];
  hiringPosts: number;
  fundingEvents: number;
  techStack: string[];
  momentumScore: number;
  citedCount: number;
  uncitedCount: number;
}

export interface AccountBrief {
  account: string;
  snapshot: string[];
  whatWeKnow: string[];
  whatIsUnproven: string[];
  whyNow: string;
  risks: string[];
  openQuestions: string[];
  callPlan: string[];
  suggestedNextStep: string;
}

export interface NextBestAction {
  leadId: string;
  company: string;
  action: string;
  why: string;
  /** What changes on the record if the rep does it — and how to undo it. */
  effect: string;
  reversible: boolean;
  effortMinutes: number;
  blockedBy: string | null;
}

export interface ReplyIntelligence {
  replyExcerpt: string;
  classification:
    | "interested"
    | "objection"
    | "question"
    | "referral"
    | "not_now"
    | "rejection"
    | "out_of_office"
    | "auto_reply"
    | "unclear";
  sentiment: "positive" | "neutral" | "negative";
  confidence: number;
  /** Short spans quoted straight out of the reply so the rep can check the reading. */
  evidenceQuotes: string[];
  objections: string[];
  commitments: string[];
  whatTheyAskedFor: string[];
  readingBetweenTheLines: string;
  suggestedReply: string | null;
  suggestedReplyFactsUsed: string[];
  followUpAdvice: string;
  suggestedStage: PipelineStage | null;
}

export interface ForecastLine {
  leadId: string;
  company: string;
  stage: PipelineStage;
  amount: number;
  currency: string;
  stageWeight: number;
  weightedAmount: number;
  riskFlags: string[];
  riskScore: number;
  nextAction: string;
}

export interface PipelineForecast {
  currency: string;
  openCount: number;
  grossPipeline: number;
  weightedForecast: number;
  coverageRatio: number | null;
  committed: number;
  bestCase: number;
  winRateAssumption: string;
  byStage: { stage: PipelineStage; label: string; count: number; gross: number; weight: number; weighted: number }[];
  byCurrency: { currency: string; count: number; gross: number; weighted: number }[];
  riskiest: ForecastLine[];
  stalled: ForecastLine[];
  assumptions: string[];
  lines: ForecastLine[];
}

/** Phone / WhatsApp / voice may only be proposed once consent is recorded. */
export interface ConsentRecord {
  leadId: string;
  channel: "phone" | "whatsapp" | "voice";
  granted: boolean;
  grantedAt: string | null;
  source: string;
  /** Personal data is not kept indefinitely; this is the review date, not a silent delete. */
  retainUntil: string | null;
}

/* ------------------------------------------------------------------ *
 * Campaigns
 * ------------------------------------------------------------------ */

export type CampaignStatus = "draft" | "active" | "paused" | "finished" | "archived";

export type CampaignChannel = "email" | "phone" | "whatsapp" | "linkedin" | "mixed";

export type CampaignStepKind = "email" | "call" | "whatsapp" | "linkedin" | "review";

/**
 * Only outcomes this app can actually establish. There is deliberately no "opened" or
 * "clicked" — nothing here can see that. "sent" means Gmail accepted the message.
 */
export type TouchOutcome =
  | "prepared"
  | "sent"
  | "handed_off"
  | "replied"
  | "no_answer"
  | "declined"
  | "unsubscribed"
  | "blocked";

export interface CampaignStep {
  id: string;
  order: number;
  kind: CampaignStepKind;
  label: string;
  intent: string;
  /** Days to wait after the previous touch before this one is due. */
  waitDays: number;
  rationale?: string;
  source: "rules" | "chatgpt";
}

export interface CampaignTouch {
  id: string;
  campaignId: string;
  leadId: string;
  stepId: string;
  stepOrder: number;
  kind: CampaignStepKind;
  outcome: TouchOutcome;
  at: string;
  note?: string;
}

export interface Campaign {
  id: string;
  name: string;
  purpose: string;
  channel: CampaignChannel;
  status: CampaignStatus;
  createdAt: string;
  updatedAt: string;
  /** When step 1 becomes due for a contact that has not been touched yet. */
  startAt: string;
  steps: CampaignStep[];
  /** Contacts live in the shared lead store; a campaign only holds references. */
  leadIds: string[];
  targetValue?: number;
  currency?: string;
  notes?: string;
}

export type ContactCampaignState =
  | "not_started"
  | "due_now"
  | "overdue"
  | "waiting"
  | "awaiting_reply"
  | "finished"
  | "stopped";

export interface CampaignProgress {
  leadId: string;
  company: string;
  name: string;
  stage: PipelineStage;
  state: ContactCampaignState;
  nextStepId: string | null;
  nextStepLabel: string;
  nextDueAt: string | null;
  overdueDays: number;
  touchCount: number;
  lastTouchAt: string | null;
  lastOutcome: TouchOutcome | null;
  terminal: boolean;
}

export interface CampaignStats {
  contacts: number;
  touched: number;
  untouched: number;
  dueNow: number;
  overdue: number;
  replied: number;
  declined: number;
  unsubscribed: number;
  blocked: number;
  /** Every ratio is recorded-touch based; `measuredFrom` says so out loud. */
  replyRate: number | null;
  stepProgress: { stepId: string; label: string; done: number; pending: number }[];
  byStage: Record<PipelineStage, number>;
  valueByCurrency: { currency: string; total: number; count: number }[];
  measuredFrom: string;
  notMeasured: string[];
}
