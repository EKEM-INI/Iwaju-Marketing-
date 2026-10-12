"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Megaphone, Plus, LayoutGrid, ListChecks } from "lucide-react";
import type { Campaign, CampaignTouch, Lead } from "@/types";
import {
  CAMPAIGNS_UPDATED_EVENT,
  TOUCHES_UPDATED_EVENT,
  loadCampaigns,
  loadTouches,
  removeCampaignArtifacts,
  saveCampaigns,
  saveTouches,
} from "@/lib/campaigns";
import { LEADS_UPDATED_EVENT, getStoredLeads, updateLeadStage } from "@/lib/storage";
import { loadConsentStore, type OutboundChannel } from "@/lib/consent";
import { CampaignDashboard } from "@/components/campaign/CampaignDashboard";
import { CampaignDetail } from "@/components/campaign/CampaignDetail";
import { NewCampaignForm } from "@/components/campaign/NewCampaignForm";

type View = "dashboard" | "list";

export default function CampaignsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [touches, setTouches] = useState<CampaignTouch[]>([]);
  const [consent, setConsent] = useState<Record<string, Partial<Record<OutboundChannel, any>>>>({});
  const [view, setView] = useState<View>("dashboard");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const refresh = () => {
    setLeads(getStoredLeads());
    setCampaigns(loadCampaigns());
    setTouches(loadTouches());
    setConsent(loadConsentStore());
  };

  useEffect(() => {
    refresh();
    window.addEventListener(LEADS_UPDATED_EVENT, refresh);
    window.addEventListener(CAMPAIGNS_UPDATED_EVENT, refresh);
    window.addEventListener(TOUCHES_UPDATED_EVENT, refresh);
    return () => {
      window.removeEventListener(LEADS_UPDATED_EVENT, refresh);
      window.removeEventListener(CAMPAIGNS_UPDATED_EVENT, refresh);
      window.removeEventListener(TOUCHES_UPDATED_EVENT, refresh);
    };
  }, []);

  const selected = useMemo(() => campaigns.find((c) => c.id === selectedId) || null, [campaigns, selectedId]);

  const updateCampaign = (next: Campaign) => {
    saveCampaigns(campaigns.map((c) => (c.id === next.id ? next : c)));
  };

  const deleteCampaign = (campaignId: string) => {
    const cleaned = removeCampaignArtifacts(campaignId, loadCampaigns(), loadTouches());
    saveCampaigns(cleaned.campaigns);
    saveTouches(cleaned.touches);
    if (selectedId === campaignId) setSelectedId(null);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase font-extrabold tracking-widest text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              Campaign Control
            </span>
            <span className="text-xs text-zinc-500">•</span>
            <span className="text-xs text-zinc-400 flex items-center gap-1">
              <Megaphone className="w-3.5 h-3.5 text-emerald-400" />
              <span>Sequenced follow-ups over the CRM you already have</span>
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-1">Outbound Campaigns</h2>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1 max-w-2xl">
            Build a sequence, put pipeline contacts into it, and keep the follow-up clock. Nothing here sends anything: it hands a draft to your own
            mail app or dialler, then counts only the touches you record.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-xl border border-zinc-800">
            <button
              type="button"
              onClick={() => {
                setView("dashboard");
                setSelectedId(null);
              }}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                view === "dashboard" ? "bg-zinc-800 text-white shadow-glow" : "text-zinc-400 hover:text-white"
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" /> Dashboard
            </button>
            <button
              type="button"
              onClick={() => setView("list")}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                view === "list" ? "bg-zinc-800 text-white shadow-glow" : "text-zinc-400 hover:text-white"
              }`}
            >
              <ListChecks className="w-3.5 h-3.5" /> Campaigns ({campaigns.length})
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              setCreating(true);
              setView("list");
              setSelectedId(null);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-primary-foreground font-medium text-xs shadow-glow transition-all"
          >
            <Plus className="w-4 h-4" /> New campaign
          </button>
        </div>
      </div>

      {creating && (
        <NewCampaignForm
          leads={leads}
          consent={consent}
          onLeadsSaved={(next) => setLeads(next)}
          onCancel={() => setCreating(false)}
          onCreated={(campaign) => {
            setCreating(false);
            setSelectedId(campaign.id);
            setView("list");
          }}
        />
      )}

      {view === "dashboard" && !creating && (
        <CampaignDashboard
          campaigns={campaigns}
          leads={leads}
          touches={touches}
          onOpen={(id) => {
            setSelectedId(id);
            setView("list");
          }}
        />
      )}

      {view === "list" && !creating && !selected && (
        <div className="space-y-3">
          {campaigns.length === 0 && (
            <div className="p-10 text-center border border-zinc-800 rounded-2xl bg-zinc-900/50">
              <p className="text-sm text-zinc-400">No campaigns yet. Use "New campaign" to sequence the contacts already in your pipeline.</p>
            </div>
          )}
          {campaigns.map((c) => {
            const count = c.leadIds.length;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedId(c.id)}
                className="w-full text-left rounded-2xl border border-zinc-800 bg-zinc-900/40 hover:border-zinc-700 p-4 flex flex-wrap items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white truncate">{c.name}</p>
                  <p className="text-[11px] text-zinc-500 truncate">{c.purpose || "no purpose recorded"}</p>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-zinc-400 shrink-0">
                  <span>{count} contacts</span>
                  <span>{c.steps.length} steps</span>
                  <span className="px-2 py-0.5 rounded border border-zinc-700 uppercase text-[10px] tracking-wide">{c.status}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {view === "list" && !creating && selected && (
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => setSelectedId(null)}
            className="text-xs text-zinc-500 hover:text-white"
          >
            &larr; All campaigns
          </button>
          <CampaignDetail
            campaign={selected}
            leads={leads}
            touches={touches}
            consent={consent}
            onChange={updateCampaign}
            onLeadsSaved={(next) => setLeads(next)}
            onTouchesChanged={setTouches}
            onDelete={deleteCampaign}
            onStageChange={(leadId) => setLeads(updateLeadStage(leadId, "contacted"))}
          />
        </div>
      )}
    </div>
  );
}
