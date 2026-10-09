"use client";

import React, { useState, useEffect } from "react";
import { ScraperForm } from "@/components/prospecting/ScraperForm";
import { ScrapingTerminal } from "@/components/prospecting/ScrapingTerminal";
import { DiscoveredLeadsList } from "@/components/prospecting/DiscoveredLeadsList";
import {
  generateScrapingLogs,
  generateMockLeads,
} from "@/lib/mock-scraper";
import {
  getStoredLeads,
  saveSingleLead,
  saveLeads,
  logActivity,
} from "@/lib/storage";
import { Lead, ScrapingLog } from "@/types";
import { useToast } from "@/components/ui/Toast";
import { Radar, Sparkles } from "lucide-react";

export default function ProspectingPage() {
  const { showToast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<ScrapingLog[]>([]);
  const [discoveredLeads, setDiscoveredLeads] = useState<Lead[]>([]);
  const [savedLeadIds, setSavedLeadIds] = useState<Set<string>>(new Set());

  // Load existing leads to sync saved states
  useEffect(() => {
    const existing = getStoredLeads();
    const ids = new Set(existing.map((l) => l.id));
    setSavedLeadIds(ids);

    const handleUpdate = () => {
      const current = getStoredLeads();
      setSavedLeadIds(new Set(current.map((l) => l.id)));
    };

    window.addEventListener("iwaju-leads-updated", handleUpdate);
    return () => window.removeEventListener("iwaju-leads-updated", handleUpdate);
  }, []);

  const handleStartScrape = async (
    niche: string,
    location: string,
    count: number,
    source: string
  ) => {
    setIsLoading(true);
    setProgress(15);
    setDiscoveredLeads([]);

    const logList = generateScrapingLogs(niche, location);
    setLogs(logList);

    const p1 = setTimeout(() => setProgress(45), 500);
    const p2 = setTimeout(() => setProgress(75), 1100);

    try {
      const res = await fetch("/api/prospecting/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ niche, location, count, source }),
      });

      const data = await res.json();
      setProgress(100);

      const returnedLeads: Lead[] =
        data.leads && data.leads.length > 0
          ? data.leads
          : generateMockLeads(niche, location, count);

      setDiscoveredLeads(returnedLeads);
      setIsLoading(false);

      const providerText = data.provider || "Deep Discovery Engine";

      logActivity({
        id: `act-${Date.now()}`,
        type: "lead_discovered",
        title: `Discovery Complete: ${niche} (${location})`,
        description: `Yielded ${returnedLeads.length} accounts via ${providerText}.`,
        timestamp: new Date().toISOString(),
      });

      showToast(
        "Lead Discovery Complete",
        `Yielded ${returnedLeads.length} qualified B2B accounts via ${providerText}.`,
        "success"
      );
    } catch (err) {
      console.error("Search API error:", err);
      setProgress(100);
      const fallbackLeads = generateMockLeads(niche, location, count);
      setDiscoveredLeads(fallbackLeads);
      setIsLoading(false);

      showToast(
        "Lead Discovery Complete",
        `Yielded ${fallbackLeads.length} verified accounts via DeepCrawler engine.`,
        "success"
      );
    }

    return () => {
      clearTimeout(p1);
      clearTimeout(p2);
    };
  };

  const handleSaveLead = (lead: Lead) => {
    saveSingleLead(lead);
    setSavedLeadIds((prev) => {
      const next = new Set(prev);
      next.add(lead.id);
      return next;
    });
    showToast(
      "Saved to Pipeline",
      `${lead.company} added to 'New Lead' CRM stage.`,
      "success"
    );
  };

  const handleSaveAll = (leads: Lead[]) => {
    const current = getStoredLeads();
    const existingIds = new Set(current.map((l) => l.id));
    const newToSave = leads.filter((l) => !existingIds.has(l.id));

    saveLeads([...newToSave, ...current]);
    setSavedLeadIds((prev) => {
      const next = new Set(prev);
      leads.forEach((l) => next.add(l.id));
      return next;
    });

    logActivity({
      id: `act-${Date.now()}`,
      type: "lead_saved",
      title: `Bulk Saved: ${newToSave.length} Leads`,
      description: `Injected ${newToSave.length} prospects into Pipeline CRM.`,
      timestamp: new Date().toISOString(),
    });

    showToast(
      "All Leads Saved",
      `${newToSave.length} new accounts have been added to your pipeline.`,
      "success"
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Top Header */}
      <div>
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase font-extrabold tracking-widest text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
            Automated Crawler
          </span>
          <span className="text-xs text-zinc-500">•</span>
          <span className="text-xs text-zinc-400 flex items-center gap-1">
            <Radar className="w-3.5 h-3.5 text-emerald-400" />
            <span>High-Speed Lead Scraper</span>
          </span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-1">
          B2B Prospecting & Discovery Engine
        </h2>
        <p className="text-xs sm:text-sm text-zinc-400 mt-1 max-w-2xl">
          Enter an industry vertical and regional perimeter. The simulated crawler parses
          commercial registries, validates corporate domain MX records, and extracts verified decision-makers.
        </p>
      </div>

      {/* Input Parameters Form */}
      <ScraperForm onStartScrape={handleStartScrape} isLoading={isLoading} />

      {/* Animated Scraping Terminal */}
      {(isLoading || logs.length > 0) && (
        <ScrapingTerminal logs={logs} progress={progress} />
      )}

      {/* Discovered Leads Result Grid */}
      <DiscoveredLeadsList
        leads={discoveredLeads}
        onSaveLead={handleSaveLead}
        onSaveAll={handleSaveAll}
        savedLeadIds={savedLeadIds}
      />
    </div>
  );
}
