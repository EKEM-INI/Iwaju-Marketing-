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
  | "employer-only";

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
  agentStatus: "active" | "enriched" | "recheck-scheduled" | "needs-review";
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

export interface AIComposedEmail {
  provider: string;
  isLiveChatGPT: boolean;
  subject: string;
  altSubjects: string[];
  body: string;
  followUpSubject: string;
  followUpBody: string;
  hookFactUsed: string;
  estimatedReadTimeSec: number;
  confidenceScore: number;
}
