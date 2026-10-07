"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Menu,
  Search,
  Plus,
  Sparkles,
  Layers,
  TrendingUp,
} from "lucide-react";
import { getStoredLeads } from "@/lib/storage";
import { formatCurrency } from "@/lib/utils";
import { Lead } from "@/types";

interface HeaderProps {
  onMobileMenuToggle: () => void;
}

export function Header({ onMobileMenuToggle }: HeaderProps) {
  const pathname = usePathname();
  const [leadCount, setLeadCount] = useState(0);
  const [pipelineTotal, setPipelineTotal] = useState(0);

  const updateStats = () => {
    const leads = getStoredLeads();
    setLeadCount(leads.length);
    const sum = leads.reduce((acc, l) => acc + (l.dealValue || 0), 0);
    setPipelineTotal(sum);
  };

  useEffect(() => {
    updateStats();

    const handleUpdate = () => updateStats();
    window.addEventListener("iwaju-leads-updated", handleUpdate);
    return () => window.removeEventListener("iwaju-leads-updated", handleUpdate);
  }, []);

  const getPageTitle = () => {
    if (pathname === "/") return "Executive Command Center";
    if (pathname.startsWith("/prospecting")) return "High-Speed Lead Prospecting";
    if (pathname.startsWith("/pipeline")) return "Pipeline CRM Kanban Board";
    if (pathname.startsWith("/outreach")) return "Cold Outreach Copy Engine";
    return "Dashboard";
  };

  return (
    <header className="h-16 border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-xl px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 select-none">
      <div className="flex items-center gap-4">
        {/* Mobile menu button */}
        <button
          onClick={onMobileMenuToggle}
          className="lg:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900 border border-slate-800"
          aria-label="Toggle navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Title */}
        <div>
          <h1 className="text-sm sm:text-base font-semibold text-slate-100 flex items-center gap-2">
            <span>{getPageTitle()}</span>
            <span className="hidden md:inline-flex text-[11px] font-normal text-slate-400 border border-slate-800 bg-slate-900/60 px-2 py-0.5 rounded-full">
              Production MVP
            </span>
          </h1>
        </div>
      </div>

      {/* Right Stats & Actions */}
      <div className="flex items-center gap-3 sm:gap-4">
        {/* Live Pipeline Metric Pill */}
        <div className="hidden sm:flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-slate-900/90 border border-slate-800 text-xs">
          <div className="flex items-center gap-1.5 text-slate-400">
            <Layers className="w-3.5 h-3.5 text-emerald-400" />
            <span>Active Leads:</span>
            <span className="font-semibold text-slate-200">{leadCount}</span>
          </div>
          <span className="text-slate-700">|</span>
          <div className="flex items-center gap-1.5 text-slate-400">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            <span>Pipeline:</span>
            <span className="font-semibold text-emerald-400">
              {formatCurrency(pipelineTotal)}
            </span>
          </div>
        </div>

        {/* Quick Discovery CTA Button */}
        <Link
          href="/prospecting"
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 font-semibold text-xs transition-all duration-200 shadow-glow hover:shadow-glow-lg active:scale-95"
        >
          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
          <span className="hidden xs:inline">Scrape Leads</span>
          <span className="xs:hidden">Scrape</span>
        </Link>
      </div>
    </header>
  );
}
