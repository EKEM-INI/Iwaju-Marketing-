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
  RotateCcw,
  Cpu,
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
        "w-60 bg-black border-r border-zinc-900 flex flex-col justify-between h-screen shrink-0 select-none",
        className
      )}
    >
      {/* Top Branding */}
      <div>
        <div className="p-5 border-b border-zinc-900">
          <Link
            href="/"
            onClick={onNavigate}
            className="flex items-center gap-3 group focus:outline-none"
          >
            <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center group-hover:border-zinc-700 transition-colors">
              <Zap className="w-4 h-4 text-white fill-current" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-sm tracking-tight text-white">
                  Iwaju CRM
                </span>
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-400 border border-zinc-800">
                  Agentic
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 font-normal">B2B Outbound Engine</p>
            </div>
          </Link>
        </div>

        {/* Navigation Links */}
        <nav className="p-3 space-y-1">
          <p className="px-3 text-[10px] font-mono uppercase tracking-wider text-zinc-600 mb-2">
            Navigation
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
                  "flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all group relative",
                  isActive
                    ? "bg-zinc-900 text-white font-semibold border border-zinc-800"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-950"
                )}
              >
                <div className="flex items-center gap-2.5">
                  <Icon
                    className={cn(
                      "w-4 h-4 transition-colors",
                      isActive
                        ? "text-white"
                        : "text-zinc-500 group-hover:text-zinc-300"
                    )}
                  />
                  <span>{item.name}</span>
                </div>
                {item.badge && (
                  <span
                    className={cn(
                      "text-[9px] font-mono px-1.5 py-0.5 rounded transition-colors",
                      item.highlight
                        ? "bg-zinc-800 text-zinc-200 border border-zinc-700 font-semibold"
                        : isActive
                        ? "bg-zinc-800 text-zinc-300 border border-zinc-700"
                        : "bg-zinc-950 text-zinc-500 border border-zinc-900 group-hover:border-zinc-800"
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
      <div className="p-3 border-t border-zinc-900 space-y-2">
        <div className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-900 text-xs">
          <div className="flex items-center justify-between font-mono text-[11px] text-zinc-400">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Agent Fleet
            </span>
            <span className="text-zinc-300 font-medium">Running</span>
          </div>
          <p className="text-[10px] text-zinc-500 mt-1">Autonomous background workers active</p>
        </div>

        <button
          onClick={handleReset}
          className="w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-500 hover:text-zinc-300 hover:bg-zinc-950 border border-transparent hover:border-zinc-900 transition-all cursor-pointer"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Reset Sample Records</span>
        </button>
      </div>
    </aside>
  );
}
