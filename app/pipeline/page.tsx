"use client";

import React, { useState, useEffect } from "react";
import { KanbanBoard } from "@/components/pipeline/KanbanBoard";
import {
  getStoredLeads,
  updateLeadStage,
  updateLeadNotes,
  deleteLead,
} from "@/lib/storage";
import { Lead, PipelineStage } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { Kanban, Layers, TrendingUp, Sparkles, Building2, BarChart2 } from "lucide-react";
import { useToast } from "@/components/ui/Toast";

export default function PipelinePage() {
  const { showToast } = useToast();
  const [leads, setLeads] = useState<Lead[]>([]);

  useEffect(() => {
    setLeads(getStoredLeads());

    const handleUpdate = () => {
      setLeads(getStoredLeads());
    };

    window.addEventListener("iwaju-leads-updated", handleUpdate);
    return () => window.removeEventListener("iwaju-leads-updated", handleUpdate);
  }, []);

  const handleUpdateStage = (leadId: string, stage: PipelineStage) => {
    const updated = updateLeadStage(leadId, stage);
    setLeads(updated);
    showToast("Stage Updated", `Lead status changed to '${stage}'.`, "info");
  };

  const handleUpdateNotes = (leadId: string, notes: string) => {
    const updated = updateLeadNotes(leadId, notes);
    setLeads(updated);
    showToast("Notes Saved", "Lead intel and notes successfully saved.", "success");
  };

  const handleDeleteLead = (leadId: string) => {
    const updated = deleteLead(leadId);
    setLeads(updated);
    showToast("Lead Removed", "Lead successfully removed from pipeline.", "info");
  };

  const totalValue = leads.reduce((acc, l) => acc + (l.dealValue || 0), 0);
  const avgDealValue = leads.length > 0 ? Math.round(totalValue / leads.length) : 0;
  const closedCount = leads.filter((l) => l.stage === "closed").length;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase font-extrabold tracking-widest text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              Deal Progression
            </span>
            <span className="text-xs text-zinc-500">•</span>
            <span className="text-xs text-zinc-400 flex items-center gap-1">
              <Kanban className="w-3.5 h-3.5 text-emerald-400" />
              <span>High-Capacity CRM Engine</span>
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-1">
            Pipeline CRM & Deal Velocity
          </h2>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1 max-w-2xl">
            Optimized for enterprise scale with full support for 1,000+ accounts. Switch between the 4-stage visual Kanban and high-density spreadsheet view with sorting, instant search, and CSV export.
          </p>
        </div>

        {/* Aggregate KPI Summary Pills */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="px-3.5 py-2 rounded-xl bg-zinc-900/90 border border-zinc-800 text-right">
            <span className="text-[10px] uppercase font-bold text-zinc-400 block">
              Active Accounts
            </span>
            <span className="text-sm sm:text-base font-extrabold text-white font-mono flex items-center justify-end gap-1">
              <Building2 className="w-3.5 h-3.5 text-sky-400" />
              <span>{leads.length}</span>
              <span className="text-[11px] font-normal text-zinc-500">/ 1,000+ cap</span>
            </span>
          </div>

          <div className="px-3.5 py-2 rounded-xl bg-zinc-900/90 border border-zinc-800 text-right">
            <span className="text-[10px] uppercase font-bold text-zinc-400 block">
              Active Pipeline Sum
            </span>
            <span className="text-sm sm:text-base font-extrabold text-emerald-400 font-mono">
              {formatCurrency(totalValue)}
            </span>
          </div>

          <div className="hidden sm:block px-3.5 py-2 rounded-xl bg-zinc-900/90 border border-zinc-800 text-right">
            <span className="text-[10px] uppercase font-bold text-zinc-400 block">
              Avg Deal Size
            </span>
            <span className="text-xs sm:text-sm font-bold text-zinc-300 font-mono">
              {formatCurrency(avgDealValue)}
            </span>
          </div>
        </div>
      </div>

      {/* Kanban & Table Board Component */}
      <KanbanBoard
        leads={leads}
        onUpdateStage={handleUpdateStage}
        onUpdateNotes={handleUpdateNotes}
        onDeleteLead={handleDeleteLead}
      />
    </div>
  );
}
