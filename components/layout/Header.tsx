"use client";

import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Plus, LogOut, Mail, Cpu, Zap } from "lucide-react";
import { getStoredLeads } from "@/lib/storage";
import { formatCurrency } from "@/lib/utils";
import { useAuth } from "@/components/auth/AuthContext";

interface HeaderProps {
  onMobileMenuToggle: () => void;
}

const PAGE_TITLES: Record<string, string> = {
  "/": "Command Center",
  "/autonomous": "Autonomous Agent Fleet",
  "/prospecting": "Lead Prospecting",
  "/pipeline": "Pipeline CRM",
  "/outreach": "Outreach Engine",
};

function initials(name?: string, email?: string): string {
  const source = name || email?.split("@")[0] || "";
  return (
    source
      .split(/[\s._-]+/)
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "U"
  );
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

  const title = PAGE_TITLES[pathname] ?? "Iwaju Outbound";

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-background px-3 select-none">
      <div className="flex min-w-0 shrink-0 items-center gap-1">
        <button
          onClick={onMobileMenuToggle}
          className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:hidden"
          aria-label="Open navigation menu"
        >
          <Menu className="size-4" />
        </button>
        <Link
          href="/"
          aria-label="Homepage"
          className="hidden size-8 items-center justify-center text-foreground md:flex"
        >
          <Zap className="size-5 fill-current" />
        </Link>
        <span className="mx-1 h-5 w-px bg-transparent" />
        <span className="truncate text-sm font-medium">Iwaju CRM</span>
        <span className="hidden text-sm text-muted-foreground sm:inline">/</span>
        <span className="hidden truncate text-sm text-muted-foreground sm:inline">{title}</span>
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-1.5">
        {/* Global pipeline metrics */}
        <div className="hidden items-center gap-3 rounded-md border border-border bg-card px-3 py-1 font-mono text-xs md:flex">
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">Leads</span>
            <span className="font-medium text-foreground">{leadCount}</span>
          </div>
          <div className="h-3 w-px bg-border" />
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">Pipeline</span>
            <span className="font-medium text-foreground">{formatCurrency(pipelineTotal)}</span>
          </div>
        </div>

        {/* Quick launch */}
        <Link
          href="/prospecting"
          className="hidden h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary-hover xl:inline-flex"
        >
          <Plus className="size-3.5" />
          <span>New Search</span>
        </Link>

        {/* Account menu */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setUserDropdownOpen(!userDropdownOpen)}
            className="inline-flex size-8 items-center justify-center rounded-md"
            aria-label="Account menu"
            aria-expanded={userDropdownOpen}
          >
            <span className="flex size-7 items-center justify-center rounded-full bg-muted text-xs font-medium text-foreground">
              {initials(user?.name, user?.email)}
            </span>
          </button>

          {userDropdownOpen && (
            <div className="absolute right-0 z-50 mt-2 min-w-56 rounded-md border border-border bg-popover p-1 shadow-lg animate-in fade-in zoom-in-95 duration-150">
              <div className="px-2 py-1.5">
                <p className="truncate text-sm font-medium text-foreground">
                  {user?.name || "Executive User"}
                </p>
                <p className="truncate font-mono text-xs text-muted-foreground">
                  {user?.email || "user@enterprise.com"}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Signed in via {user?.provider === "google" ? "Google SSO" : "Email token"}
                </p>
              </div>
              <div className="my-1 h-px bg-border" />
              <Link
                href="/autonomous"
                onClick={() => setUserDropdownOpen(false)}
                className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-foreground transition-colors hover:bg-accent"
              >
                <Cpu className="size-4 text-muted-foreground" />
                <span>Autonomous AI Fleet</span>
              </Link>
              <Link
                href="/outreach"
                onClick={() => setUserDropdownOpen(false)}
                className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-foreground transition-colors hover:bg-accent"
              >
                <Mail className="size-4 text-muted-foreground" />
                <span>Cold Email Studio</span>
              </Link>
              <div className="my-1 h-px bg-border" />
              <button
                onClick={() => {
                  setUserDropdownOpen(false);
                  logout();
                }}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-accent"
              >
                <LogOut className="size-4 text-muted-foreground" />
                <span>Sign out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
