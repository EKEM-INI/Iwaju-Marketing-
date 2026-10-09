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
        return <PlusCircle className="w-3.5 h-3.5 text-zinc-300" />;
      case "stage_changed":
        return <ArrowRightCircle className="w-3.5 h-3.5 text-zinc-300" />;
      case "outreach_generated":
        return <MailCheck className="w-3.5 h-3.5 text-zinc-300" />;
      case "lead_discovered":
        return <Sparkles className="w-3.5 h-3.5 text-zinc-300" />;
      default:
        return <FileText className="w-3.5 h-3.5 text-zinc-400" />;
    }
  };

  return (
    <div className="rounded-xl bg-zinc-950 border border-zinc-800 p-5 sm:p-6 flex flex-col h-full">
      <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-zinc-400" />
          <h3 className="font-semibold text-white text-sm">
            Recent Pipeline Activity
          </h3>
        </div>
        <span className="text-[10px] font-mono text-zinc-400 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
          Live Feed
        </span>
      </div>

      <div className="mt-4 flex-1 space-y-3 divide-y divide-zinc-900">
        {activities.length === 0 ? (
          <div className="py-8 text-center text-xs text-zinc-500 font-mono">
            No recent activity recorded yet. Run a prospecting scan to populate.
          </div>
        ) : (
          activities.slice(0, 6).map((item) => (
            <div key={item.id} className="pt-3 first:pt-0 flex items-start gap-3 group">
              <div className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 mt-0.5 shrink-0">
                {getActivityIcon(item.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-zinc-200 truncate">
                    {item.title}
                  </p>
                  <span className="text-[10px] text-zinc-500 font-mono shrink-0">
                    {formatRelativeTime(item.timestamp)}
                  </span>
                </div>
                <p className="text-xs text-zinc-400 mt-0.5 line-clamp-2 leading-relaxed">
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
