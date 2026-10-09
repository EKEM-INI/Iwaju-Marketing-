"use client";

import React from "react";
import { Lead, PipelineStage } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { ArrowRight, BarChart3 } from "lucide-react";
import Link from "next/link";

interface PipelineSummaryProps {
  leads: Lead[];
}

export function PipelineSummary({ leads }: PipelineSummaryProps) {
  const total = leads.length || 1;
  const stages: {
    id: PipelineStage;
    label: string;
    color: string;
    badgeCol: string;
  }[] = [
    {
      id: "new",
      label: "New Leads",
      color: "bg-zinc-400",
      badgeCol: "text-zinc-300",
    },
    {
      id: "contacted",
      label: "Contacted",
      color: "bg-zinc-300",
      badgeCol: "text-zinc-200",
    },
    {
      id: "meeting",
      label: "Meeting Booked",
      color: "bg-white",
      badgeCol: "text-white",
    },
    {
      id: "closed",
      label: "Closed Won",
      color: "bg-emerald-400",
      badgeCol: "text-emerald-400",
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
    <div className="rounded-xl bg-zinc-950 border border-zinc-800 p-5 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-800">
            <BarChart3 className="w-4 h-4 text-zinc-300" />
          </div>
          <div>
            <h3 className="font-semibold text-white text-sm">
              Pipeline Health &amp; Stage Velocity
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              Live funnel from discovery scraping to closed won
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider block">
              Total Pipeline Value
            </span>
            <span className="text-sm font-bold text-white font-mono">
              {formatCurrency(totalValue)}
            </span>
          </div>
          <Link
            href="/pipeline"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-xs font-medium text-zinc-200 border border-zinc-800 transition-colors"
          >
            <span>View Board</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Progress Bar Funnel */}
      <div className="mt-5">
        <div className="h-2 w-full rounded-full bg-zinc-900 overflow-hidden flex">
          {stageData.map((s) => (
            <div
              key={s.id}
              style={{ width: `${s.percentage}%` }}
              className={`${s.color} transition-all duration-300 first:rounded-l-full last:rounded-r-full hover:opacity-90`}
              title={`${s.label}: ${s.count} leads (${s.percentage}%)`}
            />
          ))}
        </div>
      </div>

      {/* Breakdown Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
        {stageData.map((s) => (
          <div
            key={s.id}
            className="p-3.5 rounded-lg bg-black border border-zinc-800 hover:border-zinc-700 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${s.color}`} />
              <span className="text-xs font-medium text-zinc-300 truncate">
                {s.label}
              </span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-xl font-bold font-mono text-white">
                {s.count}
              </span>
              <span className="text-xs text-zinc-500 font-mono">
                {s.percentage}%
              </span>
            </div>
            <div className="mt-1 text-[11px] font-mono text-zinc-400 truncate">
              {formatCurrency(s.value)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
