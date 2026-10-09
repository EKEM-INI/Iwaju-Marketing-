"use client";

import React from "react";
import Link from "next/link";
import { Radar, Send, Bot, ArrowRight, Sparkles } from "lucide-react";

export function QuickActionBanner() {
  return (
    <div className="relative overflow-hidden rounded-xl bg-zinc-950 border border-zinc-800 p-6 shadow-2xl">
      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2 max-w-xl">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs font-mono">
            <Sparkles className="w-3.5 h-3.5 text-white" />
            <span>Dual-Mode Operations Active</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Autonomous AI Sales Engine &amp; Executive CRM
          </h2>
          <p className="text-sm text-zinc-400 leading-relaxed">
            Switch to the autonomous background fleet to run Prospector, Fact Extractor, Dossier Synthesizer, and DNS Verification automatically.
          </p>
        </div>

        <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 shrink-0">
          <Link
            href="/autonomous"
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-white hover:bg-zinc-200 text-black font-semibold text-sm transition-all duration-200 shadow-sm"
          >
            <Bot className="w-4 h-4 stroke-[2.5]" />
            <span>Switch to Autonomous AI</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/prospecting"
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-medium text-sm border border-zinc-800 transition-colors"
          >
            <Radar className="w-4 h-4 text-zinc-400" />
            <span>Prospect Leads</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
