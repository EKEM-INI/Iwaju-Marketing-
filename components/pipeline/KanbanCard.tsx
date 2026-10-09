"use client";

import React from "react";
import { Lead, PipelineStage } from "@/types";
import { formatCurrency, formatRelativeTime } from "@/lib/utils";
import { LeadScoreBadge } from "@/components/ui/Badge";
import {
  Building2,
  ChevronRight,
  ChevronLeft,
  Mail,
  Phone,
  Send,
  MoreVertical,
  Calendar,
  Clock,
  Sparkles,
} from "lucide-react";
import Link from "next/link";

interface KanbanCardProps {
  lead: Lead;
  onSelect: (lead: Lead) => void;
  onMoveStage: (leadId: string, stage: PipelineStage) => void;
}

const STAGES: PipelineStage[] = ["new", "contacted", "meeting", "closed"];

export function KanbanCard({ lead, onSelect, onMoveStage }: KanbanCardProps) {
  const currentIndex = STAGES.indexOf(lead.stage);

  const canMovePrev = currentIndex > 0;
  const canMoveNext = currentIndex < STAGES.length - 1;

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (canMovePrev) {
      onMoveStage(lead.id, STAGES[currentIndex - 1]);
    }
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (canMoveNext) {
      onMoveStage(lead.id, STAGES[currentIndex + 1]);
    }
  };

  return (
    <div
      onClick={() => onSelect(lead)}
      className="group rounded-xl bg-zinc-900/90 border border-zinc-800 p-4 hover:border-zinc-700 hover:bg-zinc-900 transition-all duration-200 cursor-pointer shadow-md hover:shadow-xl space-y-3 relative"
    >
      {/* Top Company & Score */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors truncate">
            {lead.company}
          </h4>
          <p className="text-[11px] text-zinc-400 truncate mt-0.5">
            {lead.niche} • {lead.location}
          </p>
        </div>
        <LeadScoreBadge score={lead.score} />
      </div>

      {/* Decision Maker */}
      <div className="p-2.5 rounded-lg bg-zinc-950/70 border border-zinc-800/80 text-xs">
        <div className="font-semibold text-zinc-200">{lead.name}</div>
        <div className="text-[11px] text-emerald-400 font-medium">{lead.title}</div>
      </div>

      {/* Deal Value & Age */}
      <div className="flex items-center justify-between text-xs pt-1">
        <div>
          <span className="text-[10px] text-zinc-500 uppercase font-semibold block">
            Deal Value
          </span>
          <span className="font-mono font-bold text-emerald-400">
            {formatCurrency(lead.dealValue, lead.currency)}
          </span>
        </div>

        <div className="text-right">
          <span className="text-[10px] text-zinc-500 uppercase font-semibold block flex items-center gap-1 justify-end">
            <Clock className="w-2.5 h-2.5" />
            <span>Age</span>
          </span>
          <span className="text-[11px] text-zinc-400 font-mono">
            {formatRelativeTime(lead.createdAt)}
          </span>
        </div>
      </div>

      {/* Action Row */}
      <div className="flex items-center justify-between pt-2 border-t border-zinc-800/80">
        {/* Stage Mover Arrows */}
        <div className="flex items-center gap-1">
          <button
            onClick={handlePrev}
            disabled={!canMovePrev}
            className="p-1 rounded bg-zinc-800 text-zinc-400 hover:text-white disabled:opacity-30 disabled:hover:text-zinc-400 transition-colors"
            title="Move to previous stage"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleNext}
            disabled={!canMoveNext}
            className="p-1 rounded bg-zinc-800 text-zinc-400 hover:text-white disabled:opacity-30 disabled:hover:text-zinc-400 transition-colors"
            title="Advance to next stage"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Quick Outreach Link */}
        <Link
          href={`/outreach?leadId=${encodeURIComponent(lead.id)}`}
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-zinc-400 hover:text-emerald-400 p-1 rounded hover:bg-zinc-800 transition-colors"
          title="Compose cold email copy"
        >
          <Send className="w-3 h-3 text-emerald-400" />
          <span>Outreach</span>
        </Link>
      </div>
    </div>
  );
}
