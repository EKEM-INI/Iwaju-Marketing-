"use client";

import React, { useMemo, useState } from "react";
import type { Lead, PipelineStage } from "@/types";
import { upsertLeads } from "@/lib/storage";
import { emailDomain, isRoleAddress } from "@/lib/address-class";
import { Search, UserPlus, X } from "lucide-react";

interface ContactPickerProps {
  leads: Lead[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  /** Where a brand-new contact should come in. Campaigns always save to the CRM. */
  onLeadsSaved: (leads: Lead[]) => void;
}

const STAGES: PipelineStage[] = ["new", "contacted", "meeting", "closed"];

/**
 * Picks contacts out of the shared CRM store and can add a missing one.
 * A new contact is written through upsertLeads, so it appears on the pipeline
 * board and in the outreach generator straight away instead of living only here.
 */
export function ContactPicker({ leads, selectedIds, onChange, onLeadsSaved }: ContactPickerProps) {
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ name: "", title: "", company: "", email: "", phone: "", website: "", niche: "", location: "" });
  const [addError, setAddError] = useState<string | null>(null);

  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return leads;
    return leads.filter((l) =>
      [l.company, l.name, l.niche, l.location, l.email].some((field) => (field || "").toLowerCase().includes(q))
    );
  }, [leads, query]);

  const toggle = (id: string) => {
    onChange(selected.has(id) ? selectedIds.filter((s) => s !== id) : [...selectedIds, id]);
  };

  const submitNew = () => {
    const company = draft.company.trim();
    if (!company) {
      setAddError("A company name is required - that is how the record is matched everywhere else.");
      return;
    }
    const email = draft.email.trim().toLowerCase();
    if (email && !email.includes("@")) {
      setAddError("That email address is not usable. Leave it blank rather than guess.");
      return;
    }
    const duplicate = leads.find(
      (l) =>
        (email && l.email?.toLowerCase() === email) ||
        l.company?.trim().toLowerCase() === company.toLowerCase()
    );
    if (duplicate) {
      setAddError(`"${duplicate.company}" is already in the CRM. Search for it above and tick it instead of adding a second copy.`);
      return;
    }

    const lead: Lead = {
      id: `manual-${Date.now().toString(36)}`,
      name: draft.name.trim(),
      title: draft.title.trim(),
      company,
      email,
      phone: draft.phone.trim(),
      website: draft.website.trim(),
      niche: draft.niche.trim(),
      location: draft.location.trim(),
      stage: "new",
      dealValue: 0,
      currency: "NGN",
      score: 0,
      notes: "Added by hand from a campaign. Nothing on this record has been verified.",
      tags: ["Manual Entry"],
      createdAt: new Date().toISOString(),
    };

    const result = upsertLeads([lead]);
    onLeadsSaved(result.leads);
    onChange([...selectedIds, lead.id]);
    setDraft({ name: "", title: "", company: "", email: "", phone: "", website: "", niche: "", location: "" });
    setAdding(false);
    setAddError(null);
  };

  const input = "w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50";

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search the CRM by company, person, sector or location"
            className={`${input} pl-9`}
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500">{selectedIds.length} selected</span>
          <button
            type="button"
            onClick={() => setAdding((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold border border-zinc-700"
          >
            {adding ? <X className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5 text-emerald-400" />}
            <span>{adding ? "Cancel" : "Add a contact"}</span>
          </button>
        </div>
      </div>

      {adding && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.03] p-4 space-y-3">
          <p className="text-xs text-zinc-400">
            This writes into the same CRM list the pipeline board reads. It is not a campaign-only contact.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input className={input} placeholder="Person's name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            <input className={input} placeholder="Job title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            <input className={input} placeholder="Company *" value={draft.company} onChange={(e) => setDraft({ ...draft, company: e.target.value })} />
            <input className={input} placeholder="Email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
            <input className={input} placeholder="Phone" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
            <input className={input} placeholder="Website" value={draft.website} onChange={(e) => setDraft({ ...draft, website: e.target.value })} />
            <input className={input} placeholder="Sector" value={draft.niche} onChange={(e) => setDraft({ ...draft, niche: e.target.value })} />
            <input className={input} placeholder="Location" value={draft.location} onChange={(e) => setDraft({ ...draft, location: e.target.value })} />
          </div>
          {draft.email && !isRoleAddress(draft.email) && (
            <p className="text-[11px] text-zinc-500">
              Mailbox domain: {emailDomain(draft.email) || "unreadable"}.
              {draft.website && !draft.website.toLowerCase().includes(emailDomain(draft.email) || "___") && (
                <span className="text-amber-400"> It does not match the website domain you entered.</span>
              )}
            </p>
          )}
          {addError && <p className="text-[11px] text-amber-400">{addError}</p>}
          <button
            type="button"
            onClick={submitNew}
            className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
          >
            Save contact to the CRM and add it here
          </button>
        </div>
      )}

      <div className="max-h-72 overflow-y-auto rounded-xl border border-zinc-800 divide-y divide-zinc-800/70">
        {filtered.length === 0 && (
          <p className="p-4 text-xs text-zinc-500">
            {leads.length === 0
              ? "The CRM is empty. Source leads in Prospecting or add one above."
              : "No stored contact matches that search."}
          </p>
        )}
        {filtered.map((lead) => {
          const checked = selected.has(lead.id);
          return (
            <button
              key={lead.id}
              type="button"
              onClick={() => toggle(lead.id)}
              className={`w-full text-left px-3 py-2.5 flex items-center gap-3 transition-colors ${
                checked ? "bg-emerald-500/[0.07]" : "hover:bg-zinc-800/40"
              }`}
            >
              <span
                className={`w-4 h-4 shrink-0 rounded border flex items-center justify-center text-[10px] ${
                  checked ? "bg-emerald-500 border-emerald-500 text-zinc-950" : "border-zinc-700 text-transparent"
                }`}
              >
                ✓
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-semibold text-zinc-100 truncate">{lead.company}</span>
                <span className="block text-[11px] text-zinc-500 truncate">
                  {lead.name || "no person"} {lead.title ? `· ${lead.title}` : ""} · {lead.email || "no email"}
                </span>
              </span>
              <span className="shrink-0 text-[10px] uppercase tracking-wide px-2 py-0.5 rounded border border-zinc-700 text-zinc-400">
                {STAGES.includes(lead.stage) ? lead.stage : "new"}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
