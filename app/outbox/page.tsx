"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Inbox,
  ShieldCheck,
  ShieldAlert,
  Send,
  Pause,
  Check,
  Pencil,
  X,
  LogIn,
  Unlink,
  History,
  RefreshCw,
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import {
  connectGmail,
  disconnectGmail,
  gmailClientId,
  gmailNeedsReconnect,
  loadGmailConnection,
  onGmailChange,
  type GmailConnection,
} from "@/lib/gmail";
import {
  DEFAULT_POLICY,
  SEND_LEDGER_UPDATED_EVENT,
  listSentHistory,
  loadSendPolicy,
  saveSendPolicy,
  sentToday,
  type SendLedgerEntry,
  type SendMode,
  type SendPolicy,
} from "@/lib/send-policy";
import {
  OUTBOX_UPDATED_EVENT,
  clearOutbox,
  listOutbox,
  outboxCounts,
  setOutboxStatus,
  updateOutboxItem,
  type OutboxItem,
  type OutboxStatus,
} from "@/lib/outbox";
import { sendItems, type SendRunResult } from "@/lib/send-runner";
import { LEADS_UPDATED_EVENT, getStoredLeads } from "@/lib/storage";
import type { Lead } from "@/types";

const STATUS_LABEL: Record<OutboxStatus, string> = {
  awaiting_review: "Waiting for you",
  approved: "Approved",
  held: "Held",
  sent: "Sent",
  failed: "Failed",
};

const FILTERS: Array<{ key: OutboxStatus | "all"; label: string }> = [
  { key: "awaiting_review", label: "Waiting for you" },
  { key: "approved", label: "Approved" },
  { key: "held", label: "Held" },
  { key: "sent", label: "Sent" },
  { key: "failed", label: "Failed" },
  { key: "all", label: "All" },
];

const EMPTY_COUNTS: Record<OutboxStatus, number> = {
  awaiting_review: 0,
  approved: 0,
  held: 0,
  sent: 0,
  failed: 0,
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(iso).toLocaleDateString();
}

function tokenExpiryLabel(connection: GmailConnection): string {
  const mins = Math.round((connection.expiresAt - Date.now()) / 60000);
  if (mins <= 0) return "expired";
  if (mins < 60) return `expires in ${mins} min`;
  return `expires in ${Math.round(mins / 60)} h`;
}

export default function OutboxPage() {
  const { showToast } = useToast();
  const [items, setItems] = useState<OutboxItem[]>([]);
  const [counts, setCounts] = useState(EMPTY_COUNTS);
  const [history, setHistory] = useState<SendLedgerEntry[]>([]);
  const [policy, setPolicy] = useState<SendPolicy>(DEFAULT_POLICY);
  const [todayCount, setTodayCount] = useState(0);
  const [connection, setConnection] = useState<GmailConnection | null>(null);
  const [filter, setFilter] = useState<OutboxStatus | "all">("awaiting_review");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [connecting, setConnecting] = useState(false);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [lastRun, setLastRun] = useState<SendRunResult | null>(null);
  const [editing, setEditing] = useState<{ id: string; to: string; subject: string; body: string } | null>(null);

  const clientIdConfigured = Boolean(gmailClientId());
  const tokenReady = !gmailNeedsReconnect(connection);

  const refresh = useCallback(() => {
    setItems(listOutbox());
    setCounts(outboxCounts());
    setHistory(listSentHistory());
    setPolicy(loadSendPolicy());
    setTodayCount(sentToday());
    setConnection(loadGmailConnection());
    setLeads(getStoredLeads());
  }, []);

  useEffect(() => {
    refresh();
    window.addEventListener(OUTBOX_UPDATED_EVENT, refresh);
    window.addEventListener(SEND_LEDGER_UPDATED_EVENT, refresh);
    window.addEventListener(LEADS_UPDATED_EVENT, refresh);
    const off = onGmailChange(() => setConnection(loadGmailConnection()));
    return () => {
      window.removeEventListener(OUTBOX_UPDATED_EVENT, refresh);
      window.removeEventListener(SEND_LEDGER_UPDATED_EVENT, refresh);
      window.removeEventListener(LEADS_UPDATED_EVENT, refresh);
      off();
    };
  }, [refresh]);

  const visible = useMemo(
    () => (filter === "all" ? items : items.filter((item) => item.status === filter)),
    [items, filter]
  );

  const approvedIds = useMemo(
    () => items.filter((item) => item.status === "approved").map((item) => item.id),
    [items]
  );

  const runRoom = Math.max(0, policy.capPerRun);
  const dayRoom = Math.max(0, policy.capPerDay - todayCount);

  async function handleConnect() {
    setConnecting(true);
    const result = await connectGmail();
    setConnecting(false);
    if (result.ok) {
      refresh();
      showToast("Gmail connected", `${result.connection.email} can now send from this browser.`, "success");
    } else {
      refresh();
      showToast("Gmail not connected", result.error, "error");
    }
  }

  function handleDisconnect() {
    disconnectGmail();
    refresh();
    showToast("Gmail disconnected", "Drafts stay in the Outbox. Nothing can leave until you reconnect.", "info");
  }

  function updatePolicy(patch: Partial<SendPolicy>) {
    const next = saveSendPolicy({ mode: policy.mode, capPerRun: policy.capPerRun, capPerDay: policy.capPerDay, ...patch });
    setPolicy(next);
  }

  function approve(ids: string[]) {
    setOutboxStatus(ids, "approved", { holdReason: undefined, error: undefined });
    refresh();
  }

  function hold(id: string) {
    updateOutboxItem(id, { status: "held", holdReason: "Held by you. Nothing was sent." });
    refresh();
  }

  function saveEdit() {
    if (!editing) return;
    updateOutboxItem(editing.id, {
      to: editing.to.trim(),
      subject: editing.subject.trim(),
      body: editing.body,
    });
    setEditing(null);
    refresh();
    showToast("Draft updated", "The message the Outbox holds is now the message that would be sent.", "success");
  }

  async function sendIds(ids: string[]) {
    if (ids.length === 0) return;
    if (!tokenReady) {
      showToast("Gmail not connected", "Connect Gmail on this page before anything can be sent.", "error");
      return;
    }
    setSending(true);
    setProgress({ done: 0, total: ids.length });
    setLastRun(null);
    const result = await sendItems(ids, connection?.accessToken || "", { policy, leads, onProgress: (done, total) => setProgress({ done, total }) });
    setSending(false);
    setProgress(null);
    setLastRun(result);
    refresh();
    const type = result.sentCount > 0 ? "success" : "info";
    showToast(`Send pass finished`, result.note, type);
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div>
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase font-extrabold tracking-widest text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
            Human Loop
          </span>
          <span className="text-xs text-zinc-500">•</span>
          <span className="text-xs text-zinc-400 flex items-center gap-1">
            <Inbox className="w-3.5 h-3.5 text-emerald-400" />
            <span>Apollo sourced, AI drafted, you approve</span>
          </span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-1">Outbox</h2>
        <p className="text-xs sm:text-sm text-zinc-400 mt-1 max-w-2xl">
          Every drafted message lands here and waits. In review mode nothing leaves until you press
          approve. In bypass mode the run sends what it approved on its own — it skips your click, not
          the checks that decide whether a contact may be mailed at all.
        </p>
      </div>

      {/* Gmail connection */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 sm:p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Send className="w-4 h-4 text-emerald-400" />
              Sending account
            </h3>
            <p className="text-xs text-zinc-400 mt-1">
              Mail goes out through your own Gmail, so replies and sender reputation stay yours.
            </p>
          </div>
          <button
            onClick={refresh}
            className="text-[11px] font-mono px-2 py-1 rounded border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700 flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Refresh</span>
          </button>
        </div>

        {connection?.email ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
              <ShieldCheck className="w-3 h-3" />
              {connection.email}
            </span>
            {tokenReady ? (
              <span className="text-[11px] font-mono text-zinc-500">{tokenExpiryLabel(connection as GmailConnection)}</span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-1 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-400">
                <ShieldAlert className="w-3 h-3" />
                Authorisation expired — reconnect to send
              </span>
            )}
          </div>
        ) : (
          <p className="text-xs text-zinc-400">
            No Gmail account is attached to this browser yet.
          </p>
        )}

        {!clientIdConfigured && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300 leading-relaxed">
            Connecting needs <span className="font-mono">NEXT_PUBLIC_GOOGLE_CLIENT_ID</span> set for this
            deployment, with this site listed as an Authorized JavaScript origin and the
            <span className="font-mono"> gmail.send</span> scope enabled. Until then drafts can be
            prepared, copied and exported, but they cannot leave from here.
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleConnect}
            disabled={!clientIdConfigured || connecting}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-500/15 border border-emerald-500/40 px-3 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>{connecting ? "Waiting for Google…" : connection?.email ? (tokenReady ? "Reconnect Gmail" : "Reconnect Gmail") : "Connect Gmail"}</span>
          </button>
          {connection?.email && (
            <button
              onClick={handleDisconnect}
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-800 px-3 py-2 text-xs font-semibold text-zinc-400 hover:text-white hover:border-zinc-700"
            >
              <Unlink className="w-3.5 h-3.5" />
              <span>Disconnect</span>
            </button>
          )}
        </div>

        <p className="text-[11px] text-zinc-500 leading-relaxed">
          The permission Google grants is send-only, so this app can never read your inbox — which also
          means bounces, opens and replies are invisible here. The token lives in this browser under your
          account namespace; another browser or device has to connect again.
        </p>
      </section>

      {/* Send policy */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 sm:p-5 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            Permission to send
          </h3>
          <p className="text-xs text-zinc-400 mt-1">
            The only switch that removes you from the loop. Ceilings apply in both modes.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          {(["review", "bypass"] as SendMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => updatePolicy({ mode })}
              className={`text-left rounded-lg border p-3 transition-colors ${
                policy.mode === mode
                  ? "border-emerald-500/50 bg-emerald-500/10"
                  : "border-zinc-800 bg-zinc-950 hover:border-zinc-700"
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`size-2 rounded-full ${policy.mode === mode ? "bg-emerald-400" : "bg-zinc-600"}`}
                  aria-hidden
                />
                <span className="text-xs font-semibold text-white">
                  {mode === "review" ? "Ask me before every send" : "Bypass the human loop"}
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 mt-1.5 leading-relaxed">
                {mode === "review"
                  ? "A run stops at the Outbox. You approve each message, or the whole approved set, yourself."
                  : "A run sends what it marked approvable without waiting for a click. Records with no real address, demo records and anything already mailed are still held."}
              </p>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-end gap-4">
          <label className="text-[11px] font-mono text-zinc-400">
            <span className="block mb-1 uppercase tracking-widest text-zinc-500">Per run</span>
            <input
              type="number"
              min={1}
              max={100}
              value={policy.capPerRun}
              onChange={(e) => updatePolicy({ capPerRun: Number(e.target.value) || 1 })}
              className="w-24 rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500/50"
            />
          </label>
          <label className="text-[11px] font-mono text-zinc-400">
            <span className="block mb-1 uppercase tracking-widest text-zinc-500">Per day</span>
            <input
              type="number"
              min={1}
              max={500}
              value={policy.capPerDay}
              onChange={(e) => updatePolicy({ capPerDay: Number(e.target.value) || 1 })}
              className="w-24 rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500/50"
            />
          </label>
          <p className="text-[11px] text-zinc-500 max-w-md leading-relaxed">
            {todayCount} of {policy.capPerDay} sent today, {dayRoom} left. A run may put at most{" "}
            {runRoom} on the wire. The counter lives in this browser because the app has no server store,
            so a second browser starts its own day at zero.
          </p>
        </div>
      </section>

      {/* Queue */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Inbox className="w-4 h-4 text-emerald-400" />
              Draft queue
            </h3>
            <p className="text-xs text-zinc-400 mt-1">
              {items.length} message(s) held here. Approve, edit or hold each one before it leaves.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => approve(approvedIds.length ? approvedIds : visible.map((i) => i.id))}
              disabled={approvedIds.length === 0 && visible.length === 0}
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-800 px-3 py-2 text-xs font-semibold text-zinc-300 hover:border-emerald-500/40 hover:text-emerald-300 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Approve {approvedIds.length ? "all" : "this view"}</span>
            </button>
            <button
              onClick={() => sendIds(approvedIds)}
              disabled={sending || approvedIds.length === 0 || !tokenReady}
              title={tokenReady ? undefined : "Connect Gmail first"}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-500/15 border border-emerald-500/40 px-3 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{sending ? "Sending…" : `Send all approved (${approvedIds.length})`}</span>
            </button>
            {counts.sent > 0 && (
              <button
                onClick={() => {
                  const removed = clearOutbox("sent");
                  refresh();
                  showToast("Cleared sent", `${removed} sent message(s) removed from the queue. The ledger keeps the record.`, "info");
                }}
                className="inline-flex items-center gap-2 rounded-lg border border-zinc-800 px-3 py-2 text-xs font-semibold text-zinc-400 hover:text-white hover:border-zinc-700"
              >
                <X className="w-3.5 h-3.5" />
                <span>Clear sent</span>
              </button>
            )}
          </div>
        </div>

        {!tokenReady && items.length > 0 && (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 text-xs text-zinc-400">
            Gmail is not connected on this browser, so nothing can be sent yet. Approvals still work —
            connect later and the queue is where you left it.
          </div>
        )}

        {progress && (
          <div className="space-y-1">
            <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all"
                style={{ width: `${Math.round((progress.done / Math.max(1, progress.total)) * 100)}%` }}
              />
            </div>
            <p className="text-[11px] font-mono text-zinc-400">
              {progress.done}/{progress.total} processed
            </p>
          </div>
        )}

        {lastRun && (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 space-y-2">
            <p className="text-xs font-semibold text-white">Last send pass</p>
            <p className="text-[11px] text-zinc-400">{lastRun.note}</p>
            {lastRun.held.length > 0 && (
              <ul className="text-[11px] text-amber-400 space-y-1">
                {lastRun.held.map((h) => (
                  <li key={h.id}>Held · {h.to} — {h.held}</li>
                ))}
              </ul>
            )}
            {lastRun.failed.length > 0 && (
              <ul className="text-[11px] text-rose-400 space-y-1">
                {lastRun.failed.map((f) => (
                  <li key={f.id}>Failed · {f.to} — {f.error}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => {
            const count = f.key === "all" ? items.length : counts[f.key];
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`text-[11px] font-mono px-2.5 py-1 rounded-full border transition-colors ${
                  filter === f.key
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                    : "border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-white"
                }`}
              >
                {f.label} ({count})
              </button>
            );
          })}
        </div>

        {visible.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-800 p-6 text-center">
            <p className="text-xs text-zinc-400">
              Nothing in {filter === "all" ? "the outbox" : STATUS_LABEL[filter as OutboxStatus].toLowerCase()}.
            </p>
            <p className="text-[11px] text-zinc-500 mt-1">
              Drafts arrive here from the Outreach Engine and from an autonomous run.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {visible.map((item) => (
              <li key={item.id} className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 space-y-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-white truncate">{item.company}</p>
                    <p className="text-[11px] font-mono text-zinc-400 truncate">{item.to}</p>
                    <p className="text-[11px] text-zinc-500 truncate mt-0.5">{item.subject}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 justify-end">
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                        item.status === "sent"
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                          : item.status === "approved"
                            ? "border-sky-500/30 bg-sky-500/10 text-sky-400"
                            : item.status === "held"
                              ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                              : item.status === "failed"
                                ? "border-rose-500/30 bg-rose-500/10 text-rose-400"
                                : "border-zinc-700 bg-zinc-800/60 text-zinc-300"
                      }`}
                    >
                      {STATUS_LABEL[item.status]}
                    </span>
                    {item.emailStatus && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border border-zinc-800 text-zinc-500">
                        {item.emailStatus}
                      </span>
                    )}
                    {item.sourcedFrom && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border border-zinc-800 text-zinc-500">
                        {item.sourcedFrom}
                      </span>
                    )}
                  </div>
                </div>

                {item.holdReason && (
                  <p className="text-[11px] text-amber-400 leading-relaxed">{item.holdReason}</p>
                )}
                {item.error && <p className="text-[11px] text-rose-400 leading-relaxed">{item.error}</p>}
                {item.inventedNumbers.length > 0 && (
                  <p className="text-[11px] text-rose-400">
                    Numbers the writer could not ground: {item.inventedNumbers.join(", ")}
                  </p>
                )}

                {editing?.id === item.id ? (
                  <div className="space-y-2">
                    <input
                      value={editing.to}
                      onChange={(e) => setEditing({ ...editing, to: e.target.value })}
                      className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500/50"
                      placeholder="Recipient address"
                    />
                    <input
                      value={editing.subject}
                      onChange={(e) => setEditing({ ...editing, subject: e.target.value })}
                      className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500/50"
                      placeholder="Subject"
                    />
                    <textarea
                      value={editing.body}
                      onChange={(e) => setEditing({ ...editing, body: e.target.value })}
                      rows={8}
                      className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-xs text-white leading-relaxed focus:outline-none focus:border-emerald-500/50"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={saveEdit}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/40 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-300"
                      >
                        <Check className="w-3 h-3" />
                        <span>Save changes</span>
                      </button>
                      <button
                        onClick={() => setEditing(null)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 px-2.5 py-1.5 text-[11px] font-semibold text-zinc-400 hover:text-white"
                      >
                        <X className="w-3 h-3" />
                        <span>Cancel</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <details className="group">
                      <summary className="cursor-pointer text-[11px] font-mono text-zinc-500 hover:text-zinc-300 list-none">
                        Read the message
                      </summary>
                      <pre className="mt-2 whitespace-pre-wrap text-[11px] leading-relaxed text-zinc-300 rounded-lg border border-zinc-800 bg-zinc-950 p-3 max-h-72 overflow-y-auto">
                        {item.body}
                      </pre>
                    </details>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                      <span className="text-[10px] font-mono text-zinc-600">
                        {item.provider} · {timeAgo(item.createdAt)}
                        {item.messageId ? ` · gmail ${item.messageId}` : ""}
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {item.status !== "awaiting_review" && item.status !== "approved" ? null : (
                          <button
                            onClick={() => approve([item.id])}
                            disabled={item.status === "approved"}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 px-2.5 py-1 text-[11px] font-semibold text-zinc-300 hover:border-emerald-500/40 hover:text-emerald-300 disabled:opacity-40"
                          >
                            <Check className="w-3 h-3" />
                            <span>{item.status === "approved" ? "Approved" : "Approve"}</span>
                          </button>
                        )}
                        {item.status !== "held" && item.status !== "sent" && (
                          <button
                            onClick={() => hold(item.id)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 px-2.5 py-1 text-[11px] font-semibold text-zinc-300 hover:border-amber-500/40 hover:text-amber-300"
                          >
                            <Pause className="w-3 h-3" />
                            <span>Hold</span>
                          </button>
                        )}
                        {item.status !== "sent" && (
                          <button
                            onClick={() => setEditing({ id: item.id, to: item.to, subject: item.subject, body: item.body })}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 px-2.5 py-1 text-[11px] font-semibold text-zinc-300 hover:border-zinc-600 hover:text-white"
                          >
                            <Pencil className="w-3 h-3" />
                            <span>Edit</span>
                          </button>
                        )}
                        {item.status !== "sent" && (
                          <button
                            onClick={() => sendIds([item.id])}
                            disabled={sending || !tokenReady}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/40 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <Send className="w-3 h-3" />
                            <span>Send now</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Ledger */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 sm:p-5 space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <History className="w-4 h-4 text-emerald-400" />
            What actually left
          </h3>
          <p className="text-xs text-zinc-400 mt-1">
            One row per message Gmail accepted. The matching lead moved to Contacted and the activity
            feed carries the same event.
          </p>
        </div>
        {history.length === 0 ? (
          <p className="text-xs text-zinc-500">No message has been sent from this account yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11px]">
              <thead className="text-zinc-500 font-mono uppercase tracking-widest">
                <tr className="border-b border-zinc-800">
                  <th className="py-2 pr-3">When</th>
                  <th className="py-2 pr-3">Company</th>
                  <th className="py-2 pr-3">Address</th>
                  <th className="py-2 pr-3">Subject</th>
                  <th className="py-2 pr-3">Mode</th>
                  <th className="py-2">Gmail id</th>
                </tr>
              </thead>
              <tbody className="text-zinc-300">
                {history.map((entry) => (
                  <tr key={entry.id} className="border-b border-zinc-900">
                    <td className="py-2 pr-3 whitespace-nowrap font-mono text-zinc-500">{timeAgo(entry.sentAt)}</td>
                    <td className="py-2 pr-3">{entry.company}</td>
                    <td className="py-2 pr-3 font-mono">{entry.to}</td>
                    <td className="py-2 pr-3 max-w-[220px] truncate">{entry.subject}</td>
                    <td className="py-2 pr-3 font-mono">{entry.mode}</td>
                    <td className="py-2 font-mono text-zinc-500">{entry.messageId || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
