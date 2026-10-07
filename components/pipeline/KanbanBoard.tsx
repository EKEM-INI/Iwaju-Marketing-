"use client";

import React, { useState } from "react";
import { Lead, PipelineStage, PipelineColumnDef } from "@/types";
import { KanbanColumn } from "@/components/pipeline/KanbanColumn";
import { LeadDetailModal } from "@/components/pipeline/LeadDetailModal";
import { Search, Filter, Plus, Kanban as KanbanIcon } from "lucide-react";
import Link from "next/link";

interface KanbanBoardProps {
  leads: Lead[];
  onUpdateStage: (leadId: string, stage: PipelineStage) => void;
  onUpdateNotes: (leadId: string, notes: string) => void;
  onDeleteLead: (leadId: string) => void;
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
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

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

  return (
    <div className="space-y-6">
      {/* Top Filter & Search Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900/70 border border-slate-800">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search leads by company, person, niche or location..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/prospecting"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 font-bold text-xs shadow-glow transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Discover More Leads</span>
          </Link>
        </div>
      </div>

      {/* Kanban Board Horizontal Scroll */}
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
