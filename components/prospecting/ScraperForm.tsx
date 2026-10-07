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
} from "lucide-react";

interface ScraperFormProps {
  onStartScrape: (niche: string, location: string, count: number, source: string) => void;
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
  const [apolloStatus, setApolloStatus] = useState<{
    configured: boolean;
    healthy: boolean;
    maskedKey: string | null;
  } | null>(null);

  useEffect(() => {
    fetch("/api/prospecting/status")
      .then((res) => res.json())
      .then((data) => {
        if (data.apollo) {
          setApolloStatus(data.apollo);
        }
      })
      .catch((err) => console.error("Failed to fetch API status", err));
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!niche.trim() || !location.trim()) return;
    onStartScrape(niche.trim(), location.trim(), count, source);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl bg-slate-900/80 border border-slate-800 p-6 backdrop-blur-md space-y-6 shadow-xl"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-emerald-400" />
              <span>Target Acquisition Parameters</span>
            </h2>

            {/* Live Apollo Integration Badge */}
            {apolloStatus?.configured && (
              <span className="inline-flex items-center gap-1 text-[11px] font-mono bg-emerald-500/10 text-emerald-400 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                <span>Apollo Connected ({apolloStatus.maskedKey})</span>
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Configure industry vertical and geographic perimeter to unleash the deep prospecting crawler.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Source Selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-400 font-medium">Source:</span>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-emerald-500 font-mono"
              disabled={isLoading}
            >
              <option value="auto">Auto-Cascade (Apollo + Radar)</option>
              <option value="apollo">Apollo.io Direct</option>
              <option value="google">Google Maps (Places)</option>
            </select>
          </div>

          {/* Batch Selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-400 font-medium">Yield:</span>
            <select
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-emerald-500 font-mono"
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Niche Input */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Briefcase className="w-3.5 h-3.5 text-emerald-400" />
            <span>Target Industry / Niche</span>
          </label>
          <div className="relative">
            <input
              type="text"
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              placeholder="e.g. Real Estate, Law Firms, FinTech, Logistics"
              className="w-full bg-slate-950/90 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
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
                    : "bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700"
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
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-emerald-400" />
            <span>Target Market / Geography</span>
          </label>
          <div className="relative">
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Lagos, Abuja, Uyo, London, New York"
              className="w-full bg-slate-950/90 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
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
                    : "bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700"
                }`}
                disabled={isLoading}
              >
                {loc}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={isLoading}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 font-bold text-sm tracking-wide shadow-glow hover:shadow-glow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Zap className="w-4 h-4 fill-current stroke-[2.5]" />
          <span>{isLoading ? "Querying Discovery Engines..." : "Execute Lead Discovery Radar"}</span>
        </button>
      </div>
    </form>
  );
}
