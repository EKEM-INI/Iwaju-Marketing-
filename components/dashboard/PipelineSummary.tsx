"use client";

import React from "react";
import { Lead, PipelineStage } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { ArrowRight, BarChart3, Target, DollarSign } from "lucide-react";
import Link from "next/link";

interface PipelineSummaryProps {
  leads: Lead[];
}

export function PipelineSummary({ leads }: PipelineSummaryProps) {
  const total = leads.length || 1; // avoid / 0

  const stages: {
    id: PipelineStage;
    label: string;
    color: string;
    bgBar: string;
    textCol: string;
  }[] = [
    {
      id: "new",
      label: "New Leads",
      color: "bg-sky-500",
      bgBar: "bg-sky-500/20",
      textCol: "text-sky-400",
    },
    {
      id: "contacted",
      label: "Contacted",
      color: "bg-amber-500",
      bgBar: "bg-amber-500/20",
      textCol: "text-amber-400",
    },
    {
      id: "meeting",
      label: "Meeting Booked",
      color: "bg-purple-500",
      bgBar: "bg-purple-500/20",
      textCol: "text-purple-400",
    },
    {
      id: "closed",
      label: "Closed Won",
      color: "bg-emerald-500",
      bgBar: "bg-emerald-500/20",
      textCol: "text-emerald-400",
    },
  ];

  const stageData = stages.map((s) => {
    const stageLeads = leads.filter((l) => l.stage === s.id);
    const count = stageLeads.length;
    const value = stageLeads.reduce((acc, l) => acc + (l.dealValue || 0), 0);
    const percentage = Math.round((count / total) * 100);
    return { ...s, count, value, percentage };
  });

  const totalValue = leads.reduce((acc, l) => acc + (l.dealValue || 0), 0);

  return (
    <div className="rounded-2xl bg-slate-900/70 border border-slate-800/90 p-5 sm:p-6 backdrop-blur-md">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-800/70">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <BarChart3 className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-100 text-base">
              Pipeline Health & Stage Velocity
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Live funnel velocity from cold scrape to closed contracts
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
              Aggregate Pipeline Value
            </span>
            <span className="text-base font-bold text-emerald-400 font-mono">
              {formatCurrency(totalValue)}
            </span>
          </div>
          <Link
            href="/pipeline"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700/80 text-xs font-medium text-slate-200 border border-slate-700/60 transition-colors"
          >
            <span>View Board</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Progress Bar Funnel */}
      <div className="mt-6">
        <div className="h-3 w-full rounded-full bg-slate-800 overflow-hidden flex shadow-inner">
          {stageData.map((s) => (
            <div
              key={s.id}
              style={{ width: `${s.percentage}%` }}
              className={`${s.color} transition-all duration-500 first:rounded-l-full last:rounded-r-full hover:opacity-90`}
              title={`${s.label}: ${s.count} leads (${s.percentage}%)`}
            />
          ))}
        </div>
      </div>

      {/* Breakdown Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mt-6">
        {stageData.map((s) => (
          <div
            key={s.id}
            className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${s.color}`} />
              <span className="text-xs font-semibold text-slate-300 truncate">
                {s.label}
              </span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-xl font-bold font-mono text-white">
                {s.count}
              </span>
              <span className="text-xs text-slate-500 font-mono">
                {s.percentage}%
              </span>
            </div>
            <div className="mt-1 text-[11px] font-mono text-slate-400 truncate">
              {formatCurrency(s.value)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
