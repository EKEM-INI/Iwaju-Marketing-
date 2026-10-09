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
  Cpu,
  Bot,
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
    name: "Autonomous AI Mode",
    href: "/autonomous",
    icon: Cpu,
    badge: "Eve Agent",
    highlight: true,
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
                <span className="font-bold text-base tracking-tight text-white group-hover:text-emerald-400 transition-colors">
                  Iwaju
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Agentic
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">B2B Outbound Engine</p>
            </div>
          </Link>
        </div>

        {/* Navigation Links */}
        <nav className="p-4 space-y-1">
          <p className="px-3 text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-2">
            Workspace
          </p>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  "flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all group relative",
                  isActive
                    ? "bg-slate-900 text-white font-semibold shadow-inner border border-slate-800/80"
                    : "text-slate-400 hover:text-white hover:bg-slate-900/50"
                )}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={cn(
                      "w-4 h-4 transition-colors",
                      isActive
                        ? "text-emerald-400"
                        : "text-slate-400 group-hover:text-emerald-400"
                    )}
                  />
                  <span>{item.name}</span>
                </div>
                {item.badge && (
                  <span
                    className={cn(
                      "text-[9px] font-mono px-1.5 py-0.5 rounded transition-colors",
                      item.highlight
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 animate-pulse"
                        : isActive
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                        : "bg-slate-900 text-slate-400 border border-slate-800 group-hover:border-slate-700"
                    )}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Bottom Status / Reset */}
      <div className="p-4 border-t border-slate-800/80 space-y-3">
        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 text-xs">
          <div className="flex items-center justify-between font-mono text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Agent Work Queue
            </span>
            <span className="text-emerald-400 font-semibold">Active</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Autonomous 24/7 background lease loops</p>
        </div>

        <button
          onClick={handleReset}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-900/80 border border-transparent hover:border-slate-800 transition-all cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset Demo Data</span>
        </button>
      </div>
    </aside>
  );
}
