"use client";

import React from "react";
import { CheckCircle2, Zap, Target, Shield, HelpCircle } from "lucide-react";

export function OutreachStats() {
  const tips = [
    {
      title: "Subject Line Constraint",
      desc: "Under 7 words, lowercase or natural capitalization yields +41% higher open rate on mobile.",
    },
    {
      title: "Quantified Value Hook",
      desc: "Specific numbers (e.g. ₦12M–₦35M or +340%) outperform generic promises of 'helping you grow'.",
    },
    {
      title: "Single Low-Friction Call to Action",
      desc: "Avoid asking for 30 minutes immediately. Ask interest-based questions (e.g. 'Opposed to a 10-min peek?').",
    },
    {
      title: "Optimal Follow-Up Cadence",
      desc: "3 to 4 touchpoints over 14 days captures 68% of total positive replies.",
    },
  ];

  return (
    <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800/80 p-5 backdrop-blur-md space-y-4">
      <div className="flex items-center gap-2">
        <Target className="w-4 h-4 text-emerald-400" />
        <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-200">
          Iwaju Outbound Playbook & Heuristics
        </h4>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {tips.map((tip, i) => (
          <div
            key={i}
            className="p-3 rounded-xl bg-zinc-950/70 border border-zinc-800 text-xs space-y-1"
          >
            <div className="font-semibold text-zinc-200 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>{tip.title}</span>
            </div>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              {tip.desc}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
