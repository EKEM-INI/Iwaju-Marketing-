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
  Mail,
  Cpu,
  Bot,
  Building2,
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
    switch (pathname) {
      case "/":
        return { title: "Command Center", subtitle: "Real-time outbound pipeline metrics" };
      case "/autonomous":
        return { title: "Autonomous Agent Fleet", subtitle: "Comp AI agentic engine with strict evidence ledger" };
      case "/prospecting":
        return { title: "Lead Prospecting Radar", subtitle: "Automated business discovery & enrichment" };
      case "/pipeline":
        return { title: "Pipeline CRM", subtitle: "Visual Kanban deal velocity tracking" };
      case "/outreach":
        return { title: "Outreach Engine", subtitle: "High-converting B2B cold email sequences" };
      default:
        return { title: "Iwaju Outbound", subtitle: "Executive B2B Sales Engine" };
    }
  };

  const { title, subtitle } = getPageTitle();

  return (
    <header className="h-20 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl px-4 sm:px-6 lg:px-8 flex items-center justify-between sticky top-0 z-30 select-none">
      <div className="flex items-center gap-3">
        <button
          onClick={onMobileMenuToggle}
          className="lg:hidden p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-900 border border-slate-800 transition-colors"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-lg font-bold text-white tracking-tight">{title}</h1>
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live System
            </span>
          </div>
          <p className="text-xs text-slate-400 font-medium hidden sm:block">{subtitle}</p>
        </div>
      </div>

      <div className="flex items-center gap-3 sm:gap-4">
        {/* Comp AI Dual Mode Toggle */}
        <div className="flex items-center p-0.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-medium">
          <Link
            href="/"
            className={`px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition-all ${
              pathname !== "/autonomous"
                ? "bg-slate-800 text-white shadow-xs font-semibold"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Executive CRM</span>
          </Link>
          <Link
            href="/autonomous"
            className={`px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition-all ${
              pathname === "/autonomous"
                ? "bg-emerald-950/70 text-emerald-300 border border-emerald-500/30 shadow-xs font-semibold"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Cpu className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Autonomous Mode</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
          </Link>
        </div>

        {/* Global Pipeline Metrics */}
        <div className="hidden md:flex items-center gap-4 px-3.5 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs font-mono">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">Leads:</span>
            <span className="text-white font-semibold">{leadCount}</span>
          </div>
          <div className="w-px h-3.5 bg-slate-800" />
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">Pipeline:</span>
            <span className="text-emerald-400 font-semibold">{formatCurrency(pipelineTotal)}</span>
          </div>
        </div>

        {/* User Profile Dropdown */}
        {user && (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setUserDropdownOpen(!userDropdownOpen)}
              className="flex items-center gap-2 p-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all text-xs"
            >
              <img
                src={user.avatar}
                alt={user.name}
                className="w-7 h-7 rounded-lg ring-1 ring-emerald-500/40 object-cover"
              />
              <div className="hidden lg:block text-left">
                <p className="text-xs font-medium text-white max-w-[120px] truncate leading-tight">
                  {user.name}
                </p>
                <p className="text-[10px] text-slate-400 font-mono truncate leading-tight">
                  {user.email}
                </p>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-0.5" />
            </button>

            {userDropdownOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl py-2 z-50 text-xs">
                <div className="px-4 py-3 border-b border-slate-800/80">
                  <div className="flex items-center gap-2 text-emerald-400 font-semibold mb-1">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Verified Executive Session</span>
                  </div>
                  <p className="font-bold text-white truncate text-sm">{user.name}</p>
                  <p className="text-[11px] text-slate-400 truncate font-mono mt-0.5">{user.email}</p>
                </div>

                <div className="px-2 pt-2">
                  <button
                    onClick={() => {
                      logout();
                      setUserDropdownOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl text-rose-400 hover:bg-rose-500/10 transition-colors flex items-center gap-2 font-medium"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
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
