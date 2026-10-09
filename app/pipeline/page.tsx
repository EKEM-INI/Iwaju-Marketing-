"use client";

import React, { useState, useEffect } from "react";
import { KanbanBoard } from "@/components/pipeline/KanbanBoard";
import {
  getStoredLeads,
  updateLeadStage,
  updateLeadNotes,
  deleteLead,
} from "@/lib/storage";
import { Lead, PipelineStage, AISortResult } from "@/types";
import { Bot, Check, X, RefreshCw, Send } from "lucide-react";
import { saveLeads } from "@/lib/storage";
import { formatCurrency } from "@/lib/utils";
import { Kanban, Layers, TrendingUp, Sparkles, Building2, BarChart2 } from "lucide-react";
import { useToast } from "@/components/ui/Toast";

export default function PipelinePage() {
  const [isAiSortingOpen, setIsAiSortingOpen] = useState(false);
  const [isAiSortingLoading, setIsAiSortingLoading] = useState(false);
  const [aiSortResult, setAiSortResult] = useState<AISortResult | null>(null);

  const handleOpenAiSort = async () => {
    setIsAiSortingOpen(true);
    setIsAiSortingLoading(true);
    try {
      const stored = getStoredLeads();
      const res = await fetch("/api/leads/ai-sort", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leads: stored, sortBy: "deal_potential" }),
      });
      const data = await res.json();
      if (data && data.sortedLeads) {
        setAiSortResult(data);
      }
    } catch (err) {
      console.warn("AI sort error", err);
    } finally {
      setIsAiSortingLoading(false);
    }
  };

  const handleApplyAiSort = () => {
    if (!aiSortResult || !aiSortResult.sortedLeads) return;
    const rankMap = new Map(aiSortResult.sortedLeads.map((s) => [s.leadId, s.rank]));
    const reordered = [...leads].sort((a, b) => {
      const rankA = rankMap.get(a.id) ?? 999;
      const rankB = rankMap.get(b.id) ?? 999;
      return rankA - rankB;
    });
    setLeads(reordered);
    saveLeads(reordered);
    showToast("ChatGPT Brain Applied", "Pipeline re-sorted by commercial deal velocity.", "success");
    setIsAiSortingOpen(false);
  };
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
          <button
            onClick={handleOpenAiSort}
            disabled={isAiSortingLoading}
            className="px-3.5 py-2 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 border border-emerald-500/40 text-white text-xs font-semibold flex items-center gap-2 cursor-pointer transition-colors shadow-lg"
          >
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span>{isAiSortingLoading ? "ChatGPT Analyzing..." : "Sort with ChatGPT Brain"}</span>
          </button>
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
    
      {/* AI Sort Modal */}
      {isAiSortingOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-3xl max-h-[90vh] bg-[#09090b] border border-[#27272a] rounded-2xl flex flex-col overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-[#27272a] flex items-center justify-between bg-[#0d0d10]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white">ChatGPT Lead Sorting & Intelligence</h3>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-950/60 text-emerald-400 border border-emerald-500/30">
                      {aiSortResult?.provider || "ChatGPT Brain"}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 font-mono mt-0.5">
                    Commercial qualification, pain point discovery, and pipeline triage
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAiSortingOpen(false)}
                className="p-1 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 flex-1 overflow-y-auto space-y-4 font-mono text-xs">
              {isAiSortingLoading ? (
                <div className="py-16 text-center space-y-3 font-mono">
                  <RefreshCw className="w-6 h-6 text-emerald-400 animate-spin mx-auto" />
                  <p className="text-sm text-white font-sans font-semibold">
                    ChatGPT Brain is reviewing and ranking your leads...
                  </p>
                  <p className="text-xs text-zinc-500">
                    Evaluating deal probability, verified contacts, and urgent pain points.
                  </p>
                </div>
              ) : aiSortResult ? (
                <>
                  <div className="p-4 rounded-xl bg-[#121215] border border-emerald-500/30 space-y-2">
                    <div className="flex items-center gap-2 text-emerald-400 font-bold uppercase text-[10px] tracking-wider">
                      <Bot className="w-3.5 h-3.5" />
                      <span>AI Executive Summary</span>
                    </div>
                    <p className="text-zinc-200 text-xs leading-relaxed font-sans">
                      {aiSortResult.executiveSummary}
                    </p>
                    <div className="pt-2 border-t border-zinc-800 flex flex-wrap items-center gap-4 text-[11px] text-zinc-400">
                      <span>Avg Qualification: <strong className="text-white">{aiSortResult.averageScore}/100</strong></span>
                      <span>Tier A: <strong className="text-emerald-400">{aiSortResult.tierACount}</strong></span>
                      <span>Pipeline Potential: <strong className="text-emerald-400">{aiSortResult.totalDealValueEstimate}</strong></span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] uppercase tracking-wider text-zinc-400 font-semibold">
                      Ranked Pipeline Order ({aiSortResult.sortedLeads.length})
                    </span>
                    <button
                      onClick={handleApplyAiSort}
                      className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-xs flex items-center gap-1.5 cursor-pointer font-sans"
                    >
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                      <span>Re-Sort Pipeline</span>
                    </button>
                  </div>

                  <div className="space-y-2.5">
                    {aiSortResult.sortedLeads.map((item) => (
                      <div
                        key={item.leadId}
                        className="p-3.5 rounded-xl bg-[#0d0d10] border border-[#27272a] hover:border-zinc-700 transition-colors space-y-2 font-sans"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-md bg-[#181820] text-emerald-400 text-xs font-mono font-bold flex items-center justify-center border border-zinc-800">
                              #{item.rank}
                            </span>
                            <span className="text-sm font-semibold text-white">
                              {item.company}
                            </span>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-mono font-semibold ${
                              item.tier.startsWith("Tier A")
                                ? "bg-emerald-950/70 text-emerald-400 border border-emerald-500/30"
                                : item.tier.startsWith("Tier B")
                                ? "bg-sky-950/70 text-sky-400 border border-sky-500/30"
                                : "bg-zinc-800 text-zinc-400 border border-zinc-700"
                            }`}
                          >
                            {item.tier}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                          <div className="p-2.5 rounded-lg bg-black/50 border border-zinc-800 space-y-1">
                            <span className="text-[10px] font-mono uppercase text-zinc-500">Urgent Pain Point</span>
                            <p className="text-zinc-300 text-[11px] leading-relaxed italic">
                              "{item.primaryPainPoint}"
                            </p>
                          </div>
                          <div className="p-2.5 rounded-lg bg-black/50 border border-zinc-800 space-y-1">
                            <span className="text-[10px] font-mono uppercase text-zinc-500">Recommended Action</span>
                            <p className="text-emerald-300 text-[11px] leading-relaxed font-mono">
                              {item.recommendedAction}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between pt-1 text-[11px] font-mono text-zinc-400">
                          <span>Qualification: <strong className="text-white">{item.qualificationScore}/100</strong></span>
                          <span>Deal Probability: <strong className="text-emerald-400">{Math.round(item.dealProbability * 100)}%</strong></span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}