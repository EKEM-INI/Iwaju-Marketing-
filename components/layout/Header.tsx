"use client";

import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Menu,
  Plus,
  LogOut,
  ShieldCheck,
  ChevronDown,
  Mail,
  Cpu,
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
        return { title: "Command Center", subtitle: "Outbound pipeline & operational overview" };
      case "/autonomous":
        return { title: "Autonomous Agent Fleet", subtitle: "Comp AI agentic engine with verified evidence ledger" };
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
    <header className="h-16 border-b border-zinc-900 bg-black px-4 sm:px-6 lg:px-8 flex items-center justify-between sticky top-0 z-30 select-none">
      <div className="flex items-center gap-3">
        <button
          onClick={onMobileMenuToggle}
          className="lg:hidden p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900 border border-zinc-800 transition-colors"
          aria-label="Open navigation menu"
        >
          <Menu className="w-4 h-4" />
        </button>

        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-sm font-semibold text-white tracking-tight">{title}</h1>
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono bg-zinc-900 text-zinc-400 border border-zinc-800">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Active
            </span>
          </div>
          <p className="text-xs text-zinc-500 font-normal hidden sm:block">{subtitle}</p>
        </div>
      </div>

      <div className="flex items-center gap-3 sm:gap-4">
        {/* Comp AI Dual Mode Toggle */}
        <div className="flex items-center p-0.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs font-medium">
          <Link
            href="/"
            className={`px-2.5 py-1 rounded-md flex items-center gap-1.5 transition-all text-xs ${
              pathname !== "/autonomous"
                ? "bg-zinc-800 text-white font-medium shadow-xs"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Executive CRM</span>
          </Link>
          <Link
            href="/autonomous"
            className={`px-2.5 py-1 rounded-md flex items-center gap-1.5 transition-all text-xs ${
              pathname === "/autonomous"
                ? "bg-zinc-800 text-white font-medium shadow-xs"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Cpu className="w-3.5 h-3.5 text-zinc-200" />
            <span className="hidden sm:inline">Autonomous Mode</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
          </Link>
        </div>

        {/* Global Pipeline Metrics */}
        <div className="hidden md:flex items-center gap-3 px-3 py-1 rounded-lg bg-zinc-950 border border-zinc-800 text-xs font-mono">
          <div className="flex items-center gap-1.5">
            <span className="text-zinc-500">Leads:</span>
            <span className="text-white font-medium">{leadCount}</span>
          </div>
          <div className="w-px h-3 bg-zinc-800" />
          <div className="flex items-center gap-1.5">
            <span className="text-zinc-500">Pipeline:</span>
            <span className="text-zinc-200 font-medium">{formatCurrency(pipelineTotal)}</span>
          </div>
        </div>

        {/* Quick Launch Button */}
        <Link
          href="/prospecting"
          className="hidden xl:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-zinc-200 text-black font-semibold text-xs transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Search</span>
        </Link>

        {/* User Account Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setUserDropdownOpen(!userDropdownOpen)}
            className="flex items-center gap-2 p-1.5 rounded-lg bg-zinc-950 border border-zinc-800 hover:border-zinc-700 transition-colors"
            aria-label="User profile settings"
          >
            <div className="w-6 h-6 rounded-md bg-zinc-800 flex items-center justify-center text-white font-semibold text-xs">
              {user?.name ? user.name.charAt(0).toUpperCase() : "U"}
            </div>
            <span className="text-xs font-medium text-zinc-300 hidden md:block max-w-[100px] truncate">
              {user?.name || user?.email?.split("@")[0] || "Account"}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-zinc-500 hidden md:block" />
          </button>

          {userDropdownOpen && (
            <div className="absolute right-0 mt-2 w-56 rounded-xl bg-zinc-950 border border-zinc-800 p-2 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="px-3 py-2 border-b border-zinc-800/80 mb-1">
                <p className="text-xs font-semibold text-white truncate">{user?.name || "Executive User"}</p>
                <p className="text-[11px] text-zinc-400 font-mono truncate">{user?.email || "user@enterprise.com"}</p>
                <div className="flex items-center gap-1 mt-1 text-[10px] text-zinc-500 font-mono">
                  <ShieldCheck className="w-3 h-3 text-zinc-400" />
                  <span>Authenticated via {user?.authProvider === "google" ? "Google SSO" : "Email Token"}</span>
                </div>
              </div>

              <div className="space-y-0.5">
                <Link
                  href="/autonomous"
                  onClick={() => setUserDropdownOpen(false)}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs text-zinc-300 hover:text-white hover:bg-zinc-900 rounded-lg transition-colors"
                >
                  <Cpu className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Autonomous AI Fleet</span>
                </Link>
                <Link
                  href="/outreach"
                  onClick={() => setUserDropdownOpen(false)}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs text-zinc-300 hover:text-white hover:bg-zinc-900 rounded-lg transition-colors"
                >
                  <Mail className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Cold Email Studio</span>
                </Link>
                <button
                  onClick={() => {
                    setUserDropdownOpen(false);
                    logout();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-950/20 rounded-lg transition-colors text-left"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Log Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
