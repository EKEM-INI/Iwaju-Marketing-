"use client";

import React, { useState } from "react";
import { Lead, PipelineStage, PipelineColumnDef } from "@/types";
import { KanbanCard } from "@/components/pipeline/KanbanCard";
import { formatCurrency } from "@/lib/utils";
import { ChevronDown, Plus } from "lucide-react";

interface KanbanColumnProps {
  column: PipelineColumnDef;
  leads: Lead[];
  onSelectLead: (lead: Lead) => void;
  onMoveStage: (leadId: string, stage: PipelineStage) => void;
}

export function KanbanColumn({
  column,
  leads,
  onSelectLead,
  onMoveStage,
}: KanbanColumnProps) {
  const [visibleCount, setVisibleCount] = useState(25);
  const totalValue = leads.reduce((sum, l) => sum + (l.dealValue || 0), 0);

  const displayedLeads = leads.slice(0, visibleCount);
  const hasMore = leads.length > visibleCount;

  return (
    <div className="flex flex-col rounded-2xl bg-zinc-950/50 border border-zinc-800/90 w-80 shrink-0 h-[calc(100vh-14rem)] min-h-[500px]">
      {/* Column Header */}
      <div className={`p-4 border-b border-zinc-800/80 ${column.borderCol} border-t-2 rounded-t-2xl bg-zinc-900/60`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${column.color}`} />
            <h3 className="font-bold text-sm text-zinc-100">{column.title}</h3>
          </div>
          <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300">
            {leads.length}
          </span>
        </div>

        <div className="mt-2 text-xs flex items-center justify-between text-zinc-400 font-mono">
          <span>Stage Value:</span>
          <span className="font-bold text-emerald-400">
            {formatCurrency(totalValue)}
          </span>
        </div>
      </div>

      {/* Cards Scrollable Container */}
      <div className="p-3 flex-1 overflow-y-auto space-y-3 scrollbar-thin">
        {leads.length === 0 ? (
          <div className="h-40 flex flex-col items-center justify-center text-center p-4 border border-dashed border-zinc-800 rounded-xl text-zinc-600">
            <p className="text-xs">No prospects in this stage</p>
          </div>
        ) : (
          <>
            {displayedLeads.map((lead) => (
              <KanbanCard
                key={lead.id}
                lead={lead}
                onSelect={onSelectLead}
                onMoveStage={onMoveStage}
              />
            ))}

            {hasMore && (
              <button
                onClick={() => setVisibleCount((prev) => prev + 25)}
                className="w-full py-2.5 px-3 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 text-xs text-zinc-300 hover:text-white font-medium transition-colors flex items-center justify-center gap-1.5 shadow-sm"
              >
                <ChevronDown className="w-3.5 h-3.5 text-emerald-400" />
                <span>
                  Load 25 More (Showing {visibleCount} of {leads.length})
                </span>
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
