"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { EmailComposer } from "@/components/outreach/EmailComposer";
import { OutreachStats } from "@/components/outreach/OutreachStats";
import { getStoredLeads, updateLeadStage } from "@/lib/storage";
import { Lead, PipelineStage } from "@/types";
import { Send, Sparkles, Mail, CheckCircle } from "lucide-react";

function OutreachContent() {
  const searchParams = useSearchParams();
  const initialLeadId = searchParams.get("leadId") || undefined;

  const [leads, setLeads] = useState<Lead[]>([]);

  useEffect(() => {
    setLeads(getStoredLeads());

    const handleUpdate = () => {
      setLeads(getStoredLeads());
    };

    window.addEventListener("iwaju-leads-updated", handleUpdate);
    return () => window.removeEventListener("iwaju-leads-updated", handleUpdate);
  }, []);

  const handleMarkContacted = (leadId: string) => {
    updateLeadStage(leadId, "contacted");
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Top Header */}
      <div>
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase font-extrabold tracking-widest text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
            Outbound Copy Engine
          </span>
          <span className="text-xs text-zinc-500">•</span>
          <span className="text-xs text-zinc-400 flex items-center gap-1">
            <Send className="w-3.5 h-3.5 text-emerald-400" />
            <span>AI Dynamic Personalization</span>
          </span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-1">
          High-Converting Cold Outreach Generator
        </h2>
        <p className="text-xs sm:text-sm text-zinc-400 mt-1 max-w-2xl">
          Transform scraped decision-maker intelligence into customized, value-driven cold emails.
          Choose proven copywriting frameworks, interpolate company & geography context, and copy or dispatch.
        </p>
      </div>

      {/* Main Email Composer */}
      {leads.length > 0 ? (
        <EmailComposer
          leads={leads}
          initialLeadId={initialLeadId}
          onMarkContacted={handleMarkContacted}
        />
      ) : (
        <div className="p-12 text-center border border-zinc-800 rounded-2xl bg-zinc-900/50">
          <p className="text-sm text-zinc-400">
            No pipeline leads available. Head over to Lead Prospecting to discover leads first.
          </p>
        </div>
      )}

      {/* Playbook and Heuristics */}
      <OutreachStats />
    </div>
  );
}

export default function OutreachPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-zinc-400 font-mono text-sm">
          Loading Outreach Engine...
        </div>
      }
    >
      <OutreachContent />
    </Suspense>
  );
}
