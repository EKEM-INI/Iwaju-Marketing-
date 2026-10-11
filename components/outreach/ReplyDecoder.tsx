"use client";

import React, { useState } from "react";
import { Inbox, RefreshCw, Copy } from "lucide-react";
import type { AgentEnvelope, GroundedFact, Lead, ReplyIntelligence } from "@/types";
import { factsFromLead, stripCitations } from "@/lib/outreach-facts";
import { useToast } from "@/components/ui/Toast";

interface Props {
  leads: Lead[];
}

const CLASSES: Record<ReplyIntelligence["classification"], string> = {
  interested: "text-emerald-400 border-emerald-500/30 bg-emerald-500/5",
  objection: "text-amber-400 border-amber-500/30 bg-amber-500/5",
  question: "text-sky-400 border-sky-500/30 bg-sky-500/5",
  referral: "text-sky-400 border-sky-500/30 bg-sky-500/5",
  not_now: "text-amber-400 border-amber-500/30 bg-amber-500/5",
  rejection: "text-red-400 border-red-500/30 bg-red-500/5",
  out_of_office: "text-zinc-400 border-zinc-700 bg-zinc-800/40",
  auto_reply: "text-zinc-400 border-zinc-700 bg-zinc-800/40",
  unclear: "text-zinc-400 border-zinc-700 bg-zinc-800/40",
};

export function ReplyDecoder({ leads }: Props) {
  const { showToast } = useToast();
  const [leadId, setLeadId] = useState<string>(leads[0] ? String(leads[0].id) : "");
  const [reply, setReply] = useState("");
  const [sentEmail, setSentEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [envelope, setEnvelope] = useState<AgentEnvelope<ReplyIntelligence> | null>(null);
  const [result, setResult] = useState<ReplyIntelligence | null>(null);

  const lead = leads.find((l) => String(l.id) === leadId) || null;

  const analyze = async () => {
    if (!reply.trim()) return;
    setBusy(true);
    try {
      const facts: GroundedFact[] = lead
        ? factsFromLead(lead)
            .filter((f) => f.approvedByDefault)
            .map((f) => ({ id: f.id, field: f.field, value: f.value, source: f.source }))
        : [];
      const res = await fetch("/api/replies/intelligence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reply, lead, sentEmail: sentEmail || undefined, facts }),
      });
      const data = (await res.json()) as AgentEnvelope<ReplyIntelligence>;
      setEnvelope(data);
      setResult(data.success ? data.data ?? null : null);
    } finally {
      setBusy(false);
    }
  };

  const copyDraft = async () => {
    if (!result?.suggestedReply) return;
    await navigator.clipboard.writeText(stripCitations(result.suggestedReply));
    showToast("Draft copied", "Read it before sending. Nothing was sent for you.", "info");
  };

  return (
    <div className="p-5 bg-[#09090b] border border-[#27272a] rounded-xl space-y-3">
      <div>
        <h2 className="text-xs font-semibold text-white font-mono uppercase tracking-wider flex items-center gap-2">
          <Inbox className="w-3.5 h-3.5 text-emerald-400" />
          Reply intelligence
        </h2>
        <p className="text-[11px] text-zinc-400">
          Paste what they answered. No inbox is connected, so nothing here can see a thread it was not given — and
          nothing is sent back on your behalf.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="space-y-2">
          <select
            value={leadId}
            onChange={(e) => setLeadId(e.target.value)}
            className="w-full bg-[#18181b] border border-[#27272a] rounded-lg px-2.5 py-1.5 text-[11px] text-white focus:outline-none"
            aria-label="Which lead this reply came from"
          >
            {leads.length === 0 && <option value="">No leads stored</option>}
            {leads.map((l) => (
              <option key={l.id} value={l.id}>
                {l.company || l.name || l.id}
              </option>
            ))}
          </select>
          <textarea
            value={sentEmail}
            onChange={(e) => setSentEmail(e.target.value)}
            rows={4}
            placeholder="Optional: paste the email you sent, so the reading has context"
            className="w-full bg-[#18181b] border border-[#27272a] rounded-lg px-3 py-2 text-[11px] text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/40 font-mono"
          />
        </div>
        <textarea
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          rows={8}
          placeholder="Paste their reply here..."
          className="w-full bg-[#18181b] border border-[#27272a] rounded-lg px-3 py-2 text-[11px] text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/40 font-mono"
          aria-label="The reply to analyse"
        />
      </div>

      <button
        onClick={analyze}
        disabled={busy || reply.trim().length < 2}
        className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
      >
        {busy ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Inbox className="w-3.5 h-3.5" />}
        <span>{busy ? "Reading..." : "Read this reply"}</span>
      </button>

      {envelope && (
        <p
          className={`text-[10px] font-mono leading-relaxed px-2.5 py-1.5 rounded-lg border ${
            envelope.success
              ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/5"
              : "text-amber-400 border-amber-500/30 bg-amber-500/5"
          }`}
        >
          {envelope.agent} · {envelope.provider} · {envelope.live ? "ChatGPT answered" : "rules only, no model"}
          {(envelope.error || envelope.note) && (
            <span className="block text-zinc-300 font-sans mt-0.5">{envelope.error || envelope.note}</span>
          )}
        </p>
      )}

      {result && (
        <div className="space-y-2.5 pt-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded border ${CLASSES[result.classification]}`}
            >
              {result.classification}
            </span>
            <span className="text-[10px] font-mono text-zinc-500">
              {result.sentiment} · confidence {Math.round(result.confidence * 100)}%
              {result.suggestedStage ? ` · suggested stage: ${result.suggestedStage}` : ""}
            </span>
          </div>

          {result.evidenceQuotes.length > 0 && (
            <div>
              <p className="text-[10px] font-mono uppercase text-zinc-500">Quoted from their reply</p>
              <ul className="mt-1 space-y-1">
                {result.evidenceQuotes.map((q, i) => (
                  <li key={i} className="text-[11px] text-zinc-300 italic border-l-2 border-emerald-500/40 pl-2">
                    “{q}”
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-2.5">
            <Section title="They asked for" lines={result.whatTheyAskedFor} />
            <Section title="They committed to" lines={result.commitments} />
            <Section title="Objections" lines={result.objections} />
          </div>

          <p className="text-[11px] text-zinc-400 border border-[#18181b] rounded-lg bg-[#050505] px-3 py-2">
            <span className="text-[10px] font-mono uppercase text-zinc-500 block">Between the lines</span>
            {result.readingBetweenTheLines}
          </p>

          <p className="text-[11px] text-zinc-400 border border-[#18181b] rounded-lg bg-[#050505] px-3 py-2">
            <span className="text-[10px] font-mono uppercase text-zinc-500 block">Timing</span>
            {result.followUpAdvice}
          </p>

          {result.suggestedReply ? (
            <div className="border border-emerald-500/20 rounded-lg bg-[#050505] px-3 py-2 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-mono uppercase text-emerald-400">Draft answer (uses only approved facts)</p>
                <button
                  onClick={copyDraft}
                  className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-[10px] font-semibold text-zinc-100 flex items-center gap-1 cursor-pointer"
                >
                  <Copy className="w-3 h-3" /> Copy
                </button>
              </div>
              <p className="text-[11px] text-zinc-200 whitespace-pre-wrap font-mono">{result.suggestedReply}</p>
              <p className="text-[10px] font-mono text-zinc-600">
                Facts used: {result.suggestedReplyFactsUsed.join(", ") || "none claimed"} — check before sending.
              </p>
            </div>
          ) : (
            <p className="text-[10px] font-mono text-zinc-600">
              No draft was produced: without a ChatGPT key this agent only reads, it does not write.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ title, lines }: { title: string; lines: string[] }) {
  if (!lines || lines.length === 0) return null;
  return (
    <div className="border border-[#18181b] rounded-lg bg-[#050505] px-3 py-2">
      <p className="text-[10px] font-mono uppercase text-zinc-500">{title}</p>
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
