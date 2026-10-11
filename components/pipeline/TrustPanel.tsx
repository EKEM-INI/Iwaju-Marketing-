"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Lead } from "@/types";
import { EvidenceCounts } from "@/lib/icp";
import { saveLeads } from "@/lib/storage";
import { useToast } from "@/components/ui/Toast";
import { ShieldCheck, AlertTriangle, Ban, RefreshCw, Check, Undo2, Wrench } from "lucide-react";

const VERIFICATION_KEY = "iwaju_verification_v1";
const HYGIENE_KEY = "iwaju_hygiene_v1";

interface EvidenceLine {
  field: string;
  claim: string;
  state: string;
  confidence: number;
  source: string;
  detail: string;
}

export interface StoredResolution {
  leadId: string;
  company: string;
  verdict: string;
  channelClass: string;
  personIsHuman: boolean;
  blockers: string[];
  writableFields: Record<string, boolean>;
  evidence: EvidenceLine[];
  runAt: string;
}

interface HygieneProposal {
  id: string;
  type: string;
  severity: "high" | "medium" | "low";
  leadIds: string[];
  reason: string;
  suggestion: string;
  action: "clear_phone" | "clear_claim" | "mark_needs_contact" | "merge_duplicate" | "review_only";
  evidence: string[];
}

interface HygieneRun {
  summary: { leadsInspected: number; proposals: number; high: number; medium: number; low: number };
  proposals: HygieneProposal[];
  runAt: string;
}

function loadResolutions(): StoredResolution[] {
  try {
    const raw = localStorage.getItem(VERIFICATION_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed?.resolutions) ? parsed.resolutions : [];
  } catch {
    return [];
  }
}

function toEvidenceCounts(r: StoredResolution): EvidenceCounts {
  const count = (state: string) => r.evidence.filter((e) => e.state === state).length;
  return {
    verified: count("verified"),
    contradicted: count("contradicted"),
    unverified: count("unverified"),
    noHumanContact: !r.personIsHuman,
  };
}

function snapshotEqual(before: Lead[], after: Lead[]): boolean {
  if (before.length !== after.length) return false;
  return before.every((lead, index) => {
    const next = after[index];
    return lead.id === next.id && lead.phone === next.phone && lead.notes === next.notes;
  });
}

interface Props {
  leads: Lead[];
  onEvidence: (countsByLeadId: Map<string, EvidenceCounts>) => void;
  onLeadsSaved: (leads: Lead[]) => void;
}

export function TrustPanel({ leads, onEvidence, onLeadsSaved }: Props) {
  const { showToast } = useToast();
  const [resolutions, setResolutions] = useState<StoredResolution[]>([]);
  const [hygiene, setHygiene] = useState<HygieneRun | null>(null);
  const [undoStack, setUndoStack] = useState<Map<string, Lead[]>>(new Map());
  const [undone, setUndone] = useState<string[]>([]);
  const [busy, setBusy] = useState<"verify" | "hygiene" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    try {
      setResolutions(loadResolutions());
      const rawHygiene = localStorage.getItem(HYGIENE_KEY);
      if (rawHygiene) setHygiene(JSON.parse(rawHygiene));
    } catch {
      // private mode or a corrupt entry: start clean
    }
  }, []);

  useEffect(() => {
    const map = new Map<string, EvidenceCounts>();
    resolutions.forEach((r) => map.set(r.leadId, toEvidenceCounts(r)));
    onEvidence(map);
  }, [resolutions, onEvidence]);

  const runVerification = useCallback(async () => {
    setBusy("verify");
    setError(null);
    try {
      const res = await fetch("/api/contacts/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contacts: leads }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Verification failed.");
        return;
      }
      const runAt = new Date().toISOString();
      const rows: StoredResolution[] = data.results.map((r: any) => ({
        leadId: String(r.leadId),
        company: r.company,
        verdict: r.verdict,
        channelClass: r.channelClass,
        personIsHuman: r.personIsHuman,
        blockers: r.blockers,
        writableFields: r.writableFields,
        evidence: r.evidence.map((e: any) => ({
          field: e.field,
          claim: e.claim,
          state: e.state,
          confidence: e.confidence,
          source: e.source,
          detail: e.detail,
        })),
        runAt,
      }));
      setResolutions(rows);
      localStorage.setItem(VERIFICATION_KEY, JSON.stringify({ runAt, resolutions: rows }));
    } catch (err: any) {
      setError(`Could not reach the verification agent: ${err?.message}`);
    } finally {
      setBusy(null);
    }
  }, [leads]);

  const runHygiene = useCallback(async () => {
    setBusy("hygiene");
    setError(null);
    try {
      const res = await fetch("/api/crm/hygiene", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leads }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "The hygiene scan failed.");
        return;
      }
      const run: HygieneRun = { summary: data.summary, proposals: data.proposals, runAt: new Date().toISOString() };
      setHygiene(run);
      setUndone([]);
      setUndoStack(new Map());
      localStorage.setItem(HYGIENE_KEY, JSON.stringify(run));
    } catch (err: any) {
      setError(`Could not reach the hygiene agent: ${err?.message}`);
    } finally {
      setBusy(null);
    }
  }, [leads]);

  const applyProposal = (proposal: HygieneProposal) => {
    if (proposal.action === "review_only" || proposal.action === "merge_duplicate") {
      showToast(
        proposal.action === "merge_duplicate" ? "Merge needs you" : "Acknowledged",
        proposal.action === "merge_duplicate"
          ? "Records are never deleted automatically. Merge them in the board editor when you have decided which one survives."
          : "This finding is a read-only flag. Nothing on the record was safe to change.",
        "info"
      );
      return;
    }

    const targets = new Set(proposal.leadIds);
    const snapshot = leads.map((lead) => ({ ...lead }));

    const updated = leads.map((lead) => {
      if (!targets.has(String(lead.id))) return lead;
      if (proposal.action === "clear_phone") return { ...lead, phone: "" };
      if (proposal.action === "mark_needs_contact") {
        const stamp = "[needs a named contact — flagged by the hygiene agent]";
        return lead.notes.includes(stamp) ? lead : { ...lead, notes: `${lead.notes ? `${lead.notes}\n` : ""}${stamp}` };
      }
      if (proposal.action === "clear_claim") {
        const cleaned = lead.notes
          .replace(/APOLLO LIVE VERIFIED[^\n]*/gi, "")
          .replace(/100%\s?(MX )?valid[^\n]*/gi, "")
          .replace(/MX (record )?verified[^\n]*/gi, "")
          .replace(/handshake confirmed[^\n]*/gi, "")
          .replace(/corporate (registry|filing)[^\n]*/gi, "")
          .replace(/\s{2,}/g, " ")
          .trim();
        return { ...lead, notes: cleaned };
      }
      return lead;
    });

    if (snapshotEqual(snapshot, updated)) return;

    saveLeads(updated);
    onLeadsSaved(updated);
    setUndone((prev) => [...prev, proposal.id]);
    setUndoStack((prev) => new Map(prev).set(proposal.id, snapshot));
    showToast("Proposal Applied", `${proposal.reason} Change is stored in this browser and can be undone.`, "success");
  };

  const undoProposal = (proposal: HygieneProposal) => {
    const snapshot = undoStack.get(proposal.id);
    if (!snapshot) return;
    const targets = new Set(proposal.leadIds);
    const restored = leads.map((lead) => {
      const previous = snapshot.find((l) => String(l.id) === String(lead.id));
      return targets.has(String(lead.id)) && previous ? previous : lead;
    });
    saveLeads(restored);
    onLeadsSaved(restored);
    setUndoStack((prev) => {
      const next = new Map(prev);
      next.delete(proposal.id);
      return next;
    });
    setUndone((prev) => prev.filter((id) => id !== proposal.id));
    showToast("Change Reverted", "The record is back to what it was before you applied this proposal.", "info");
  };

  const latestRun = resolutions[0]?.runAt;
  const blocked = resolutions.filter((r) => r.verdict === "contradicted").length;
  const clean = resolutions.filter((r) => r.verdict === "resolved").length;

  const proposalsByLead = useMemo(() => {
    const map = new Map<string, number>();
    hygiene?.proposals.forEach((p) => p.leadIds.forEach((id) => map.set(id, (map.get(id) || 0) + 1)));
    return map;
  }, [hygiene]);

  return (
    <div className="bg-[#09090b] border border-[#27272a] rounded-xl overflow-hidden">
      <div className="px-5 py-3 flex flex-col sm:flex-row sm:items-center gap-3 border-b border-[#18181b]">
        <div className="flex-1">
          <h2 className="text-xs font-semibold text-white font-mono uppercase tracking-wider flex items-center gap-2">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            Record trust
          </h2>
          <p className="text-[11px] text-zinc-400">
            {latestRun
              ? `Verified ${resolutions.length} record(s): ${clean} resolved, ${blocked} contradicted. Runs against live DNS here; it does not change any record.`
              : "Never run. Verification checks mail servers and identity with real lookups; hygiene only proposes."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={runVerification}
            disabled={busy !== null || leads.length === 0}
            className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-emerald-500/40 text-white text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
          >
            {busy === "verify" ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />}
            <span>{busy === "verify" ? "Checking..." : "Verify contacts"}</span>
          </button>
          <button
            onClick={runHygiene}
            disabled={busy !== null || leads.length === 0}
            className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-white text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
          >
            {busy === "hygiene" ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Wrench className="w-3.5 h-3.5 text-sky-400" />}
            <span>{busy === "hygiene" ? "Scanning..." : "Hygiene scan"}</span>
          </button>
        </div>
      </div>

      {error && (
        <p className="px-5 py-2 text-[11px] text-amber-400 bg-amber-500/5 border-b border-[#18181b]">{error}</p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-[#18181b]">
        {/* Verification results */}
        <div className="p-4 space-y-2">
          <p className="text-[10px] font-mono uppercase text-zinc-500">Verification evidence</p>
          {resolutions.length === 0 ? (
            <p className="text-[11px] text-zinc-600">No run yet.</p>
          ) : (
            <ul className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
              {resolutions.map((r) => (
                <li key={r.leadId} className="border border-[#18181b] rounded-lg bg-[#050505]">
                  <button
                    type="button"
                    onClick={() => setExpanded(expanded === r.leadId ? null : r.leadId)}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left cursor-pointer"
                  >
                    {r.verdict === "contradicted" ? (
                      <Ban className="w-3.5 h-3.5 text-red-400 shrink-0" />
                    ) : r.verdict === "resolved" ? (
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    )}
                    <span className="text-[11px] text-zinc-200 flex-1 truncate">{r.company || r.leadId}</span>
                    <span className="text-[10px] font-mono text-zinc-600">{r.channelClass}</span>
                    <span className="text-[10px] font-mono text-zinc-500">{r.verdict}</span>
                  </button>
                  {expanded === r.leadId && (
                    <div className="px-2.5 pb-2 space-y-1 border-t border-[#18181b] pt-1.5">
                      {r.blockers.length === 0 && (
                        <p className="text-[10px] text-emerald-400 font-mono">No blockers.</p>
                      )}
                      {r.blockers.map((b, i) => (
                        <p key={i} className="text-[10px] text-red-400 font-mono">
                          {b}
                        </p>
                      ))}
                      <ul className="space-y-1 pt-1">
                        {r.evidence.map((e, i) => (
                          <li key={i} className="text-[10px] leading-snug">
                            <span
                              className={`font-mono ${
                                e.state === "verified"
                                  ? "text-emerald-400"
                                  : e.state === "contradicted"
                                  ? "text-red-400"
                                  : "text-zinc-500"
                              }`}
                            >
                              {e.state}
                            </span>
                            <span className="text-zinc-400"> · {e.claim} ({e.source} {Math.round(e.confidence * 100)}%)</span>
                            <p className="text-zinc-500">{e.detail}</p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Hygiene proposals */}
        <div className="p-4 space-y-2">
          <p className="text-[10px] font-mono uppercase text-zinc-500">
            Hygiene proposals
            {hygiene && (
              <span className="text-zinc-600 normal-case">
                {" "}· {hygiene.summary.high} high, {hygiene.summary.medium} medium, {hygiene.summary.low} low
              </span>
            )}
          </p>
          {!hygiene ? (
            <p className="text-[11px] text-zinc-600">No scan yet.</p>
          ) : hygiene.proposals.length === 0 ? (
            <p className="text-[11px] text-emerald-400">Nothing to fix in {hygiene.summary.leadsInspected} record(s).</p>
          ) : (
            <ul className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
              {hygiene.proposals.map((p) => {
                const done = undone.includes(p.id);
                const names = p.leadIds
                  .map((id) => leads.find((l) => String(l.id) === id)?.company || id)
                  .join(" / ");
                return (
                  <li key={p.id} className="border border-[#18181b] rounded-lg bg-[#050505] px-2.5 py-2 space-y-1">
                    <div className="flex items-start gap-2">
                      <span
                        className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded shrink-0 ${
                          p.severity === "high"
                            ? "bg-red-500/10 text-red-400 border border-red-500/30"
                            : p.severity === "medium"
                            ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                            : "bg-zinc-800 text-zinc-400 border border-zinc-700"
                        }`}
                      >
                        {p.severity}
                      </span>
                      <div className="min-w-0">
                        <p className="text-[11px] text-zinc-200">{p.reason}</p>
                        <p className="text-[10px] text-zinc-500">
                          {names}
                          {proposalsByLead.get(p.leadIds[0] || "") && p.leadIds.length === 1
                            ? ` · ${proposalsByLead.get(p.leadIds[0])} finding(s) on this record`
                            : ""}
                        </p>
                        <p className="text-[10px] text-zinc-400">{p.suggestion}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pt-0.5">
                      {done ? (
                        <>
                          <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                            <Check className="w-3 h-3" /> Applied
                          </span>
                          <button
                            onClick={() => undoProposal(p)}
                            className="text-[10px] font-mono text-zinc-400 hover:text-white flex items-center gap-1 cursor-pointer"
                          >
                            <Undo2 className="w-3 h-3" /> Undo
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => applyProposal(p)}
                            className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-[10px] font-semibold cursor-pointer"
                          >
                            {p.action === "review_only"
                              ? "Acknowledge"
                              : p.action === "merge_duplicate"
                              ? "Open for manual merge"
                              : "Apply"}
                          </button>
                          <span className="text-[10px] font-mono text-zinc-600">
                            {p.evidence.slice(0, 2).join(" · ")}
                          </span>
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Pre-edit snapshots live in component state so an undo restores exactly the field
 * values that were on the record before the proposal was applied.
 */
