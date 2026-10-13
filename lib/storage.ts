import { Lead, ActivityItem, PipelineStage } from "@/types";
import { normaliseCompanyName } from "@/lib/address-class";
import { sampleLeadsAcrossStages } from "@/lib/lead-pool";
import { scopeKey } from "@/lib/account-scope";

const LEADS_STORAGE_KEY = "iwaju_marketing_leads_v1";
const ACTIVITIES_STORAGE_KEY = "iwaju_marketing_activities_v1";
export const LEADS_UPDATED_EVENT = "iwaju-leads-updated";


/**
 * An account with nothing stored stays empty. Seeding demo records on first read used to
 * fill a brand-new account with invented companies, which is the opposite of a clean start:
 * sample data now arrives only when you ask for it, on the board or in prospecting.
 */
export function getStoredLeads(): Lead[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(scopeKey(LEADS_STORAGE_KEY));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLeads(leads: Lead[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(scopeKey(LEADS_STORAGE_KEY), JSON.stringify(leads));
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
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(scopeKey(ACTIVITIES_STORAGE_KEY));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function logActivity(activity: ActivityItem): void {
  if (typeof window === "undefined") return;
  try {
    const current = getStoredActivities();
    const updated = [activity, ...current.slice(0, 30)]; // keep recent 30
    localStorage.setItem(scopeKey(ACTIVITIES_STORAGE_KEY), JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent("iwaju-activities-updated", { detail: updated }));
  } catch (err) {
    console.error("Failed to log activity", err);
  }
}

/**
 * Explicit demo reset: the bundled sample pool, which is labelled as sample data on every
 * record. It is no longer run automatically, so a new account opens empty.
 */
export function resetToSeedData(): void {
  if (typeof window === "undefined") return;
  const seeded = sampleLeadsAcrossStages(20);
  localStorage.setItem(scopeKey(LEADS_STORAGE_KEY), JSON.stringify(seeded));
  localStorage.removeItem(scopeKey(ACTIVITIES_STORAGE_KEY));
  window.dispatchEvent(new CustomEvent("iwaju-leads-updated", { detail: seeded }));
  window.dispatchEvent(new CustomEvent("iwaju-activities-updated", { detail: [] }));
}
