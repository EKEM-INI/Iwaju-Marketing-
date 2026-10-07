"use client";

import React, { useState } from "react";
import { Lead } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { LeadScoreBadge } from "@/components/ui/Badge";
import {
  Building2,
  Mail,
  Phone,
  Globe,
  Plus,
  Check,
  CheckCheck,
  Send,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";

interface DiscoveredLeadsListProps {
  leads: Lead[];
  onSaveLead: (lead: Lead) => void;
  onSaveAll: (leads: Lead[]) => void;
  savedLeadIds: Set<string>;
}

export function DiscoveredLeadsList({
  leads,
  onSaveLead,
  onSaveAll,
  savedLeadIds,
}: DiscoveredLeadsListProps) {
  if (leads.length === 0) {
    return null;
  }

  const allSaved = leads.every((l) => savedLeadIds.has(l.id));

  return (
    <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-6 backdrop-blur-md space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-white">
              Discovered High-Intent Accounts
            </h3>
            <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
              {leads.length} Verified
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Decision makers extracted with 100% verified SMTP/MX endpoints and commercial intent scoring.
          </p>
        </div>

        <button
          onClick={() => onSaveAll(leads)}
          disabled={allSaved}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            allSaved
              ? "bg-slate-800 text-slate-400 border border-slate-700 cursor-default"
              : "bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-glow"
          }`}
        >
          {allSaved ? (
            <>
              <CheckCheck className="w-4 h-4 text-emerald-400" />
              <span>All Saved to Pipeline</span>
            </>
          ) : (
            <>
              <Plus className="w-4 h-4" />
              <span>Save All to Pipeline</span>
            </>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {leads.map((lead) => {
          const isSaved = savedLeadIds.has(lead.id);

          return (
            <div
              key={lead.id}
              className={`rounded-xl border p-5 transition-all flex flex-col justify-between ${
                isSaved
                  ? "bg-slate-950/40 border-emerald-500/40"
                  : "bg-slate-950/70 border-slate-800 hover:border-slate-700"
              }`}
            >
              <div className="space-y-3">
                {/* Header: Company & Score */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-base font-bold text-white truncate">
                        {lead.company}
                      </h4>
                      <span title="100% Verified Decision Maker">
                        <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                      <span>{lead.niche}</span>
                      <span>•</span>
                      <span>{lead.location}</span>
                    </p>
                  </div>
                  <LeadScoreBadge score={lead.score} />
                </div>

                {/* Contact Person */}
                <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800/80 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-200">{lead.name}</span>
                    <span className="text-[11px] text-emerald-400 font-medium">
                      {lead.title}
                    </span>
                  </div>

                  <div className="flex flex-col gap-1 text-slate-400 font-mono text-[11px]">
                    <div className="flex items-center gap-2 truncate">
                      <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="truncate">{lead.email}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span>{lead.phone}</span>
                    </div>
                  </div>
                </div>

                {/* Est Deal Size & Website */}
                <div className="flex items-center justify-between text-xs pt-1">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">
                      Est. Contract Value
                    </span>
                    <span className="font-mono font-bold text-emerald-400">
                      {formatCurrency(lead.dealValue, lead.currency)}
                    </span>
                  </div>

                  <a
                    href={lead.website}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-emerald-400 transition-colors"
                  >
                    <Globe className="w-3 h-3" />
                    <span>Domain Link</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-4 mt-4 border-t border-slate-800/80">
                <button
                  onClick={() => onSaveLead(lead)}
                  disabled={isSaved}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                    isSaved
                      ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 cursor-default"
                      : "bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold shadow-glow"
                  }`}
                >
                  {isSaved ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Saved to Pipeline</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      <span>Save to Pipeline</span>
                    </>
                  )}
                </button>

                <Link
                  href={`/outreach?leadId=${encodeURIComponent(lead.id)}`}
                  className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                  title="Generate personalized cold email"
                >
                  <Send className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Outreach</span>
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
