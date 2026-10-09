"use client";

import React, { useState } from "react";
import { Lead, PipelineStage, PipelineColumnDef } from "@/types";
import { KanbanColumn } from "@/components/pipeline/KanbanColumn";
import { PipelineTableView } from "@/components/pipeline/PipelineTableView";
import { LeadDetailModal } from "@/components/pipeline/LeadDetailModal";
import {
  Search,
  Plus,
  Kanban as KanbanIcon,
  Table as TableIcon,
  Sparkles,
  Layers,
  Download,
} from "lucide-react";
import Link from "next/link";
import { generateMockLeads } from "@/lib/mock-scraper";
import { saveLeads, getStoredLeads } from "@/lib/storage";
import { useToast } from "@/components/ui/Toast";

interface KanbanBoardProps {
  leads: Lead[];
  onUpdateStage: (leadId: string, stage: PipelineStage) => void;
  onUpdateNotes: (leadId: string, notes: string) => void;
  onDeleteLead: (leadId: string) => void;
  onRefreshLeads?: () => void;
}

const COLUMNS: PipelineColumnDef[] = [
  {
    id: "new",
    title: "New Leads",
    color: "bg-sky-500",
    badgeBg: "bg-sky-500/10 text-sky-400",
    borderCol: "border-t-sky-500",
  },
  {
    id: "contacted",
    title: "Contacted",
    color: "bg-amber-500",
    badgeBg: "bg-amber-500/10 text-amber-400",
    borderCol: "border-t-amber-500",
  },
  {
    id: "meeting",
    title: "Meeting Booked",
    color: "bg-purple-500",
    badgeBg: "bg-purple-500/10 text-purple-400",
    borderCol: "border-t-purple-500",
  },
  {
    id: "closed",
    title: "Closed Won",
    color: "bg-emerald-500",
    badgeBg: "bg-emerald-500/10 text-emerald-400",
    borderCol: "border-t-emerald-500",
  },
];

export function KanbanBoard({
  leads,
  onUpdateStage,
  onUpdateNotes,
  onDeleteLead,
}: KanbanBoardProps) {
  const { showToast } = useToast();
  const [viewMode, setViewMode] = useState<"kanban" | "table">("kanban");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);

  const filteredLeads = leads.filter((lead) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      lead.company.toLowerCase().includes(q) ||
      lead.name.toLowerCase().includes(q) ||
      lead.niche.toLowerCase().includes(q) ||
      lead.location.toLowerCase().includes(q)
    );
  });

  /**
   * Bulk Seed generator:
   * Enables the user/client to inject 50 high-value leads into the CRM
   * to immediately test high-capacity scaling up to 1,000+ accounts.
   */
  const handleBulkSeed = (count: number = 50) => {
    setIsSeeding(true);
    const niches = [
      "Real Estate Development",
      "Corporate Commercial Law",
      "Maritime & Deep Sea Freight",
      "FinTech & Payments",
      "Private Secondary Schools",
      "Hospitality & Luxury Resorts",
    ];
    const locations = ["Lagos", "Abuja", "Uyo", "Port Harcourt", "London"];

    const newBatch: Lead[] = [];
    const stages: PipelineStage[] = ["new", "contacted", "meeting", "closed"];

    for (let i = 0; i < count; i++) {
      const selectedNiche = niches[i % niches.length];
      const selectedLoc = locations[i % locations.length];
      const lead = generateMockLeads(selectedNiche, selectedLoc, 1)[0];
      lead.stage = stages[i % stages.length];
      newBatch.push(lead);
    }

    const current = getStoredLeads();
    saveLeads([...newBatch, ...current]);
    setIsSeeding(false);

    showToast(
      "High-Volume Seed Complete",
      `Injected ${count} enterprise accounts into CRM. Total active: ${current.length + count} accounts.`,
      "success"
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Controls: View Switcher, Search & Volume Injection */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-2xl bg-zinc-900/70 border border-zinc-800">
        {/* Left: View Mode Toggle */}
        <div className="flex items-center gap-2 bg-zinc-950 p-1 rounded-xl border border-zinc-800">
          <button
            onClick={() => setViewMode("kanban")}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              viewMode === "kanban"
                ? "bg-zinc-800 text-white shadow-glow"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <KanbanIcon className="w-3.5 h-3.5" />
            <span>Kanban Board</span>
          </button>
          <button
            onClick={() => setViewMode("table")}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              viewMode === "table"
                ? "bg-zinc-800 text-white shadow-glow"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <TableIcon className="w-3.5 h-3.5" />
            <span>High-Density Table (1,000+)</span>
          </button>
        </div>

        {/* Center: Search (Kanban mode) */}
        {viewMode === "kanban" && (
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -tranzinc-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search across all pipeline stages..."
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
            />
          </div>
        )}

        {/* Right: Actions */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => handleBulkSeed(50)}
            disabled={isSeeding}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold border border-zinc-700 transition-colors"
            title="Inject 50 sample leads to test high-volume scaling"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>+ Add 50 Sample Accounts</span>
          </button>

          <Link
            href="/prospecting"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-primary-foreground font-medium text-xs shadow-glow transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Prospect Leads</span>
          </Link>
        </div>
      </div>

      {/* Main View: Kanban or High-Density Table */}
      {viewMode === "kanban" ? (
        <div className="flex gap-5 overflow-x-auto pb-4 scrollbar-thin">
          {COLUMNS.map((col) => {
            const colLeads = filteredLeads.filter((l) => l.stage === col.id);
            return (
              <KanbanColumn
                key={col.id}
                column={col}
                leads={colLeads}
                onSelectLead={(lead) => setSelectedLead(lead)}
                onMoveStage={onUpdateStage}
              />
            );
          })}
        </div>
      ) : (
        <PipelineTableView
          leads={leads}
          onSelectLead={(lead) => setSelectedLead(lead)}
          onUpdateStage={onUpdateStage}
          onDeleteLead={onDeleteLead}
        />
      )}

      {/* Lead Detail Modal */}
      {selectedLead && (
        <LeadDetailModal
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onUpdateStage={(id, stage) => {
            onUpdateStage(id, stage);
            setSelectedLead((prev) => (prev ? { ...prev, stage } : null));
          }}
          onUpdateNotes={(id, notes) => {
            onUpdateNotes(id, notes);
            setSelectedLead((prev) => (prev ? { ...prev, notes } : null));
          }}
          onDeleteLead={onDeleteLead}
        />
      )}
    </div>
  );
}
