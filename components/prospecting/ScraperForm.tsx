"use client";

import React, { useState, useEffect } from "react";
import {
  Search,
  MapPin,
  Briefcase,
  Zap,
  Sparkles,
  ShieldCheck,
  Layers,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

interface ScraperFormProps {
  onStartScrape: (niche: string, location: string, count: number, source: string, revealEmails: boolean) => void;
  isLoading: boolean;
}

const PRESET_NICHES = [
  "Real Estate Development",
  "Commercial Law Firms",
  "Maritime Logistics",
  "FinTech & Payments",
  "Renewable Energy & Solar",
  "Healthcare & Diagnostics",
];

const PRESET_LOCATIONS = [
  "Lagos",
  "Abuja",
  "Uyo",
  "Port Harcourt",
  "London",
  "New York",
];

export function ScraperForm({ onStartScrape, isLoading }: ScraperFormProps) {
  const [niche, setNiche] = useState("Real Estate Development");
  const [location, setLocation] = useState("Lagos");
  const [count, setCount] = useState(6);
  const [source, setSource] = useState("auto");
  const [revealEmails, setRevealEmails] = useState(true);
  const [apolloStatus, setApolloStatus] = useState<{
    configured: boolean;
    healthy: boolean;
    message: string;
    maskedKey: string | null;
  } | null>(null);
  const [servedBy, setServedBy] = useState("");

  useEffect(() => {
    fetch("/api/prospecting/status", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (data.apollo) {
          setApolloStatus(data.apollo);
        }
        if (typeof data?.servedBy === "string") setServedBy(data.servedBy);
      })
      .catch((err) => console.error("Failed to fetch API status", err));
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!niche.trim() || !location.trim()) return;
    onStartScrape(niche.trim(), location.trim(), count, source, revealEmails);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl bg-zinc-900/80 border border-zinc-800 p-6 backdrop-blur-md space-y-6 shadow-xl"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-zinc-800/80">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-emerald-400" />
              <span>Target Acquisition Parameters</span>
            </h2>

            {/* Live Apollo Integration Badge — shows the failure state too, on purpose */}
            {apolloStatus === null ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-mono text-zinc-500 px-2.5 py-0.5 rounded-full border border-zinc-800">
                <span>Checking Apollo…</span>
              </span>
            ) : apolloStatus.healthy || apolloStatus.configured ? (
              <span
                className={`inline-flex items-center gap-1 text-[11px] font-mono px-2.5 py-0.5 rounded-full border ${
                  apolloStatus.healthy
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                    : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                }`}
              >
                {apolloStatus.healthy ? (
                  <CheckCircle2 className="w-3 h-3" />
                ) : (
                  <AlertTriangle className="w-3 h-3" />
                )}
                <span>
                  {apolloStatus.healthy
                    ? `Apollo Connected (${apolloStatus.maskedKey})`
                    : `Apollo key present but rejected (${apolloStatus.maskedKey})`}
                </span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-mono bg-amber-500/10 text-amber-400 px-2.5 py-0.5 rounded-full border border-amber-500/30">
                <AlertTriangle className="w-3 h-3" />
                <span>No Apollo key in this build</span>
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Configure industry vertical and geographic perimeter to unleash the deep prospecting crawler.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Source Selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-zinc-400 font-medium">Source:</span>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="bg-zinc-950 border border-zinc-800 text-zinc-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-emerald-500 font-mono"
              disabled={isLoading}
            >
              <option value="auto">Auto (Apollo first, then Google Places)</option>
              <option value="apollo">Apollo.io Direct</option>
              <option value="google">Google Maps (Places)</option>
            </select>
          </div>

          {/* Batch Selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-zinc-400 font-medium">Yield:</span>
            <select
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="bg-zinc-950 border border-zinc-800 text-zinc-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-emerald-500 font-mono"
              disabled={isLoading}
            >
              <option value={6}>6 Leads</option>
              <option value={12}>12 Leads</option>
              <option value={25}>25 Leads</option>
              <option value={50}>50 Leads</option>
              <option value={100}>100 Leads (Bulk)</option>
            </select>
          </div>
        </div>
      </div>

      {apolloStatus && !apolloStatus.healthy && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300 leading-relaxed space-y-1">
          <p className="font-semibold text-amber-200">Apollo cannot source leads on this build right now.</p>
          <p>{apolloStatus.message}</p>
          {source !== "apollo" && (
            <p>
              Choosing <span className="font-mono">Apollo.io Direct</span> will still fail until the key works —
              it changes which engine is asked, not whether the engine has credentials.
            </p>
          )}
          {servedBy && (
            <p className="text-[11px] text-amber-400/80">
              Answered by <span className="font-mono">{servedBy}</span> — that is the build whose environment this
              screen is talking to.
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Niche Input */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
            <Briefcase className="w-3.5 h-3.5 text-emerald-400" />
            <span>Target Industry / Niche</span>
          </label>
          <div className="relative">
            <input
              type="text"
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              placeholder="e.g. Real Estate, Law Firms, FinTech, Logistics"
              className="w-full bg-zinc-950/90 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
              disabled={isLoading}
              required
            />
          </div>

          {/* Quick preset niche pills */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {PRESET_NICHES.map((item) => (
              <button
                type="button"
                key={item}
                onClick={() => setNiche(item)}
                className={`text-[11px] px-2.5 py-1 rounded-lg border transition-colors ${
                  niche === item
                    ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                    : "bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700"
                }`}
                disabled={isLoading}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        {/* Location Input */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-emerald-400" />
            <span>Target Market / Geography</span>
          </label>
          <div className="relative">
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Lagos, Abuja, Uyo, London, New York"
              className="w-full bg-zinc-950/90 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
              disabled={isLoading}
              required
            />
          </div>

          {/* Quick preset location pills */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {PRESET_LOCATIONS.map((loc) => (
              <button
                type="button"
                key={loc}
                onClick={() => setLocation(loc)}
                className={`text-[11px] px-2.5 py-1 rounded-lg border transition-colors ${
                  location === loc
                    ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                    : "bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700"
                }`}
                disabled={isLoading}
              >
                {loc}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-2">
        <label className="flex items-start gap-2 cursor-pointer flex-1">
          <input
            type="checkbox"
            checked={revealEmails}
            onChange={(e) => setRevealEmails(e.target.checked)}
            className="mt-0.5 accent-emerald-500"
          />
          <span className="text-[11px] text-zinc-400 leading-relaxed">
            <span className="text-zinc-200 font-medium">Reveal mailboxes and direct lines.</span> Apollo returns
            companies and people free of charge; where its search already releases an address, that comes back without
            cost. Anything it withholds is purchased here at 1–9 Apollo credits per contact, with phone numbers billed
            on top — and a value is only written when Apollo genuinely holds one. Switch this off to browse without
            spending; on gives records the Outbox can actually mail.
          </span>
        </label>
        <button
          type="submit"
          disabled={isLoading}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl bg-primary hover:bg-primary-hover text-primary-foreground font-medium text-sm shadow-glow hover:shadow-glow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Zap className="w-4 h-4 fill-current stroke-[2.5]" />
          <span>{isLoading ? "Querying Discovery Engines..." : "Execute Lead Discovery Radar"}</span>
        </button>
      </div>
    </form>
  );
}
