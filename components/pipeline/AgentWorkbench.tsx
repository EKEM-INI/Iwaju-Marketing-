"use client";

import { scopeKey } from "@/lib/account-scope";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  Bot,
  CalendarClock,
  ExternalLink,
  PhoneCall,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Undo2,
} from "lucide-react";
import type {
  AccountBrief,
  AgentEnvelope,
  EvidenceResearchResult,
  Lead,
  NextBestAction,
  PipelineForecast,
  ResolvedClaim,
  SignalScanResult,
} from "@/types";
import type { EvidenceCounts, FitSignals } from "@/lib/icp";
import { factsFromLead } from "@/lib/outreach-facts";
import { decideChannel, loadConsentStore, recordConsent, saveConsentStore, CONSENT_VALID_DAYS, type OutboundChannel } from "@/lib/consent";
import type { ConsentRecord } from "@/types";
import { saveLeads } from "@/lib/storage";
import { useToast } from "@/components/ui/Toast";

const SIGNALS_KEY = "iwaju_signals_v1";
const FORECAST_KEY = "iwaju_forecast_v1";

type Tab = "signals" | "evidence" | "brief" | "actions" | "forecast" | "channels";

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "signals", label: "Buying signals", icon: Activity },
  { id: "evidence", label: "Evidence research", icon: Search },
  { id: "brief", label: "Pre-call brief", icon: CalendarClock },
  { id: "actions", label: "Next best action", icon: Bot },
  { id: "forecast", label: "Forecast & risk", icon: BarChart3 },
  { id: "channels", label: "Reachability", icon: PhoneCall },
];

interface Props {
  leads: Lead[];
  evidenceByLead: Map<string, EvidenceCounts>;
  onSignals: (map: Map<string, FitSignals>) => void;
  onLeadsSaved: (leads: Lead[]) => void;
}

async function callAgent<T>(url: string, payload: unknown): Promise<AgentEnvelope<T>> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return (await res.json()) as AgentEnvelope<T>;
}

function StatusLine({ envelope }: { envelope: AgentEnvelope<any> | null }) {
  if (!envelope) return null;
  const tone = envelope.success
    ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/5"
    : envelope.status === "no_key"
      ? "text-amber-400 border-amber-500/30 bg-amber-500/5"
      : "text-red-400 border-red-500/30 bg-red-500/5";
  return (
    <p className={`text-[10px] font-mono leading-relaxed px-2.5 py-1.5 rounded-lg border ${tone}`}>
      <span className="uppercase tracking-wider">{envelope.agent}</span> · {envelope.provider} ·{" "}
      {envelope.live ? "model answered" : envelope.success ? "rules only, no model" : `refused (${envelope.status})`}
      {(envelope.note || envelope.error) && <span className="block text-zinc-300 font-sans mt-0.5">{envelope.error || envelope.note}</span>}
    </p>
  );
}

export function AgentWorkbench({ leads, evidenceByLead, onSignals, onLeadsSaved }: Props) {
  const { showToast } = useToast();
  const [tab, setTab] = useState<Tab>("signals");
  const [selectedId, setSelectedId] = useState<string>("");
  const [busy, setBusy] = useState<Tab | null>(null);
  const [envelopes, setEnvelopes] = useState<Partial<Record<Tab, AgentEnvelope<any>>>>({});
  const [scans, setScans] = useState<SignalScanResult[]>([]);
  const [research, setResearch] = useState<EvidenceResearchResult | null>(null);
  const [brief, setBrief] = useState<AccountBrief | null>(null);
  const [actions, setActions] = useState<NextBestAction[]>([]);
  const [forecast, setForecast] = useState<PipelineForecast | null>(null);
  const [target, setTarget] = useState<string>("");
  const [consent, setConsent] = useState<Record<string, Partial<Record<OutboundChannel, ConsentRecord>>>>({});
  const [undoStack, setUndoStack] = useState<Lead[][]>([]);

  useEffect(() => {
    try {
      const rawSignals = localStorage.getItem(scopeKey(SIGNALS_KEY));
      if (rawSignals) {
        const parsed = JSON.parse(rawSignals);
        setScans(Array.isArray(parsed?.scans) ? parsed.scans : []);
      }
      const rawForecast = localStorage.getItem(scopeKey(FORECAST_KEY));
      if (rawForecast) setForecast(JSON.parse(rawForecast));
      setConsent(loadConsentStore());
    } catch {
      // corrupt or unavailable storage: the panels simply start empty
    }
  }, []);

  // Stored signal scans feed the ICP scorer; a scan that found nothing publishes nothing.
  const signalsMap = useMemo(() => {
    const map = new Map<string, FitSignals>();
    scans.forEach((scan) => {
      const lead = leads.find((l) => (l.company || l.name) === scan.account);
      if (!lead) return;
      map.set(String(lead.id), {
        hiringPosts: scan.hiringPosts,
        fundingEvents: scan.fundingEvents,
        techStack: scan.techStack,
      });
    });
    return map;
  }, [scans, leads]);

  useEffect(() => {
    onSignals(signalsMap);
  }, [signalsMap, onSignals]);

  const selected = useMemo(
    () => leads.find((l) => String(l.id) === String(selectedId)) || leads[0] || null,
    [leads, selectedId]
  );

  const scanFor = (lead: Lead | null): SignalScanResult | null => {
    if (!lead) return null;
    return scans.find((s) => s.account === (lead.company || lead.name)) || null;
  };

  const consentForLead = (channel: OutboundChannel): ConsentRecord | undefined =>
    selected ? consent[String(selected.id)]?.[channel] : undefined;

  const runSignals = useCallback(async () => {
    setBusy("signals");
    try {
      const envelope = await callAgent<SignalScanResult[]>("/api/signals/monitor", { leads });
      setEnvelopes((prev) => ({ ...prev, signals: envelope }));
      if (envelope.success && envelope.data) {
        setScans(envelope.data);
        localStorage.setItem(scopeKey(SIGNALS_KEY), JSON.stringify({ runAt: envelope.ranAt, scans: envelope.data }));
      }
    } catch (err: any) {
      setEnvelopes((prev) => ({ ...prev, signals: { success: false, agent: "Buying-Signal Monitor", status: "provider_error", provider: "none", live: false, ranAt: new Date().toISOString(), error: `Could not reach the agent: ${err?.message}` } }));
    } finally {
      setBusy(null);
    }
  }, [leads]);

  const runResearch = useCallback(async () => {
    if (!selected) return;
    setBusy("evidence");
    try {
      const envelope = await callAgent<EvidenceResearchResult>("/api/evidence/research", { lead: selected });
      setEnvelopes((prev) => ({ ...prev, evidence: envelope }));
      if (envelope.success && envelope.data) setResearch(envelope.data);
    } catch (err: any) {
      setEnvelopes((prev) => ({ ...prev, evidence: { success: false, agent: "Evidence Research Agent", status: "provider_error", provider: "none", live: false, ranAt: new Date().toISOString(), error: `Could not reach the agent: ${err?.message}` } }));
    } finally {
      setBusy(null);
    }
  }, [selected]);

  const runBrief = useCallback(async () => {
    if (!selected) return;
    setBusy("brief");
    try {
      const facts = factsFromLead(selected).map((f) => ({ id: f.id, field: f.field, value: f.value, source: f.source, verified: f.approvedByDefault }));
      const envelope = await callAgent<AccountBrief>("/api/accounts/brief", {
        lead: selected,
        evidence: evidenceByLead.get(String(selected.id)),
        signals: scanFor(selected),
        claims: research?.claims ?? [],
        facts,
      });
      setEnvelopes((prev) => ({ ...prev, brief: envelope }));
      if (envelope.success && envelope.data) setBrief(envelope.data);
    } catch (err: any) {
      setEnvelopes((prev) => ({ ...prev, brief: { success: false, agent: "Account Brief Agent", status: "provider_error", provider: "none", live: false, ranAt: new Date().toISOString(), error: `Could not reach the agent: ${err?.message}` } }));
    } finally {
      setBusy(null);
    }
  }, [selected, evidenceByLead, research, scans]);

  const runActions = useCallback(async () => {
    setBusy("actions");
    try {
      const evidencePayload: Record<string, EvidenceCounts> = {};
      evidenceByLead.forEach((value, key) => {
        evidencePayload[key] = value;
      });
      const signalsPayload: Record<string, any> = {};
      scans.forEach((scan) => {
        const lead = leads.find((l) => (l.company || l.name) === scan.account);
        if (lead) {
          signalsPayload[String(lead.id)] = {
            momentumScore: scan.momentumScore,
            hiringPosts: scan.hiringPosts,
            fundingEvents: scan.fundingEvents,
            techStack: scan.techStack,
          };
        }
      });
      const envelope = await callAgent<NextBestAction[]>("/api/accounts/next-action", {
        leads,
        evidenceByLead: evidencePayload,
        consentByLead: consent,
        signalsByLead: signalsPayload,
      });
      setEnvelopes((prev) => ({ ...prev, actions: envelope }));
      if (envelope.success && envelope.data) setActions(envelope.data);
    } finally {
      setBusy(null);
    }
  }, [leads, evidenceByLead, consent, scans]);

  const runForecast = useCallback(async () => {
    setBusy("forecast");
    try {
      const evidencePayload: Record<string, EvidenceCounts> = {};
      evidenceByLead.forEach((value, key) => {
        evidencePayload[key] = value;
      });
      const envelope = await callAgent<PipelineForecast>("/api/forecast/pipeline", {
        leads,
        evidenceByLead: evidencePayload,
        consentByLead: consent,
        target: target ? Number(target) : undefined,
      });
      setEnvelopes((prev) => ({ ...prev, forecast: envelope }));
      if (envelope.success && envelope.data) {
        setForecast(envelope.data);
        localStorage.setItem(scopeKey(FORECAST_KEY), JSON.stringify(envelope.data));
      }
    } finally {
      setBusy(null);
    }
  }, [leads, evidenceByLead, consent, target]);

  const applyClaim = (claim: ResolvedClaim) => {
    if (!selected || claim.disposition !== "write") return;
    const snapshot = leads.map((l) => ({ ...l }));
    let updated: Lead[];
    if (claim.field === "email") {
      updated = leads.map((l) => (String(l.id) === String(selected.id) ? { ...l, email: claim.value } : l));
    } else if (claim.field === "website") {
      updated = leads.map((l) => (String(l.id) === String(selected.id) ? { ...l, website: claim.value } : l));
    } else if (claim.field === "summary" || claim.field === "niche") {
      updated = leads.map((l) =>
        String(l.id) === String(selected.id)
          ? { ...l, notes: `${l.notes ? `${l.notes}\n` : ""}[researched] ${claim.value}` }
          : l
      );
    } else {
      updated = leads.map((l) =>
        String(l.id) === String(selected.id)
          ? { ...l, notes: `${l.notes ? `${l.notes}\n` : ""}[researched ${claim.field}] ${claim.value}` }
          : l
      );
    }
    saveLeads(updated);
    onLeadsSaved(updated);
    setUndoStack((prev) => [...prev, snapshot]);
    showToast("Claim written", `${claim.field} updated on ${selected.company}. Undo is in this panel.`, "success");
  };

  const undoLastClaim = () => {
    const snapshot = undoStack[undoStack.length - 1];
    if (!snapshot) return;
    saveLeads(snapshot);
    onLeadsSaved(snapshot);
    setUndoStack((prev) => prev.slice(0, -1));
    showToast("Record restored", "The last researched value was rolled back.", "info");
  };

  const toggleConsent = (channel: OutboundChannel, granted: boolean) => {
    if (!selected) return;
    const next = recordConsent(consent, String(selected.id), channel, granted, granted ? "rep recorded it in the app" : "rep withdrew it");
    setConsent(next);
    saveConsentStore(next);
    showToast(
      granted ? "Consent recorded" : "Consent withdrawn",
      granted
        ? `${channel} is now proposed for ${selected.company || selected.name}. Valid ${CONSENT_VALID_DAYS} days, then it must be given again.`
        : `${channel} is closed for this record until they say yes again.`,
      "info"
    );
  };

  const citedSignals = scans.reduce((n, s) => n + s.citedCount, 0);
  const uncitedSignals = scans.reduce((n, s) => n + s.uncitedCount, 0);

  return (
    <div className="bg-[#09090b] border border-[#27272a] rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-[#18181b] flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="flex-1">
          <h2 className="text-xs font-semibold text-white font-mono uppercase tracking-wider flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            Account agents
          </h2>
          <p className="text-[11px] text-zinc-400">
            Six agents over the {leads.length} stored record(s). Each panel says which provider answered, and refuses
            rather than filling a gap with invented data. None of them sends anything.
          </p>
        </div>
        {leads.length > 0 && (
          <select
            value={selected ? String(selected.id) : ""}
            onChange={(e) => setSelectedId(e.target.value)}
            className="bg-[#18181b] border border-[#27272a] rounded-lg px-2.5 py-1.5 text-[11px] text-white focus:outline-none"
            aria-label="Account the agents work on"
          >
            {leads.map((lead) => (
              <option key={lead.id} value={lead.id}>
                {lead.company || lead.name || lead.id}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="flex flex-wrap gap-1 px-3 pt-3 border-b border-[#18181b]">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-2.5 py-1.5 rounded-t-lg text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
              tab === id ? "bg-[#18181b] text-white" : "text-zinc-500 hover:text-zinc-200"
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      <div className="p-4 space-y-3">
        {/* BUYING SIGNALS */}
        {tab === "signals" && (
          <div className="space-y-2.5">
            <div className="flex items-center gap-2">
              <button
                onClick={runSignals}
                disabled={busy !== null || leads.length === 0}
                className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-emerald-500/40 text-white text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
              >
                {busy === "signals" ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Activity className="w-3.5 h-3.5 text-emerald-400" />}
                <span>{busy === "signals" ? "Searching..." : "Scan for buying signals"}</span>
              </button>
              <span className="text-[10px] font-mono text-zinc-500">
                {scans.length > 0 ? `${scans.length} account(s), ${citedSignals} cited / ${uncitedSignals} uncited signal(s)` : "Never run"}
              </span>
            </div>
            <StatusLine envelope={envelopes.signals ?? null} />
            {scans.length > 0 && (
              <ul className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
                {scans.map((scan) => (
                  <li key={`${scan.account}-${scan.domain}`} className="border border-[#18181b] rounded-lg bg-[#050505] px-3 py-2 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-zinc-200 flex-1 truncate">{scan.account}</span>
                      <span className="text-[10px] font-mono text-zinc-600">{scan.domain || "no domain"}</span>
                      <span className="text-[10px] font-mono text-emerald-400">momentum {scan.momentumScore}</span>
                    </div>
                    {scan.signals.length === 0 ? (
                      <p className="text-[10px] text-zinc-500">Nothing recent found. That is the honest result, not a zero score.</p>
                    ) : (
                      scan.signals.map((signal) => (
                        <div key={signal.id} className="flex items-start gap-2 text-[10px]">
                          <span
                            className={`font-mono uppercase shrink-0 ${
                              signal.status === "cited" ? "text-emerald-400" : "text-amber-400"
                            }`}
                          >
                            {signal.kind}
                          </span>
                          <span className="text-zinc-400 flex-1">
                            {signal.summary}
                            {signal.withinDays !== null ? ` · ${signal.withinDays}d old` : ""}
                          </span>
                          {signal.sourceUri ? (
                            <a
                              href={signal.sourceUri}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-zinc-500 hover:text-emerald-400 flex items-center gap-1 shrink-0"
                            >
                              {signal.sourceDomain}
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : (
                            <span className="text-[9px] font-mono text-amber-500 shrink-0">uncited · weight 0</span>
                          )}
                        </div>
                      ))
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* EVIDENCE RESEARCH */}
        {tab === "evidence" && (
          <div className="space-y-2.5">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={runResearch}
                disabled={busy !== null || !selected}
                className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-emerald-500/40 text-white text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
              >
                {busy === "evidence" ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5 text-emerald-400" />}
                <span>{busy === "evidence" ? "Researching..." : "Research this account"}</span>
              </button>
              {undoStack.length > 0 && (
                <button
                  onClick={undoLastClaim}
                  className="px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-300 text-[10px] font-semibold flex items-center gap-1 cursor-pointer hover:text-white"
                >
                  <Undo2 className="w-3 h-3" /> Undo last write ({undoStack.length})
                </button>
              )}
            </div>
            <StatusLine envelope={envelopes.evidence ?? null} />
            {research && (
              <div className="space-y-2">
                <p className="text-[10px] font-mono text-zinc-500">
                  Searches run: {research.searchQueriesRun.join(" · ") || "the model did not report its queries"}
                </p>
                <ul className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
                  {research.claims.map((claim, index) => (
                    <li key={`${claim.field}-${index}`} className="border border-[#18181b] rounded-lg bg-[#050505] px-3 py-2 space-y-1">
                      <div className="flex items-start gap-2">
                        <span
                          className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded shrink-0 ${
                            claim.state === "supported"
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                              : claim.state === "contradicted"
                                ? "bg-red-500/10 text-red-400 border border-red-500/30"
                                : "bg-zinc-800 text-zinc-400 border border-zinc-700"
                          }`}
                        >
                          {claim.state}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] text-zinc-200">
                            <span className="font-mono text-zinc-500">{claim.field}</span> · {claim.value || claim.claim}
                          </p>
                          <p className="text-[10px] text-zinc-500">{claim.rationale}</p>
                          <p className="text-[10px] font-mono text-zinc-600">
                            {claim.privacy} · confidence {Math.round(claim.confidence * 100)}% ·{" "}
                            {claim.freshnessDays !== null ? `${claim.freshnessDays}d fresh` : "no date on the source"} ·{" "}
                            write gate {claim.autoApplyAllowed ? "open" : "locked"}
                          </p>
                          <div className="flex flex-wrap gap-2 pt-1">
                            {claim.sources.map((source) => (
                              <a
                                key={source.uri}
                                href={source.uri}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] text-zinc-400 hover:text-emerald-400 flex items-center gap-1"
                              >
                                <ExternalLink className="w-3 h-3" />
                                {source.title || new URL(source.uri).hostname}
                              </a>
                            ))}
                          </div>
                        </div>
                        <button
                          onClick={() => applyClaim(claim)}
                          disabled={claim.disposition !== "write"}
                          title={
                            claim.disposition === "write"
                              ? "Writes this value into the record. Nothing is sent anywhere."
                              : "Locked: this claim has not passed the evidence rule for a high-impact field."
                          }
                          className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-[10px] font-semibold text-zinc-100 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                        >
                          {claim.disposition === "write" ? "Apply" : claim.disposition === "reject" ? "Rejected" : "Review only"}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
                {research.questionsWorthAsking.length > 0 && (
                  <div className="border border-[#18181b] rounded-lg bg-[#050505] px-3 py-2">
                    <p className="text-[10px] font-mono uppercase text-zinc-500">Public evidence runs out here</p>
                    <ul className="list-disc list-inside text-[11px] text-zinc-400 mt-1 space-y-0.5">
                      {research.questionsWorthAsking.map((q, i) => (
                        <li key={i}>{q}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* PRE-CALL BRIEF */}
        {tab === "brief" && (
          <div className="space-y-2.5">
            <button
              onClick={runBrief}
              disabled={busy !== null || !selected}
              className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-emerald-500/40 text-white text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
            >
              {busy === "brief" ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CalendarClock className="w-3.5 h-3.5 text-emerald-400" />}
              <span>{busy === "brief" ? "Assembling..." : "Build the pre-call brief"}</span>
            </button>
            <StatusLine envelope={envelopes.brief ?? null} />
            {brief && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
                <div className="space-y-2">
                  <Block title="Snapshot" lines={brief.snapshot} tone="zinc" />
                  <Block title="What we know" lines={brief.whatWeKnow} tone="emerald" />
                  <Block title="What is unproven" lines={brief.whatIsUnproven} tone="amber" />
                </div>
                <div className="space-y-2">
                  <Block title="Why now" lines={[brief.whyNow]} tone="zinc" />
                  <Block title="Risks" lines={brief.risks} tone="red" />
                  <Block title="Ask them" lines={brief.openQuestions} tone="zinc" />
                  <Block title="Call plan" lines={brief.callPlan} tone="emerald" />
                  <Block title="Next step" lines={[brief.suggestedNextStep]} tone="zinc" />
                </div>
              </div>
            )}
          </div>
        )}

        {/* NEXT BEST ACTION */}
        {tab === "actions" && (
          <div className="space-y-2.5">
            <button
              onClick={runActions}
              disabled={busy !== null || leads.length === 0}
              className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-emerald-500/40 text-white text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
            >
              {busy === "actions" ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Bot className="w-3.5 h-3.5 text-emerald-400" />}
              <span>{busy === "actions" ? "Reading records..." : "Rank next actions"}</span>
            </button>
            <StatusLine envelope={envelopes.actions ?? null} />
            <ul className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
              {actions.map((action) => (
                <li key={`${action.leadId}-${action.action}`} className="border border-[#18181b] rounded-lg bg-[#050505] px-3 py-2">
                  <div className="flex items-start gap-2">
                    <span className="text-[11px] text-zinc-200 flex-1">
                      <span className="font-semibold text-white">{action.company}</span> — {action.action}
                    </span>
                    <span className="text-[10px] font-mono text-zinc-500 shrink-0">{action.effortMinutes} min</span>
                  </div>
                  <p className="text-[10px] text-zinc-500 mt-0.5">{action.why}</p>
                  <p className="text-[10px] font-mono text-zinc-600 mt-0.5">
                    {action.effect} {action.reversible ? "· reversible" : "· not reversible"}
                    {action.blockedBy ? ` · blocked by ${action.blockedBy}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* FORECAST */}
        {tab === "forecast" && (
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={runForecast}
                disabled={busy !== null || leads.length === 0}
                className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-emerald-500/40 text-white text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
              >
                {busy === "forecast" ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <BarChart3 className="w-3.5 h-3.5 text-emerald-400" />}
                <span>{busy === "forecast" ? "Adding..." : "Compute forecast"}</span>
              </button>
              <input
                type="number"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="period target (optional)"
                className="bg-[#18181b] border border-[#27272a] rounded-lg px-2.5 py-1.5 text-[11px] text-white w-44 focus:outline-none"
                aria-label="Period target for coverage"
              />
            </div>
            <StatusLine envelope={envelopes.forecast ?? null} />
            {forecast && (
              <div className="space-y-2.5">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                  <Stat label={`Gross open (${forecast.currency})`} value={forecast.grossPipeline.toLocaleString()} />
                  <Stat label="Weighted" value={forecast.weightedForecast.toLocaleString()} />
                  <Stat label="Committed" value={forecast.committed.toLocaleString()} />
                  <Stat label="Coverage" value={forecast.coverageRatio === null ? "no target set" : `${Math.round(forecast.coverageRatio * 100)}%`} />
                </div>
                {forecast.byCurrency.length > 1 && (
                  <p className="text-[10px] font-mono text-amber-400">
                    {forecast.byCurrency.map((c) => `${c.currency}: ${c.gross.toLocaleString()} gross / ${c.weighted.toLocaleString()} weighted (${c.count})`).join(" · ")}
                    {" "}— never added together, no FX source is wired up.
                  </p>
                )}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
                  <Block title="Stage build-up" lines={forecast.byStage.map((s) => `${s.label}: ${s.count} deal(s), ${s.gross.toLocaleString()} at ${Math.round(s.weight * 100)}% = ${s.weighted.toLocaleString()}`)} tone="zinc" />
                  <Block title="Riskiest deals" lines={forecast.riskiest.map((l) => `${l.company} (${l.amount.toLocaleString()} ${l.currency}) — ${l.riskFlags.slice(0, 2).join(" ") || "no flags"}`)} tone="red" />
                  <Block title="Stalled (21+ days)" lines={forecast.stalled.map((l) => `${l.company} — ${l.nextAction}`)} tone="amber" />
                  <Block title="Assumptions this number rests on" lines={forecast.assumptions} tone="zinc" />
                </div>
              </div>
            )}
          </div>
        )}

        {/* REACHABILITY / CONSENT */}
        {tab === "channels" && selected && (
          <div className="space-y-2.5">
            <p className="text-[11px] text-zinc-400">
              Voice and WhatsApp are not wired to any sender. Until consent is recorded here, the agents will not
              propose those channels for {selected.company || selected.name}.
            </p>
            {(["email", "phone", "whatsapp", "voice"] as OutboundChannel[]).map((channel) => {
              const decision = decideChannel(channel, {
                consent: consentForLead(channel),
                email: selected.email,
                phone: selected.phone,
                stage: selected.stage,
                replied: (selected.notes || "").toLowerCase().includes("replied"),
              });
              const record = consentForLead(channel);
              return (
                <div key={channel} className="border border-[#18181b] rounded-lg bg-[#050505] px-3 py-2 flex items-start gap-3">
                  <span
                    className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded shrink-0 ${
                      decision.allowed
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                        : "bg-red-500/10 text-red-400 border border-red-500/30"
                    }`}
                  >
                    {channel}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] text-zinc-300">{decision.reason}</p>
                    <p className="text-[10px] font-mono text-zinc-600">
                      {decision.allowed ? "may be proposed" : `not available${decision.requires ? ` — needs ${decision.requires}` : ""}`}
                      {record?.grantedAt ? ` · consented ${record.grantedAt.slice(0, 10)}` : ""}
                      {record?.retainUntil ? ` · retain until ${record.retainUntil.slice(0, 10)}` : ""}
                    </p>
                  </div>
                  {channel !== "email" && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => toggleConsent(channel, true)}
                        disabled={Boolean(record?.granted)}
                        className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-[10px] font-semibold text-zinc-100 cursor-pointer disabled:opacity-40"
                      >
                        They said yes
                      </button>
                      <button
                        onClick={() => toggleConsent(channel, false)}
                        disabled={!record?.granted}
                        className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-[10px] font-semibold text-zinc-100 cursor-pointer disabled:opacity-40"
                      >
                        Withdraw
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
            <p className="text-[10px] font-mono text-zinc-600 flex items-center gap-1.5">
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
              Consent and retention are stored in this browser only. Nothing leaves the machine, and no message is sent from here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function Block({ title, lines, tone }: { title: string; lines: string[]; tone: "zinc" | "emerald" | "amber" | "red" }) {
  const border = { zinc: "border-[#18181b]", emerald: "border-emerald-500/20", amber: "border-amber-500/20", red: "border-red-500/20" }[tone];
  const label = { zinc: "text-zinc-500", emerald: "text-emerald-400", amber: "text-amber-400", red: "text-red-400" }[tone];
  return (
    <div className={`border ${border} rounded-lg bg-[#050505] px-3 py-2`}>
      <p className={`text-[10px] font-mono uppercase ${label}`}>{title}</p>
      <ul className="mt-1 space-y-1">
        {lines.map((line, i) => (
          <li key={i} className="text-[11px] text-zinc-400 leading-snug">
            {line}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-[#18181b] rounded-lg bg-[#050505] px-3 py-2">
      <p className="text-[9px] font-mono uppercase text-zinc-500">{label}</p>
      <p className="text-sm font-semibold text-white font-mono">{value}</p>
    </div>
  );
}
