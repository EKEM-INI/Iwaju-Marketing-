"use client";

import React, { useState } from "react";
import { Lead, PipelineStage } from "@/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import { LeadScoreBadge, StageBadge } from "@/components/ui/Badge";
import {
  X,
  Building2,
  Mail,
  Phone,
  Globe,
  Calendar,
  Send,
  Save,
  Trash2,
  ExternalLink,
  ShieldCheck,
  User,
  Tag,
} from "lucide-react";
import Link from "next/link";

interface LeadDetailModalProps {
  lead: Lead | null;
  onClose: () => void;
  onUpdateStage: (leadId: string, stage: PipelineStage) => void;
  onUpdateNotes: (leadId: string, notes: string) => void;
  onDeleteLead: (leadId: string) => void;
}

const STAGES: { id: PipelineStage; label: string }[] = [
  { id: "new", label: "New Lead" },
  { id: "contacted", label: "Contacted" },
  { id: "meeting", label: "Meeting Booked" },
  { id: "closed", label: "Closed Won" },
];

export function LeadDetailModal({
  lead,
  onClose,
  onUpdateStage,
  onUpdateNotes,
  onDeleteLead,
}: LeadDetailModalProps) {
  if (!lead) return null;

  const [notes, setNotes] = useState(lead.notes || "");
  const [isSaved, setIsSaved] = useState(false);

  const handleSaveNotes = () => {
    onUpdateNotes(lead.id, notes);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handleDelete = () => {
    if (confirm(`Remove ${lead.company} from your pipeline?`)) {
      onDeleteLead(lead.id);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 bg-slate-900/60 flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <span>{lead.company}</span>
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
              </h3>
              <LeadScoreBadge score={lead.score} />
            </div>
            <p className="text-xs text-slate-400 flex items-center gap-2">
              <span>{lead.niche}</span>
              <span>•</span>
              <span>{lead.location}</span>
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1 scrollbar-thin">
          {/* Stage Selector Bar */}
          <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">
              Current Pipeline Stage
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {STAGES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => onUpdateStage(lead.id, s.id)}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold border transition-all ${
                    lead.stage === s.id
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-glow"
                      : "bg-slate-950/80 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Contact & Decision Maker Card */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-emerald-400" />
                <span>Primary Decision Maker</span>
              </span>
              <div>
                <p className="text-sm font-bold text-white">{lead.name}</p>
                <p className="text-xs text-emerald-400 font-medium">{lead.title}</p>
              </div>
              <div className="pt-2 border-t border-slate-800/80 space-y-1.5 text-xs text-slate-300 font-mono">
                <a
                  href={`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(lead.email)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 truncate hover:text-emerald-400 transition-colors group"
                  title="Click to open compose in Gmail"
                >
                  <Mail className="w-3.5 h-3.5 text-slate-500 group-hover:text-emerald-400" />
                  <span className="truncate underline decoration-slate-700 underline-offset-2">{lead.email}</span>
                  <ExternalLink className="w-3 h-3 text-slate-500 ml-auto shrink-0" />
                </a>
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-slate-500" />
                  <span>{lead.phone}</span>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Deal & Commercial Scope</span>
              </span>
              <div>
                <p className="text-[11px] text-slate-400">Estimated Value:</p>
                <p className="text-lg font-bold font-mono text-emerald-400">
                  {formatCurrency(lead.dealValue, lead.currency)}
                </p>
              </div>
              <div className="pt-2 border-t border-slate-800/80 space-y-1.5 text-xs">
                <a
                  href={lead.website}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 text-slate-300 hover:text-emerald-400 transition-colors"
                >
                  <Globe className="w-3.5 h-3.5 text-slate-500" />
                  <span className="truncate">{lead.website}</span>
                  <ExternalLink className="w-3 h-3 ml-auto" />
                </a>
                <div className="flex items-center gap-1 text-[11px] text-slate-400">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  <span>Added {formatDate(lead.createdAt)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Notes Editor */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Lead Intelligence & Meeting Notes
              </label>
              {isSaved && (
                <span className="text-xs text-emerald-400 font-medium">Notes Saved!</span>
              )}
            </div>
            <textarea
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add key insights, objections, meeting notes or pipeline context..."
              className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3.5 text-xs sm:text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-sans"
            />
            <div className="flex justify-end">
              <button
                onClick={handleSaveNotes}
                className="inline-flex items-center gap-1.5 py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors"
              >
                <Save className="w-3.5 h-3.5 text-emerald-400" />
                <span>Save Notes</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-6 border-t border-slate-800 bg-slate-900/60 flex items-center justify-between gap-3">
          <button
            onClick={handleDelete}
            className="inline-flex items-center gap-1.5 py-2 px-3 text-xs text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors border border-rose-500/20"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Remove Lead</span>
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="py-2 px-4 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors"
            >
              Close
            </button>

            <Link
              href={`/outreach?leadId=${encodeURIComponent(lead.id)}`}
              onClick={onClose}
              className="inline-flex items-center gap-2 py-2 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-glow transition-all"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Launch Outreach Engine</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
