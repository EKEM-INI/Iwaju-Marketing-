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
  upsertLeads,
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
  const [noResults, setNoResults] = useState<{
    provider: string;
    notice: string;
    warnings: string[];
    error: string;
  } | null>(null);
  const [lastQuery, setLastQuery] = useState<{ niche: string; location: string; count: number }>({
    niche: "School",
    location: "Uyo",
    count: 6,
  });

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
    source: string,
    revealEmails: boolean
  ) => {
    setIsLoading(true);
    setProgress(15);
    setDiscoveredLeads([]);
    setNoResults(null);
    setLastQuery({ niche, location, count });

    const logList = generateScrapingLogs(niche, location);
    setLogs(logList);

    const p1 = setTimeout(() => setProgress(45), 500);
    const p2 = setTimeout(() => setProgress(75), 1100);

    try {
      const res = await fetch("/api/prospecting/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ niche, location, count, source, allowDemo: false, revealEmails }),
      });

      const data = await res.json();
      setProgress(100);

      const returnedLeads: Lead[] = Array.isArray(data.leads) ? data.leads : [];

      if (returnedLeads.length === 0) {
        // Nothing live was found, so nothing is written. The sample pool is only added when
        // someone asks for it by name - a silent swap would fill the CRM with records the
        // sender refuses to mail.
        setDiscoveredLeads([]);
        setNoResults({
          provider: data.provider || "the sourcing engine",
          notice: String(data.notice || ""),
          warnings: Array.isArray(data.warnings) ? data.warnings : [],
          error: data.success ? "" : String(data.error || "The search endpoint refused the request."),
        });
        setIsLoading(false);
        showToast(
          "No live accounts",
          "Apollo and Places returned nothing for this target, so no records were created. Read the reason on the page.",
          "info"
        );
        clearTimeout(p1);
        clearTimeout(p2);
        return;
      }

      setNoResults(null);
      setDiscoveredLeads(returnedLeads);
      setIsLoading(false);

      // Drop them straight into the shared store so the pipeline board, the
      // outreach generator and campaigns show these records without a manual save.
      const { added, merged } = upsertLeads(returnedLeads);

      const providerText = data.provider || "the discovery engine";

      logActivity({
        id: `act-${Date.now()}`,
        type: "lead_discovered",
        title: `Discovery Complete: ${niche} (${location})`,
        description: `Yielded ${returnedLeads.length} accounts via ${providerText}. ${added} new, ${merged} already on file.`,
        timestamp: new Date().toISOString(),
      });

      const withAddress = returnedLeads.filter((l) => l.email && l.emailStatus !== "unavailable").length;
      showToast(
        "Lead Discovery Complete",
        `${returnedLeads.length} accounts from ${providerText}. ${added} added, ${merged} already on file. ${withAddress} carry a real mailbox and can be mailed; the rest have no address written for them.`,
        "success"
      );
    } catch (err: any) {
      console.error("Search API error:", err);
      setProgress(100);
      setDiscoveredLeads([]);
      setNoResults({
        provider: "no engine reached",
        notice: "",
        warnings: [],
        error: `The search request failed before it completed: ${err?.message || "network error"}. No records were created.`,
      });
      setIsLoading(false);
      showToast("Discovery failed", "The search never completed. Nothing was written to the pipeline.", "error");
    }

    return () => {
      clearTimeout(p1);
      clearTimeout(p2);
    };
  };

  /**
   * The sample pool stays available, but only when someone asks for it by name. Silent substitution
   * would fill the CRM with records the sender refuses to mail.
   */
  const loadSamplePool = () => {
    const samples = generateMockLeads(lastQuery.niche, lastQuery.location, lastQuery.count);
    const { added, merged } = upsertLeads(samples);
    setDiscoveredLeads(samples);
    setNoResults(null);
    logActivity({
      id: `act-${Date.now()}`,
      type: "lead_discovered",
      title: `Sample pool loaded: ${samples.length} demo records`,
      description: `Added deliberately as demo data for ${lastQuery.niche} / ${lastQuery.location}. These are not sourced accounts and the send queue refuses them.`,
      timestamp: new Date().toISOString(),
    });
    showToast(
      "Sample pool loaded",
      `${added} demo record(s) added, ${merged} already on file. They are labelled demo and cannot be mailed from the Outbox.`,
      "info"
    );
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
    const { added, merged } = upsertLeads(leads);

    setSavedLeadIds((prev) => {
      const next = new Set(prev);
      leads.forEach((l) => next.add(l.id));
      return next;
    });

    logActivity({
      id: `act-${Date.now()}`,
      type: "lead_saved",
      title: `Bulk Saved: ${added} Leads`,
      description: `Added ${added} prospects to the pipeline; ${merged} were already on file and left untouched.`,
      timestamp: new Date().toISOString(),
    });

    showToast(
      "All Leads Saved",
      `${added} new accounts added to the pipeline. ${merged} already on file were matched, not duplicated.`,
      "success"
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Top Header */}
      <div>
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase font-extrabold tracking-widest text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
            Lead Sourcing
          </span>
          <span className="text-xs text-zinc-500">•</span>
          <span className="text-xs text-zinc-400 flex items-center gap-1">
            <Radar className="w-3.5 h-3.5 text-emerald-400" />
            <span>Apollo sources, ChatGPT judges</span>
          </span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-1">
          B2B Prospecting & Discovery Engine
        </h2>
        <p className="text-xs sm:text-sm text-zinc-400 mt-1 max-w-2xl">
          Enter an industry vertical and regional perimeter. With an Apollo key this queries the live
          Apollo database — organisations, then the decision-makers at them, with a mailbox only when you
          opt in to the paid reveal. With Google Maps configured it queries Places. If neither produces a
          match you get the reason on screen and an explicit button for bundled demo records; nothing is
          invented to fill a gap, and demo records can never be mailed.
        </p>
      </div>

      {/* Input Parameters Form */}
      <ScraperForm onStartScrape={handleStartScrape} isLoading={isLoading} />

      {/* Animated Scraping Terminal */}
      {(isLoading || logs.length > 0) && (
        <ScrapingTerminal logs={logs} progress={progress} />
      )}

      {noResults && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-2">
          <p className="text-xs font-semibold text-amber-300">
            Nothing was created for {lastQuery.niche} in {lastQuery.location}.
          </p>
          <p className="text-[11px] text-zinc-400 leading-relaxed">
            Queried through: <span className="font-mono text-zinc-300">{noResults.provider}</span>
            {noResults.notice ? ` — ${noResults.notice}` : ""}
          </p>
          {noResults.error && <p className="text-[11px] text-amber-400">{noResults.error}</p>}
          {noResults.warnings.length > 0 && (
            <ul className="text-[11px] text-zinc-400 space-y-1">
              {noResults.warnings.map((w, i) => (
                <li key={i}>• {w}</li>
              ))}
            </ul>
          )}
          <p className="text-[11px] text-zinc-500 leading-relaxed">
            A live search needs <span className="font-mono">APOLLO_API_KEY</span> on the deployment, and a mailable
            address needs the mailbox reveal, which spends Apollo credits. Neither can be filled in by a model, so
            this page leaves the pipeline exactly as it was.
          </p>
          <button
            onClick={loadSamplePool}
            className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] font-semibold border border-zinc-700"
          >
            Load bundled sample records (demo only, cannot be sent)
          </button>
        </div>
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
