"use client";

import React, { useEffect, useState } from "react";
import { getStoredLeads, getStoredActivities } from "@/lib/storage";
import { Lead, ActivityItem } from "@/types";
import { MetricCards } from "@/components/dashboard/MetricCards";
import { PipelineSummary } from "@/components/dashboard/PipelineSummary";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { QuickActionBanner } from "@/components/dashboard/QuickActionBanner";
import { Sparkles, Calendar, Layers } from "lucide-react";

export default function DashboardPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
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
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Top Welcome Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase font-extrabold tracking-widest text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              Command Center
            </span>
            <span className="text-xs text-slate-500">•</span>
            <span className="text-xs text-slate-400 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <span>{todayStr}</span>
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-1">
            Outbound Revenue Velocity
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl">
            Real-time pipeline analytics, high-speed automated lead discovery, and AI cold conversion operations.
          </p>
        </div>

        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs text-slate-400">
          <Layers className="w-4 h-4 text-emerald-400" />
          <span>Sync Status:</span>
          <span className="font-semibold text-emerald-400">LocalStorage Active</span>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <MetricCards leads={leads} />

      {/* Quick Action Banner */}
      <QuickActionBanner />

      {/* 2-Column: Funnel Analytics & Recent Activities */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
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
