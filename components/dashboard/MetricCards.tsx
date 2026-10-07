"use client";

import React from "react";
import {
  Users,
  Send,
  CalendarCheck2,
  DollarSign,
  TrendingUp,
  Percent,
} from "lucide-react";
import { Lead } from "@/types";
import { formatCurrency } from "@/lib/utils";

interface MetricCardsProps {
  leads: Lead[];
}

export function MetricCards({ leads }: MetricCardsProps) {
  const totalLeads = leads.length;
  const contactedLeads = leads.filter((l) => l.stage === "contacted").length;
  const meetingsBooked = leads.filter((l) => l.stage === "meeting").length;
  const closedLeads = leads.filter((l) => l.stage === "closed").length;

  const totalPipelineValue = leads.reduce((sum, l) => sum + (l.dealValue || 0), 0);
  const closedValue = leads
    .filter((l) => l.stage === "closed")
    .reduce((sum, l) => sum + (l.dealValue || 0), 0);

  // Conversion rate: (Meetings + Closed) / Total Leads
  const conversionRate =
    totalLeads > 0
      ? Math.round(((meetingsBooked + closedLeads) / totalLeads) * 100)
      : 0;

  const metrics = [
    {
      title: "Total Discovered Leads",
      value: totalLeads.toString(),
      change: "+28% this week",
      trend: "up",
      icon: Users,
      accent: "from-sky-500/20 to-sky-500/0",
      iconColor: "text-sky-400",
      borderColor: "border-sky-500/20",
    },
    {
      title: "Active Outreach In-Flight",
      value: contactedLeads.toString(),
      change: `${contactedLeads} sequences running`,
      trend: "neutral",
      icon: Send,
      accent: "from-amber-500/20 to-amber-500/0",
      iconColor: "text-amber-400",
      borderColor: "border-amber-500/20",
    },
    {
      title: "Discovery Meetings Booked",
      value: meetingsBooked.toString(),
      change: "High intent discussions",
      trend: "up",
      icon: CalendarCheck2,
      accent: "from-purple-500/20 to-purple-500/0",
      iconColor: "text-purple-400",
      borderColor: "border-purple-500/20",
    },
    {
      title: "Pipeline Conversion Rate",
      value: `${conversionRate}%`,
      change: `${closedLeads} deals won (${formatCurrency(closedValue)})`,
      trend: "up",
      icon: Percent,
      accent: "from-emerald-500/20 to-emerald-500/0",
      iconColor: "text-emerald-400",
      borderColor: "border-emerald-500/30",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
      {metrics.map((m, idx) => {
        const Icon = m.icon;
        return (
          <div
            key={idx}
            className={`relative overflow-hidden rounded-2xl bg-slate-900/70 border ${m.borderColor} p-5 sm:p-6 backdrop-blur-md transition-all duration-300 hover:translate-y-[-2px] hover:shadow-card`}
          >
            {/* Top subtle gradient glow */}
            <div
              className={`absolute top-0 left-0 right-0 h-16 bg-gradient-to-b ${m.accent} pointer-events-none opacity-60`}
            />

            <div className="relative z-10 flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-slate-400 tracking-wide uppercase">
                  {m.title}
                </p>
                <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mt-2 font-mono">
                  {m.value}
                </h3>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/50">
                <Icon className={`w-5 h-5 ${m.iconColor}`} />
              </div>
            </div>

            <div className="relative z-10 mt-4 flex items-center gap-1.5 text-xs text-slate-400 font-medium pt-3 border-t border-slate-800/60">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="truncate">{m.change}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
