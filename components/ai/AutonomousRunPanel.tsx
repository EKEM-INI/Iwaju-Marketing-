"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Cpu,
  Play,
  RefreshCw,
  Inbox,
  ShieldCheck,
  ShieldAlert,
  Radio,
  Database,
} from "lucide-react";
import type { Campaign } from "@/types";
import { CAMPAIGNS_UPDATED_EVENT, loadCampaigns } from "@/lib/campaigns";
import { gmailNeedsReconnect, loadGmailConnection, type GmailConnection } from "@/lib/gmail";
import { loadSendPolicy, sentToday, type SendPolicy } from "@/lib/send-policy";
import { runAutonomousPipeline, type AutonomousRunSummary, type RunOptions } from "@/lib/autonomous-run";
import { useToast } from "@/components/ui/Toast";

interface Props {
  defaultNiche: string;
  defaultLocation: string;
}

const STEP_TONE = (line: string): string => {
  if (line.startsWith("[SENT]")) return "text-emerald-400";
  if (line.startsWith("[HELD]") || line.startsWith("[WARN]") || line.startsWith("[STOP]") || line.includes("SKIPPED") || line.includes("BLOCKED")) return "text-amber-400";
  if (line.startsWith("[FAILED]") || line.includes("FAILED")) return "text-rose-400";
  return "text-zinc-400";
};

export function AutonomousRunPanel({ defaultNiche, defaultLocation }: Props) {
  const { showToast } = useToast();
  const [niche, setNiche] = useState(defaultNiche);
  const [location, setLocation] = useState(defaultLocation);
  const [count, setCount] = useState(8);
  const [revealEmails, setRevealEmails] = useState(true);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignId, setCampaignId] = useState("");
  const [senderCompany, setSenderCompany] = useState("Iwaju Marketing");
  const [policy, setPolicy] = useState<SendPolicy>(loadSendPolicy());
  const [connection, setConnection] = useState<GmailConnection | null>(null);
  const [apollo, setApollo] = useState<{ ready: boolean; message: string; servedBy: string } | null>(null);
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [summary, setSummary] = useState<AutonomousRunSummary | null>(null);

  useEffect(() => {
    setNiche(defaultNiche);
    setLocation(defaultLocation);
  }, [defaultNiche, defaultLocation]);

  const refreshContext = useCallback(() => {
    const all = loadCampaigns();
    setCampaigns(all);
    setCampaignId((prev) => (prev && all.some((c) => c.id === prev) ? prev : all[0]?.id ?? ""));
    setPolicy(loadSendPolicy());
    setConnection(loadGmailConnection());
  }, []);

  useEffect(() => {
    refreshContext();
    window.addEventListener(CAMPAIGNS_UPDATED_EVENT, refreshContext);
    return () => window.removeEventListener(CAMPAIGNS_UPDATED_EVENT, refreshContext);
  }, [refreshContext]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/prospecting/status", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        setApollo({
          ready: Boolean(data?.apollo?.healthy),
          message: String(data?.apollo?.message || "Apollo did not report a status."),
          servedBy: String(data?.servedBy || "unknown host"),
        });
      })
      .catch(() => {
        if (!cancelled) {
          setApollo({ ready: false, message: "The status endpoint did not answer.", servedBy: "unknown host" });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const gmailReady = !gmailNeedsReconnect(connection);
  const bypassBlocked = policy.mode === "bypass" && !gmailReady;
  const canRun = !running && niche.trim().length > 2 && location.trim().length > 1 && Boolean(campaignId);

  const appendLog = useCallback((line: string) => setLog((prev) => [line, ...prev].slice(0, 200)), []);

  async function startRun() {
    if (!canRun) return;
    setRunning(true);
    setSummary(null);
    setLog([]);
    const options: RunOptions = {
      niche: niche.trim(),
      location: location.trim(),
      count: Math.max(1, Math.min(40, Number(count) || 1)),
      revealEmails,
      campaignId,
      senderCompany: senderCompany.trim() || "Iwaju Marketing",
    };
    try {
      const result = await runAutonomousPipeline(options, appendLog);
      setSummary(result);
      refreshContext();
      showToast(
        "Autonomous pass finished",
        `${result.sourced} sourced by Apollo · ${result.drafted} drafted · ${result.sent} sent by Gmail. ${result.notes[0] || ""}`,
        result.sourced === 0 ? "info" : "success"
      );
    } catch (err: any) {
      appendLog(`[RUN CRASHED] ${err?.message || "The run stopped unexpectedly."}`);
      showToast("Run stopped", "The autonomous pass did not complete. Read the log for where it halted.", "error");
    } finally {
      setRunning(false);
    }
  }

  const stats = useMemo(
    () =>
      summary
        ? [
            { label: "Sourced", value: summary.sourced, tone: "text-emerald-400" },
            { label: "New to CRM", value: summary.added, tone: "text-white" },
            { label: "Qualified", value: summary.qualified, tone: "text-emerald-400" },
            { label: "Needs review", value: summary.needsReview, tone: "text-amber-400" },
            { label: "Disqualified", value: summary.disqualified, tone: "text-zinc-400" },
            { label: "Drafted", value: summary.drafted, tone: "text-white" },
            { label: "Queued", value: summary.queued, tone: "text-sky-400" },
            { label: "Sent", value: summary.sent, tone: "text-emerald-400" },
            { label: "Held", value: summary.held.length, tone: "text-amber-400" },
            { label: "Failed", value: summary.failed.length, tone: "text-rose-400" },
          ]
        : [],
    [summary]
  );

  return (
    <div className="p-5 bg-[#09090b] border border-[#27272a] rounded-xl space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-[#18181b] pb-3">
        <div className="flex items-start gap-2.5">
          <Radio className="w-4 h-4 text-emerald-400 mt-0.5" />
          <div>
            <h2 className="text-xs font-semibold text-white font-mono uppercase tracking-wider">
              Start autonomous agents
            </h2>
            <p className="text-[11px] text-zinc-400 mt-1 max-w-2xl leading-relaxed">
              One run does the whole chain: Apollo finds the accounts and their decision-makers, ChatGPT
              qualifies the records that Apollo returned, ChatGPT or Gemini writes a grounded email for each
              qualified contact, and the send step obeys whatever permission this account holds. A step that
              returns nothing is reported as nothing — it is never padded with invented records or copy.
            </p>
          </div>
        </div>
        <span
          className={`text-[10px] font-mono px-2 py-1 rounded border whitespace-nowrap ${
            apollo === null
              ? "border-[#27272a] text-zinc-500"
              : apollo.ready
                ? "border-emerald-500/30 bg-emerald-950/40 text-emerald-400"
                : "border-amber-500/30 bg-amber-950/40 text-amber-400"
          }`}
        >
          {apollo === null ? "CHECKING APOLLO…" : apollo.ready ? "APOLLO KEY LIVE" : "APOLLO WILL NOT SOURCE"}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
        <div className="md:col-span-4">
          <label className="text-[10px] font-mono uppercase text-zinc-500 block mb-1">Niche / industry</label>
          <input
            value={niche}
            onChange={(e) => setNiche(e.target.value)}
            placeholder="e.g. Private schools"
            className="w-full bg-[#000000] border border-[#27272a] rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/60 font-mono"
          />
        </div>
        <div className="md:col-span-3">
          <label className="text-[10px] font-mono uppercase text-zinc-500 block mb-1">Location</label>
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. Uyo, Akwa Ibom"
            className="w-full bg-[#000000] border border-[#27272a] rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/60 font-mono"
          />
        </div>
        <div className="md:col-span-2">
          <label className="text-[10px] font-mono uppercase text-zinc-500 block mb-1">Accounts</label>
          <input
            type="number"
            min={1}
            max={40}
            value={count}
            onChange={(e) => setCount(Number(e.target.value) || 1)}
            className="w-full bg-[#000000] border border-[#27272a] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500/60 font-mono"
          />
        </div>
        <div className="md:col-span-3">
          <label className="text-[10px] font-mono uppercase text-zinc-500 block mb-1">Draft into campaign</label>
          <select
            value={campaignId}
            onChange={(e) => setCampaignId(e.target.value)}
            className="w-full bg-[#000000] border border-[#27272a] rounded-lg px-2 py-2 text-xs text-white focus:outline-none focus:border-emerald-500/60"
          >
            {campaigns.length === 0 && <option value="">No campaign exists</option>}
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 text-[11px]">
        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={revealEmails}
            onChange={(e) => setRevealEmails(e.target.checked)}
            className="mt-0.5 accent-emerald-500"
          />
          <span className="text-zinc-400 max-w-md leading-relaxed">
            <span className="text-zinc-200 font-medium">Reveal mailboxes and direct lines.</span> Whatever Apollo&apos;s
            search already releases costs nothing. Anything it withholds is purchased at 1–9 credits per person, phones
            billed on top, and only returns a value Apollo genuinely holds. Off means most records arrive with no
            address and nothing is mailable.
          </span>
        </label>
        <div className="sm:ml-auto">
          <label className="text-[10px] font-mono uppercase text-zinc-500 block mb-1">Your sending name</label>
          <input
            value={senderCompany}
            onChange={(e) => setSenderCompany(e.target.value)}
            className="w-44 bg-[#000000] border border-[#27272a] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500/60"
          />
        </div>
      </div>

      {/* Permission state for this run */}
      <div className="rounded-lg border border-[#27272a] bg-[#121215] p-3 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-2">
          {policy.mode === "bypass" ? (
            <ShieldAlert className="w-4 h-4 text-amber-400" />
          ) : (
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          )}
          <span className="text-[11px] font-mono text-zinc-300">
            {policy.mode === "bypass"
              ? "Bypass on: this run sends what it approves, up to " + policy.capPerRun + " messages."
              : "Review on: this run stops at the Outbox and waits for you."}
          </span>
        </div>
        <div className="sm:ml-auto flex flex-wrap items-center gap-2 text-[10px] font-mono">
          <span className="px-2 py-0.5 rounded border border-[#27272a] text-zinc-400">
            {sentToday()}/{policy.capPerDay} today
          </span>
          <span
            className={`px-2 py-0.5 rounded border ${
              connection?.email
                ? gmailReady
                  ? "border-emerald-500/30 text-emerald-400"
                  : "border-amber-500/30 text-amber-400"
                : "border-[#27272a] text-zinc-500"
            }`}
          >
            {connection?.email ? (gmailReady ? `Gmail ${connection.email}` : `Gmail ${connection.email} (expired)`) : "Gmail not connected"}
          </span>
          <Link href="/outbox" className="px-2 py-0.5 rounded border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10">
            Outbox
          </Link>
        </div>
      </div>

      {apollo && !apollo.ready && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-[11px] text-amber-300 leading-relaxed space-y-1">
          <p className="font-semibold text-amber-200">
            Sourcing will fail at step one: Apollo is not live on this build.
          </p>
          <p>{apollo.message}</p>
          <p className="text-[10px] text-amber-400/80">
            Answered by <span className="font-mono">{apollo.servedBy}</span>. A key added to Vercel only reaches the
            site after a redeploy; on this machine it has to be in <span className="font-mono">.env.local</span> with
            the dev server restarted.
          </p>
        </div>
      )}
      {campaigns.length === 0 && (
        <p className="text-[11px] text-amber-400 leading-relaxed">
          A campaign is required before drafting, because each draft is written for a thread with a purpose. Create one
          in Campaigns, then run this.
        </p>
      )}
      {bypassBlocked && (
        <p className="text-[11px] text-amber-400 leading-relaxed">
          Bypass mode is on but no Gmail account is connected here, so the run will draft and queue but send nothing.
          Connect Gmail in the Outbox, or switch back to review mode.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={startRun}
          disabled={!canRun}
          className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-black font-semibold rounded-lg text-xs transition-all flex items-center gap-2 cursor-pointer shadow-xs"
        >
          {running ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
          <span>{running ? "Agents working…" : "Run the full chain now"}</span>
        </button>
        <span className="text-[10px] font-mono text-zinc-600 flex items-center gap-1.5">
          <Database className="w-3 h-3" />
          Apollo sources · ChatGPT judges · ChatGPT or Gemini writes · Gmail delivers
        </span>
      </div>

      {log.length > 0 && (
        <div className="rounded-lg border border-[#18181b] bg-black/40 p-3 max-h-64 overflow-y-auto">
          <p className="text-[10px] font-mono uppercase text-zinc-600 mb-2">Run log</p>
          <ul className="space-y-1">
            {log.map((line, index) => (
              <li key={`${index}-${line.slice(0, 24)}`} className={`text-[11px] font-mono leading-relaxed ${STEP_TONE(line)}`}>
                {line}
              </li>
            ))}
          </ul>
        </div>
      )}

      {summary && (
        <div className="rounded-lg border border-[#27272a] bg-[#121215] p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-mono uppercase text-zinc-400 flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-emerald-400" />
              Run summary
            </p>
            <p className="text-[10px] font-mono text-zinc-600">{summary.providers.filter(Boolean).join(" · ")}</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
            {stats.map((s) => (
              <div key={s.label} className="rounded-lg border border-[#27272a] bg-[#09090b] py-2">
                <p className={`text-base font-semibold ${s.tone}`}>{s.value}</p>
                <p className="text-[10px] font-mono uppercase text-zinc-600">{s.label}</p>
              </div>
            ))}
          </div>
          {summary.sourced > 0 && (
            <p className="text-[11px] text-zinc-400">
              {summary.addressRevealed} of the {summary.sourced} sourced record(s) carry a mailbox and{" "}
              {summary.withPhone} carry a direct line. Anything without an address came back that way from Apollo and
              was left blank rather than guessed.
            </p>
          )}
          {summary.notes.length > 0 && (
            <ul className="space-y-1">
              {summary.notes.map((note, index) => (
                <li key={index} className="text-[11px] text-amber-300 leading-relaxed">
                  {note}
                </li>
              ))}
            </ul>
          )}
          {summary.draftsSkipped.length > 0 && (
            <details className="text-[11px] text-zinc-400">
              <summary className="cursor-pointer font-mono text-zinc-500">
                {summary.draftsSkipped.length} contact(s) the writer refused
              </summary>
              <ul className="mt-1.5 space-y-1">
                {summary.draftsSkipped.map((s, index) => (
                  <li key={index}>
                    <span className="text-zinc-200">{s.company}</span> — {s.reason}
                  </li>
                ))}
              </ul>
            </details>
          )}
          {summary.held.length > 0 && (
            <ul className="space-y-1">
              {summary.held.map((h, index) => (
                <li key={index} className="text-[11px] text-amber-400">
                  Held · {h.to} — {h.reason}
                </li>
              ))}
            </ul>
          )}
          {summary.failed.length > 0 && (
            <ul className="space-y-1">
              {summary.failed.map((f, index) => (
                <li key={index} className="text-[11px] text-rose-400">
                  Failed · {f.to} — {f.error}
                </li>
              ))}
            </ul>
          )}
          {summary.waitingForApproval > 0 && (
            <Link
              href="/outbox"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 text-[11px] font-semibold"
            >
              <Inbox className="w-3.5 h-3.5" />
              <span>Approve {summary.waitingForApproval} draft(s) in the Outbox</span>
            </Link>
          )}
          <p className="text-[10px] text-zinc-600 leading-relaxed">
            Everything above is written to the CRM, the campaign touches and the activity feed, so the dashboard and
            Pipeline reflect this run. Sent means Gmail accepted the message; this app cannot see replies, opens or
            bounces because the Gmail permission is send-only.
          </p>
        </div>
      )}
    </div>
  );
}
