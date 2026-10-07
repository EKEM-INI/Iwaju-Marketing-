"use client";

import React from "react";
import Link from "next/link";
import { Radar, Send, Kanban, ArrowUpRight, Sparkles } from "lucide-react";

export function QuickActionBanner() {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/90 to-emerald-950/40 border border-emerald-500/30 p-6 shadow-glow">
      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2 max-w-xl">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Outbound Velocity Accelerator</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Ready to generate high-intent B2B accounts?
          </h2>
          <p className="text-sm text-slate-300 leading-relaxed">
            Specify your target niche and geography to scrape decision-maker data,
            streamline qualified opportunities into the Kanban CRM, and trigger AI cold sequences.
          </p>
        </div>

        <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 shrink-0">
          <Link
            href="/prospecting"
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 font-bold text-sm shadow-glow hover:shadow-glow-lg transition-all duration-200"
          >
            <Radar className="w-4 h-4 stroke-[2.5]" />
            <span>Prospect Leads</span>
            <ArrowUpRight className="w-4 h-4" />
          </Link>

          <Link
            href="/outreach"
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-800/90 hover:bg-slate-700/80 text-slate-200 font-semibold text-sm border border-slate-700 transition-colors"
          >
            <Send className="w-4 h-4 text-emerald-400" />
            <span>Generate Copy</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
