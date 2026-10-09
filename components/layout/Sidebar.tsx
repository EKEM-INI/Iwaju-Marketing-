"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Radar,
  Kanban,
  Send,
  RotateCcw,
  Cpu,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { resetToSeedData } from "@/lib/storage";
import { useToast } from "@/components/ui/Toast";

export const NAV_ITEMS = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Autonomous AI Mode", href: "/autonomous", icon: Cpu },
  { name: "Lead Prospecting", href: "/prospecting", icon: Radar },
  { name: "Pipeline CRM", href: "/pipeline", icon: Kanban },
  { name: "Outreach Engine", href: "/outreach", icon: Send },
];

interface SidebarProps {
  className?: string;
  onNavigate?: () => void;
  /** "rail" = 56px icon rail with tooltips (desktop). "full" = labelled list (mobile drawer). */
  variant?: "rail" | "full";
}

function useReset() {
  const { showToast } = useToast();
  return () => {
    if (confirm("Reset leads and pipeline data back to default high-tier seed records?")) {
      resetToSeedData();
      showToast("System Reset", "Pipeline and leads restored to default benchmark records.", "info");
    }
  };
}

function RailTooltip({ label }: { label: string }) {
  return (
    <span
      role="tooltip"
      className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md border border-border bg-popover px-2 py-1 text-xs text-foreground opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
    >
      {label}
    </span>
  );
}

export function Sidebar({ className, onNavigate, variant = "rail" }: SidebarProps) {
  const pathname = usePathname();
  const handleReset = useReset();

  if (variant === "full") {
    return (
      <nav
        aria-label="Primary"
        className={cn("flex flex-1 flex-col gap-1 p-2 select-none", className)}
      >
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="size-4" />
              <span>{item.name}</span>
            </Link>
          );
        })}
        <div className="mt-auto border-t border-border pt-2">
          <button
            onClick={handleReset}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <RotateCcw className="size-4" />
            <span>Reset Sample Records</span>
          </button>
        </div>
      </nav>
    );
  }

  return (
    <nav
      aria-label="Primary"
      className={cn(
        "w-14 shrink-0 flex-col items-center gap-1 border-r border-border py-3 select-none",
        className
      )}
    >
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group relative flex size-9 items-center justify-center rounded-md transition-colors",
              active
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Icon className="size-[18px]" />
            <span className="sr-only">{item.name}</span>
            <RailTooltip label={item.name} />
          </Link>
        );
      })}

      <div className="mt-auto flex flex-col items-center gap-1">
        <div
          className="group relative flex size-9 items-center justify-center"
          aria-label="Agent fleet running"
        >
          <span className="size-1.5 rounded-full bg-[#40be96] animate-pulse" />
          <RailTooltip label="Agent fleet running" />
        </div>
        <button
          onClick={handleReset}
          className="group relative flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <RotateCcw className="size-4" />
          <span className="sr-only">Reset Sample Records</span>
          <RailTooltip label="Reset Sample Records" />
        </button>
      </div>
    </nav>
  );
}
