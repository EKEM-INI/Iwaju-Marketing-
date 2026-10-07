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
