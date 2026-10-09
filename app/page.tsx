"use client";

import React, { useEffect, useState } from "react";
import { getStoredLeads, getStoredActivities } from "@/lib/storage";
import { Lead, ActivityItem } from "@/types";
import { MetricCards } from "@/components/dashboard/MetricCards";
import { PipelineSummary } from "@/components/dashboard/PipelineSummary";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { QuickActionBanner } from "@/components/dashboard/QuickActionBanner";
import { Calendar, Layers } from "lucide-react";

export default function DashboardPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);

  useEffect(() => {
    setLeads(getStoredLeads());
    setActivities(getStoredActivities());

    const handleLeadsUpdate = () => setLeads(getStoredLeads());
    const handleActivitiesUpdate = () => setActivities(getStoredActivities());

    window.addEventListener("iwaju-leads-updated", handleLeadsUpdate);
    window.addEventListener("iwaju-activities-updated", handleActivitiesUpdate);

    return () => {
      window.removeEventListener("iwaju-leads-updated", handleLeadsUpdate);
      window.removeEventListener("iwaju-activities-updated", handleActivitiesUpdate);
    };
  }, []);

  const todayStr = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date());

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Welcome Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-mono tracking-wider text-zinc-400 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
              Command Center
            </span>
            <span className="text-xs text-zinc-600">•</span>
            <span className="text-xs text-zinc-500 flex items-center gap-1 font-mono">
              <Calendar className="w-3 h-3 text-zinc-500" />
              <span>{todayStr}</span>
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight mt-1.5">
            Outbound Revenue Velocity
          </h2>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1 max-w-2xl">
            Real-time pipeline analytics, high-speed automated lead discovery, and AI cold conversion operations.
          </p>
        </div>

        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-400 font-mono">
          <Layers className="w-3.5 h-3.5 text-zinc-300" />
          <span>Storage:</span>
          <span className="font-semibold text-white">Encrypted Local Ledger</span>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <MetricCards leads={leads} />

      {/* Quick Action Banner */}
      <QuickActionBanner />

      {/* 2-Column: Funnel Analytics & Recent Activities */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        <div className="lg:col-span-8">
          <PipelineSummary leads={leads} />
        </div>
        <div className="lg:col-span-4">
          <RecentActivity activities={activities} />
        </div>
      </div>
    </div>
  );
}
