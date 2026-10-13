"use client";

import React from "react";
import type { AIComposedEmail } from "@/types";
import { ShieldCheck, ShieldAlert, Quote, Ban, Bot, KeyRound } from "lucide-react";

/**
 * Shows exactly what the writer was allowed to use, what it refused, and whether the
 * resulting copy passed the grounding checks. Read-only audit trail for the rep.
 */
export function ComposeAudit({ email }: { email: AIComposedEmail }) {
  if (!email.success) {
    return (
      <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/30 space-y-1.5">
        <div className="flex items-center gap-2 text-amber-400 text-xs font-semibold">
          <KeyRound className="w-3.5 h-3.5" />
          <span>
            {email.status === "no_key"
              ? "No live draft written"
              : email.status === "no_approved_facts"
              ? "Nothing approved to write from"
              : "Compose failed"}
          </span>
        </div>
        <p className="text-[11px] text-zinc-300 leading-relaxed">{email.error}</p>
        {email.refusedFacts.length > 0 && (
          <RefusedList facts={email.refusedFacts} />
        )}
      </div>
    );
  }

  const compliance = email.compliance;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
        <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
          <Bot className="w-3 h-3" />
          {email.provider}
        </span>
        <span className="text-zinc-500">tone: {email.tone}</span>
        {email.estimatedReadTimeSec > 0 && (
          <span className="text-zinc-500">~{email.estimatedReadTimeSec}s read</span>
        )}
        <span
          className={`ml-auto flex items-center gap-1.5 px-2 py-0.5 rounded-md border ${
            email.compliancePassed
              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
              : "bg-rose-500/10 text-rose-400 border-rose-500/30"
          }`}
        >
          {email.compliancePassed ? (
            <ShieldCheck className="w-3 h-3" />
          ) : (
            <ShieldAlert className="w-3 h-3" />
          )}
          {email.compliancePassed ? "Grounding checks passed" : "Review before sending"}
        </span>
      </div>

      {compliance && (
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-[11px] font-mono">
          <ComplianceRow ok={compliance.optOutPresent} label="Opt-out line present" />
          <ComplianceRow ok={compliance.onlyApprovedFactsCited} label="Every claim traced to an approved fact" />
          <ComplianceRow ok={compliance.senderIdentified} label="Sender identified" />
          <ComplianceRow ok={!compliance.inventedNumbersDetected} label="No invented figures" />
        </ul>
      )}

      {email.citedFacts && email.citedFacts.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] font-mono uppercase text-zinc-500 flex items-center gap-1.5">
            <Quote className="w-3 h-3" /> Facts used in this draft
          </p>
          <div className="flex flex-wrap gap-1.5">
            {email.citedFacts.map((f) => (
              <span
                key={f.id}
                className="px-2 py-0.5 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-300 text-[11px] font-mono"
                title={`source: ${f.source}`}
              >
                [{f.id.split(":").pop()}] {f.field}: {f.value}
              </span>
            ))}
          </div>
        </div>
      )}

      {email.inventedCitations && email.inventedCitations.length > 0 && (
        <p className="text-[11px] text-rose-400 font-mono">
          The draft cited facts that were never approved: {email.inventedCitations.join(", ")}. Delete those
          sentences before sending.
        </p>
      )}

      {email.inventedNumbers && email.inventedNumbers.length > 0 && (
        <p className="text-[11px] text-rose-400 font-mono">
          Numbers with no approved fact behind them: {email.inventedNumbers.join(", ")}. {email.provider} wrote
          them, but nothing on the record supports them - delete or replace each one.
        </p>
      )}

      {email.refusedFacts.length > 0 && <RefusedList facts={email.refusedFacts} />}
    </div>
  );
}

function RefusedList({ facts }: { facts: AIComposedEmail["refusedFacts"] }) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-mono uppercase text-zinc-500 flex items-center gap-1.5">
        <Ban className="w-3 h-3" /> Refused — not used
      </p>
      <ul className="space-y-0.5">
        {facts.map((f) => (
          <li key={f.id} className="text-[11px] text-zinc-500 font-mono leading-relaxed">
            <span className="text-zinc-400">{f.field}</span> — {f.reason}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ComplianceRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className={`flex items-center gap-1.5 ${ok ? "text-emerald-400" : "text-rose-400"}`}>
      {ok ? <ShieldCheck className="w-3 h-3 shrink-0" /> : <ShieldAlert className="w-3 h-3 shrink-0" />}
      <span>{label}</span>
    </li>
  );
}
