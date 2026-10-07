"use client";

import React from "react";
import { Lead, PipelineStage, PipelineColumnDef } from "@/types";
import { KanbanCard } from "@/components/pipeline/KanbanCard";
import { formatCurrency } from "@/lib/utils";

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
  const totalValue = leads.reduce((sum, l) => sum + (l.dealValue || 0), 0);

  return (
    <div className="flex flex-col rounded-2xl bg-slate-950/50 border border-slate-800/90 w-80 shrink-0 h-[calc(100vh-14rem)] min-h-[500px]">
      {/* Column Header */}
      <div className={`p-4 border-b border-slate-800/80 ${column.borderCol} border-t-2 rounded-t-2xl bg-slate-900/60`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${column.color}`} />
            <h3 className="font-bold text-sm text-slate-100">{column.title}</h3>
          </div>
          <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
            {leads.length}
          </span>
        </div>

        <div className="mt-2 text-xs flex items-center justify-between text-slate-400 font-mono">
          <span>Stage Value:</span>
          <span className="font-bold text-emerald-400">
            {formatCurrency(totalValue)}
          </span>
        </div>
      </div>

      {/* Cards Scrollable Container */}
      <div className="p-3 flex-1 overflow-y-auto space-y-3 scrollbar-thin">
        {leads.length === 0 ? (
          <div className="h-40 flex flex-col items-center justify-center text-center p-4 border border-dashed border-slate-800 rounded-xl text-slate-600">
            <p className="text-xs">No prospects in this stage</p>
          </div>
        ) : (
          leads.map((lead) => (
            <KanbanCard
              key={lead.id}
              lead={lead}
              onSelect={onSelectLead}
              onMoveStage={onMoveStage}
            />
          ))
        )}
      </div>
    </div>
  );
}
