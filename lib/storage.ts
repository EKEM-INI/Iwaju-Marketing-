import { Lead, ActivityItem, PipelineStage } from "@/types";
import { normaliseCompanyName } from "@/lib/address-class";

const LEADS_STORAGE_KEY = "iwaju_marketing_leads_v1";
const ACTIVITIES_STORAGE_KEY = "iwaju_marketing_activities_v1";
export const LEADS_UPDATED_EVENT = "iwaju-leads-updated";

export const INITIAL_LEADS: Lead[] = [
  {
    id: "lead-seed-1",
    name: "Olumide Adeyemi",
    title: "Managing Director",
    company: "Apex Prime Realty & Landholdings",
    email: "o.adeyemi@apexprimerealty.ng",
    phone: "+234 803 491 8293",
    website: "https://www.apexprimerealty.ng",
    niche: "Real Estate Development",
    location: "Ikoyi, Lagos",
    stage: "meeting",
    dealValue: 18500000,
    currency: "NGN",
    score: 96,
    notes: "High-ticket commercial development in Eko Atlantic. Requested outbound investor syndication proposal.",
    tags: ["Real Estate", "Lagos", "High Intent"],
    createdAt: new Date(Date.now() - 3600000 * 48).toISOString(),
    lastContactedAt: new Date(Date.now() - 3600000 * 12).toISOString(),
    contactMethod: "email",
  },
  {
    id: "lead-seed-2",
    name: "Folake Balogun, SAN",
    title: "Senior Managing Partner",
    company: "Vanguard & Balogun Commercial Chambers",
    email: "folake.b@vanguardlegal.ng",
    phone: "+234 814 209 1144",
    website: "https://www.vanguardlegal.ng",
    niche: "Corporate Law",
    location: "Victoria Island, Lagos",
    stage: "contacted",
    dealValue: 12000000,
    currency: "NGN",
    score: 89,
    notes: "Followed up with corporate retainer proposal. Looking for enterprise cross-border client acquisition.",
    tags: ["Law Firms", "Lagos", "Enterprise"],
    createdAt: new Date(Date.now() - 3600000 * 72).toISOString(),
    lastContactedAt: new Date(Date.now() - 3600000 * 20).toISOString(),
    contactMethod: "email",
  },
  {
    id: "lead-seed-3",
    name: "Ini-Obong Akpan",
    title: "Chief Executive Officer",
    company: "Novus Logistics & Maritime Freight",
    email: "iniobong.a@novusmaritime.com",
    phone: "+234 806 882 4310",
    website: "https://www.novusmaritime.com",
    niche: "Freight & Maritime Logistics",
    location: "Uyo, Akwa Ibom",
    stage: "new",
    dealValue: 24000000,
    currency: "NGN",
    score: 92,
    notes: "Rapidly expanding deep seaport freight pipeline. Identified verified decision maker and email.",
    tags: ["Logistics", "Uyo", "Enterprise"],
    createdAt: new Date(Date.now() - 3600000 * 18).toISOString(),
  },
  {
    id: "lead-seed-4",
    name: "Emeka Chukwuma",
    title: "VP of Enterprise Partnerships",
    company: "Summit Capital & FinTech Advisory",
    email: "emeka.c@summitcapadvisory.com",
    phone: "+234 708 319 7502",
    website: "https://www.summitcapadvisory.com",
    niche: "FinTech & Payments",
    location: "Abuja, FCT",
    stage: "closed",
    dealValue: 35000000,
    currency: "NGN",
    score: 98,
    notes: "Contract signed! Retainer for 6-month automated B2B institutional investor pipeline in place.",
    tags: ["FinTech", "Abuja", "Closed Won"],
    createdAt: new Date(Date.now() - 3600000 * 120).toISOString(),
    lastContactedAt: new Date(Date.now() - 3600000 * 24).toISOString(),
    contactMethod: "phone",
  },
  {
    id: "lead-seed-5",
    name: "Amina Danjuma",
    title: "Chief Operating Officer",
    company: "Heritage Solar Infrastructure Ltd",
    email: "amina.danjuma@heritagesolar.ng",
    phone: "+234 818 904 6511",
    website: "https://www.heritagesolar.ng",
    niche: "Renewable Energy",
    location: "Abuja, FCT",
    stage: "contacted",
    dealValue: 15500000,
    currency: "NGN",
    score: 84,
    notes: "Sent Cold Value Proposition. Lead opened email twice. Ready for gentle follow-up sequence.",
    tags: ["CleanTech", "Abuja", "Warm"],
    createdAt: new Date(Date.now() - 3600000 * 30).toISOString(),
    lastContactedAt: new Date(Date.now() - 3600000 * 16).toISOString(),
    contactMethod: "email",
  },
  {
    id: "lead-seed-6",
    name: "Alexander Mercer",
    title: "Partner & Head of Global Origination",
    company: "Frontier Cross-Border Ventures",
    email: "alex.mercer@frontierventures.co",
    phone: "+1 (415) 892-4109",
    website: "https://www.frontierventures.co",
    niche: "Private Equity",
    location: "London & Lagos",
    stage: "meeting",
    dealValue: 30000000,
    currency: "NGN",
    score: 94,
    notes: "Demo meeting scheduled via automated Outreach Engine calendar link for Thursday 2 PM.",
    tags: ["PE / VC", "Global", "High Intent"],
    createdAt: new Date(Date.now() - 3600000 * 60).toISOString(),
    lastContactedAt: new Date(Date.now() - 3600000 * 8).toISOString(),
    contactMethod: "email",
  },
];

export const INITIAL_ACTIVITIES: ActivityItem[] = [
  {
    id: "act-1",
    type: "stage_changed",
    title: "Deal Closed: Summit Capital",
    description: "Moved to 'Closed' stage — ₦35,000,000 retainer secured.",
    timestamp: new Date(Date.now() - 3600000 * 24).toISOString(),
    leadId: "lead-seed-4",
  },
  {
    id: "act-2",
    type: "outreach_generated",
    title: "Meeting Booked with Olumide Adeyemi",
    description: "Apex Prime Realty confirmed demo for Thursday via Value Prop email.",
    timestamp: new Date(Date.now() - 3600000 * 12).toISOString(),
    leadId: "lead-seed-1",
  },
  {
    id: "act-3",
    type: "lead_discovered",
    title: "Lead Discovered: Novus Logistics",
    description: "DeepCrawler located C-Level contact for Maritime logistics in Uyo.",
    timestamp: new Date(Date.now() - 3600000 * 18).toISOString(),
    leadId: "lead-seed-3",
  },
  {
    id: "act-4",
    type: "outreach_generated",
    title: "Cold Email Sent to Folake Balogun, SAN",
    description: "Sent Value Proposition framework to Vanguard & Balogun Chambers.",
    timestamp: new Date(Date.now() - 3600000 * 20).toISOString(),
    leadId: "lead-seed-2",
  },
];

export function getStoredLeads(): Lead[] {
  if (typeof window === "undefined") {
    return INITIAL_LEADS;
  }
  try {
    const raw = localStorage.getItem(LEADS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(LEADS_STORAGE_KEY, JSON.stringify(INITIAL_LEADS));
      return INITIAL_LEADS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : INITIAL_LEADS;
  } catch {
    return INITIAL_LEADS;
  }
}

export function saveLeads(leads: Lead[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LEADS_STORAGE_KEY, JSON.stringify(leads));
    window.dispatchEvent(new CustomEvent("iwaju-leads-updated", { detail: leads }));
  } catch (err) {
    console.error("Failed to save leads to localStorage", err);
  }
}

export function saveSingleLead(lead: Lead): void {
  const current = getStoredLeads();
  const exists = current.some((l) => l.id === lead.id || (l.email === lead.email && l.company === lead.company));
  if (exists) {
    const updated = current.map((l) => (l.id === lead.id ? lead : l));
    saveLeads(updated);
  } else {
    saveLeads([lead, ...current]);
  }

  logActivity({
    id: `act-${Date.now()}`,
    type: "lead_saved",
    title: `Saved: ${lead.company}`,
    description: `Added ${lead.name} (${lead.title}) to Pipeline CRM in 'New Lead' stage.`,
    timestamp: new Date().toISOString(),
    leadId: lead.id,
  });
}

export interface UpsertResult {
  added: number;
  merged: number;
  leads: Lead[];
}

function identityKeys(lead: Lead): string[] {
  const keys: string[] = [];
  const email = (lead.email || "").trim().toLowerCase();
  const company = normaliseCompanyName(lead.company || "");
  if (email) keys.push(`email:${email}`);
  if (company) keys.push(`company:${company}`);
  return keys;
}

function fillBlanks(existing: Lead, incoming: Lead): Lead {
  const blank = (value: unknown) => value === undefined || value === null || value === "";
  const merged: Lead = { ...existing };
  if (blank(merged.name)) merged.name = incoming.name;
  if (blank(merged.title)) merged.title = incoming.title;
  if (blank(merged.email)) merged.email = incoming.email;
  if (blank(merged.phone)) merged.phone = incoming.phone;
  if (blank(merged.website)) merged.website = incoming.website;
  if (blank(merged.niche)) merged.niche = incoming.niche;
  if (blank(merged.location)) merged.location = incoming.location;
  if (blank(merged.currency)) merged.currency = incoming.currency;
  if (blank(merged.notes)) merged.notes = incoming.notes;
  if (blank(merged.createdAt)) merged.createdAt = incoming.createdAt;
  if (!merged.dealValue && incoming.dealValue) merged.dealValue = incoming.dealValue;
  if (merged.score === undefined && incoming.score !== undefined) merged.score = incoming.score;
  if ((!merged.tags || merged.tags.length === 0) && incoming.tags) merged.tags = incoming.tags;
  return merged;
}

/**
 * Merge records into the store instead of replacing it.
 *
 * Matching goes id -> email -> normalised company name, so a company that
 * arrives from prospecting, the campaign picker and the bulk seed stays one
 * record. An existing record is never rewritten field-by-field: incoming values
 * only fill fields that are still blank, because stage, notes and last-touched
 * time belong to the rep working the account, not to the next search that
 * happens to return the same company.
 */
export function upsertLeads(incoming: Lead[]): UpsertResult {
  const rebuildIndex = (rows: Lead[]) => {
    const map = new Map<string, number>();
    rows.forEach((lead, i) => {
      if (!map.has(`id:${lead.id}`)) map.set(`id:${lead.id}`, i);
      identityKeys(lead).forEach((key) => {
        if (!map.has(key)) map.set(key, i);
      });
    });
    return map;
  };

  const working = [...getStoredLeads()];
  let index = rebuildIndex(working);
  let added = 0;
  let merged = 0;

  for (const lead of incoming) {
    if (!lead || !lead.id) continue;
    let matchAt = index.get(`id:${lead.id}`);
    if (matchAt === undefined) {
      matchAt = identityKeys(lead).reduce<number | undefined>((found, key) => {
        if (found !== undefined) return found;
        return index.get(key);
      }, undefined);
    }

    if (matchAt === undefined) {
      working.unshift(lead);
      added += 1;
      index = rebuildIndex(working);
      continue;
    }

    working[matchAt] = fillBlanks(working[matchAt], lead);
    merged += 1;
  }

  if (added > 0 || merged > 0) saveLeads(working);
  return { added, merged, leads: working };
}

export function updateLeadStage(leadId: string, newStage: PipelineStage): Lead[] {
  const current = getStoredLeads();
  let targetLead: Lead | undefined;

  const updated = current.map((l) => {
    if (l.id === leadId) {
      targetLead = {
        ...l,
        stage: newStage,
        lastContactedAt: newStage !== "new" ? new Date().toISOString() : l.lastContactedAt,
      };
      return targetLead;
    }
    return l;
  });

  saveLeads(updated);

  if (targetLead) {
    const stageLabels: Record<PipelineStage, string> = {
      new: "New Lead",
      contacted: "Contacted",
      meeting: "Meeting Booked",
      closed: "Closed",
    };

    logActivity({
      id: `act-${Date.now()}`,
      type: "stage_changed",
      title: `Stage Updated: ${targetLead.company}`,
      description: `Moved ${targetLead.name} to '${stageLabels[newStage]}' stage.`,
      timestamp: new Date().toISOString(),
      leadId: targetLead.id,
    });
  }

  return updated;
}

export function updateLeadNotes(leadId: string, notes: string): Lead[] {
  const current = getStoredLeads();
  const updated = current.map((l) => (l.id === leadId ? { ...l, notes } : l));
  saveLeads(updated);
  return updated;
}

export function deleteLead(leadId: string): Lead[] {
  const current = getStoredLeads();
  const updated = current.filter((l) => l.id !== leadId);
  saveLeads(updated);
  return updated;
}

export function getStoredActivities(): ActivityItem[] {
  if (typeof window === "undefined") {
    return INITIAL_ACTIVITIES;
  }
  try {
    const raw = localStorage.getItem(ACTIVITIES_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(ACTIVITIES_STORAGE_KEY, JSON.stringify(INITIAL_ACTIVITIES));
      return INITIAL_ACTIVITIES;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : INITIAL_ACTIVITIES;
  } catch {
    return INITIAL_ACTIVITIES;
  }
}

export function logActivity(activity: ActivityItem): void {
  if (typeof window === "undefined") return;
  try {
    const current = getStoredActivities();
    const updated = [activity, ...current.slice(0, 30)]; // keep recent 30
    localStorage.setItem(ACTIVITIES_STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent("iwaju-activities-updated", { detail: updated }));
  } catch (err) {
    console.error("Failed to log activity", err);
  }
}

export function resetToSeedData(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(LEADS_STORAGE_KEY, JSON.stringify(INITIAL_LEADS));
  localStorage.setItem(ACTIVITIES_STORAGE_KEY, JSON.stringify(INITIAL_ACTIVITIES));
  window.dispatchEvent(new CustomEvent("iwaju-leads-updated", { detail: INITIAL_LEADS }));
  window.dispatchEvent(new CustomEvent("iwaju-activities-updated", { detail: INITIAL_ACTIVITIES }));
}
