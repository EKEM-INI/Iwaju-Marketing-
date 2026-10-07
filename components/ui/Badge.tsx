import React from "react";
import { cn } from "@/lib/utils";
import { PipelineStage } from "@/types";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "emerald" | "sky" | "amber" | "rose" | "purple" | "slate";
  size?: "sm" | "md";
  className?: string;
}

export function Badge({
  children,
  variant = "default",
  size = "md",
  className,
}: BadgeProps) {
  const variantStyles = {
    default: "bg-slate-800 text-slate-300 border-slate-700/60",
    emerald: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    sky: "bg-sky-500/10 text-sky-400 border-sky-500/30",
    amber: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    rose: "bg-rose-500/10 text-rose-400 border-rose-500/30",
    purple: "bg-purple-500/10 text-purple-400 border-purple-500/30",
    slate: "bg-slate-800/80 text-slate-400 border-slate-700/40",
  };

  const sizeStyles = {
    sm: "text-[10px] px-2 py-0.5",
    md: "text-xs px-2.5 py-1",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center font-medium rounded-full border tracking-wide",
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
    >
      {children}
    </span>
  );
}

export function StageBadge({ stage }: { stage: PipelineStage }) {
  const stageMap: Record<
    PipelineStage,
    { label: string; variant: "default" | "emerald" | "sky" | "amber" | "purple" }
  > = {
    new: { label: "New Lead", variant: "sky" },
    contacted: { label: "Contacted", variant: "amber" },
    meeting: { label: "Meeting Booked", variant: "purple" },
    closed: { label: "Closed Won", variant: "emerald" },
  };

  const current = stageMap[stage] || { label: stage, variant: "default" };

  return <Badge variant={current.variant}>{current.label}</Badge>;
}

export function LeadScoreBadge({ score }: { score: number }) {
  let variant: "emerald" | "sky" | "amber" | "rose" = "emerald";
  let tier = "Tier 1 (A+)";

  if (score >= 90) {
    variant = "emerald";
    tier = "A+ Elite";
  } else if (score >= 80) {
    variant = "sky";
    tier = "A High";
  } else if (score >= 70) {
    variant = "amber";
    tier = "B Qualified";
  } else {
    variant = "rose";
    tier = "C General";
  }

  return (
    <Badge variant={variant} size="sm" className="font-mono gap-1">
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      <span>{score}/100</span>
      <span className="opacity-75">· {tier}</span>
    </Badge>
  );
}
