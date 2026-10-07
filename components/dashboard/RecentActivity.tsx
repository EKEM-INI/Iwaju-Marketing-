"use client";

import React from "react";
import { ActivityItem } from "@/types";
import { formatRelativeTime } from "@/lib/utils";
import {
  Clock,
  Sparkles,
  ArrowRightCircle,
  MailCheck,
  PlusCircle,
  FileText,
} from "lucide-react";

interface RecentActivityProps {
  activities: ActivityItem[];
}

export function RecentActivity({ activities }: RecentActivityProps) {
  const getActivityIcon = (type: ActivityItem["type"]) => {
    switch (type) {
      case "lead_saved":
        return <PlusCircle className="w-4 h-4 text-emerald-400" />;
      case "stage_changed":
        return <ArrowRightCircle className="w-4 h-4 text-purple-400" />;
      case "outreach_generated":
        return <MailCheck className="w-4 h-4 text-sky-400" />;
      case "lead_discovered":
        return <Sparkles className="w-4 h-4 text-amber-400" />;
      default:
        return <FileText className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div className="rounded-2xl bg-slate-900/70 border border-slate-800/90 p-5 sm:p-6 backdrop-blur-md flex flex-col h-full">
      <div className="flex items-center justify-between pb-4 border-b border-slate-800/70">
        <div className="flex items-center gap-2.5">
          <Clock className="w-4 h-4 text-slate-400" />
          <h3 className="font-semibold text-slate-100 text-sm sm:text-base">
            Recent Pipeline Activity
          </h3>
        </div>
        <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
          Live Feed
        </span>
      </div>

      <div className="mt-4 flex-1 space-y-3.5 divide-y divide-slate-800/40">
        {activities.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500">
            No recent activity recorded yet. Run a lead discovery scan to populate.
          </div>
        ) : (
          activities.slice(0, 6).map((item) => (
            <div key={item.id} className="pt-3.5 first:pt-0 flex items-start gap-3 group">
              <div className="p-2 rounded-lg bg-slate-800/70 border border-slate-700/50 mt-0.5 shrink-0 group-hover:border-slate-600 transition-colors">
                {getActivityIcon(item.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-slate-200 truncate">
                    {item.title}
                  </p>
                  <span className="text-[10px] text-slate-500 font-mono shrink-0">
                    {formatRelativeTime(item.timestamp)}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5 line-clamp-2 leading-relaxed">
                  {item.description}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
