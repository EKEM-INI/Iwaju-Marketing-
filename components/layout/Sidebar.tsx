"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Radar,
  Kanban,
  Send,
  Zap,
  TrendingUp,
  ShieldCheck,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { resetToSeedData } from "@/lib/storage";
import { useToast } from "@/components/ui/Toast";

const NAV_ITEMS = [
  {
    name: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
    badge: null,
  },
  {
    name: "Lead Prospecting",
    href: "/prospecting",
    icon: Radar,
    badge: "Crawler",
  },
  {
    name: "Pipeline CRM",
    href: "/pipeline",
    icon: Kanban,
    badge: "Kanban",
  },
  {
    name: "Outreach Engine",
    href: "/outreach",
    icon: Send,
    badge: "AI Copy",
  },
];

interface SidebarProps {
  className?: string;
  onNavigate?: () => void;
}

export function Sidebar({ className, onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const { showToast } = useToast();

  const handleReset = () => {
    if (confirm("Reset leads and pipeline data back to default high-tier seed records?")) {
      resetToSeedData();
      showToast("System Reset", "Pipeline and leads restored to default benchmark records.", "info");
    }
  };

  return (
    <aside
      className={cn(
        "w-64 bg-slate-950/95 border-r border-slate-800/80 flex flex-col justify-between h-screen shrink-0 backdrop-blur-xl select-none",
        className
      )}
    >
      {/* Top Branding */}
      <div>
        <div className="p-6 border-b border-slate-800/80">
          <Link
            href="/"
            onClick={onNavigate}
            className="flex items-center gap-3 group focus:outline-none"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-glow group-hover:scale-105 transition-transform duration-200">
              <Zap className="w-5 h-5 text-slate-950 fill-current" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-lg tracking-tight text-white group-hover:text-emerald-400 transition-colors">
                  Iwaju
                </span>
                <span className="text-xs uppercase font-extrabold tracking-widest text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                  OS
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">B2B Lead & Pipeline Engine</p>
            </div>
          </Link>
        </div>

        {/* Navigation Items */}
        <div className="px-3 py-6 space-y-1">
          <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
            Core Modules
          </p>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname?.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  "flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group relative",
                  isActive
                    ? "bg-emerald-500/15 text-emerald-300 font-semibold shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)] border border-emerald-500/30"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent"
                )}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={cn(
                      "w-4 h-4 transition-colors",
                      isActive
                        ? "text-emerald-400"
                        : "text-slate-400 group-hover:text-slate-200"
                    )}
                  />
                  <span>{item.name}</span>
                </div>
                {item.badge && (
                  <span
                    className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded-md font-mono transition-colors",
                      isActive
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                        : "bg-slate-900 text-slate-500 border border-slate-800"
                    )}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Bottom Status Card */}
      <div className="p-4 border-t border-slate-800/80 space-y-3">
        <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800/90 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Engine Online
            </span>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          </div>
          <p className="text-[11px] text-slate-400 leading-snug">
            Prospecting radar active. Local storage sync enabled.
          </p>
          <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 text-[10px] text-slate-500">
            <span>Accuracy 98.4%</span>
            <span>Vercel Ready</span>
          </div>
        </div>

        <button
          onClick={handleReset}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-900 rounded-lg border border-slate-800/60 transition-colors"
          title="Restore standard seed leads"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset Demo Data</span>
        </button>
      </div>
    </aside>
  );
}
