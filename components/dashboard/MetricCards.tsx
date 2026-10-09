"use client";

import React from "react";
import {
  Users,
  Send,
  CalendarCheck2,
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
  const closedValue = leads
    .filter((l) => l.stage === "closed")
    .reduce((sum, l) => sum + (l.dealValue || 0), 0);

  const conversionRate =
    totalLeads > 0
      ? Math.round(((meetingsBooked + closedLeads) / totalLeads) * 100)
      : 0;

  const metrics = [
    {
      title: "Total Discovered Leads",
      value: totalLeads.toString(),
      change: "+28% discovery velocity",
      icon: Users,
    },
    {
      title: "Active Sequences",
      value: contactedLeads.toString(),
      change: `${contactedLeads} personalized in-flight`,
      icon: Send,
    },
    {
      title: "Meetings Booked",
      value: meetingsBooked.toString(),
      change: "Executive discussions scheduled",
      icon: CalendarCheck2,
    },
    {
      title: "Pipeline Conversion",
      value: `${conversionRate}%`,
      change: `${closedLeads} closed won (${formatCurrency(closedValue)})`,
      icon: Percent,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {metrics.map((m, idx) => {
        const Icon = m.icon;
        return (
          <div
            key={idx}
            className="rounded-xl bg-zinc-950 border border-zinc-800 p-5 transition-all hover:border-zinc-700"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-wider">
                  {m.title}
                </p>
                <h3 className="text-2xl font-bold tracking-tight text-white mt-1.5 font-mono">
                  {m.value}
                </h3>
              </div>
              <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300">
                <Icon className="w-4 h-4" />
              </div>
            </div>

            <div className="mt-3 flex items-center gap-1.5 text-xs text-zinc-400 pt-3 border-t border-zinc-900">
              <TrendingUp className="w-3.5 h-3.5 text-zinc-300 shrink-0" />
              <span className="truncate">{m.change}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
