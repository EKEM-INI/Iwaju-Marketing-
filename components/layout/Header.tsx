"use client";

import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Menu,
  Plus,
  Layers,
  TrendingUp,
  LogOut,
  ShieldCheck,
  ChevronDown,
} from "lucide-react";
import { getStoredLeads } from "@/lib/storage";
import { formatCurrency } from "@/lib/utils";
import { useAuth } from "@/components/auth/AuthContext";

interface HeaderProps {
  onMobileMenuToggle: () => void;
}

export function Header({ onMobileMenuToggle }: HeaderProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [leadCount, setLeadCount] = useState(0);
  const [pipelineTotal, setPipelineTotal] = useState(0);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setUserDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
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
        <button
          onClick={onMobileMenuToggle}
          className="lg:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900 border border-slate-800"
          aria-label="Toggle navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div>
          <h1 className="text-sm sm:text-base font-semibold text-slate-100 flex items-center gap-2">
            <span>{getPageTitle()}</span>
            <span className="hidden md:inline-flex text-[11px] font-normal text-slate-400 border border-slate-800 bg-slate-900/60 px-2 py-0.5 rounded-full">
              Production MVP
            </span>
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-3 sm:gap-4">
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

        <Link
          href="/prospecting"
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 font-semibold text-xs transition-all duration-200 shadow-glow hover:shadow-glow-lg active:scale-95"
        >
          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
          <span className="hidden xs:inline">Scrape Leads</span>
          <span className="xs:hidden">Scrape</span>
        </Link>

        {user && (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setUserDropdownOpen(!userDropdownOpen)}
              className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-slate-900 border border-transparent hover:border-slate-800 transition-colors focus:outline-none"
              aria-label="User profile options"
            >
              <img
                src={user.avatar}
                alt={user.name}
                className="w-7 h-7 rounded-lg ring-1 ring-emerald-500/40 object-cover"
              />
              <span className="hidden md:inline-block text-xs font-medium text-slate-200 max-w-[100px] truncate">
                {user.name.split(" ")[0]}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {userDropdownOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl py-2 z-50 text-xs animate-in fade-in zoom-in-95">
                <div className="px-4 py-3 border-b border-slate-800/80">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <p className="font-semibold text-slate-200 truncate">{user.name}</p>
                  </div>
                  <p className="text-[11px] text-slate-400 truncate mt-0.5">{user.email}</p>
                  <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-medium">
                    <ShieldCheck className="w-3 h-3" />
                    Google Account Verified
                  </div>
                </div>

                <div className="p-1.5">
                  <button
                    onClick={() => {
                      setUserDropdownOpen(false);
                      logout();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-xl transition-colors font-medium"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out of Google</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
