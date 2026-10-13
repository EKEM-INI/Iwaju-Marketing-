"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Campaign, Lead } from "@/types";
import { CAMPAIGNS_UPDATED_EVENT, loadCampaigns } from "@/lib/campaigns";
import { LEADS_UPDATED_EVENT } from "@/lib/storage";
import { decideChannel, loadConsentStore } from "@/lib/consent";
import { factsFromLead } from "@/lib/outreach-facts";
import { buildCsv, copyToClipboard, downloadText, mailtoHref } from "@/lib/handoff";
import { useToast } from "@/components/ui/Toast";
import { Bot, Copy, Download, Mail, RefreshCw, ShieldAlert, Users } from "lucide-react";

interface Draft {
  leadId: string;
  company: string;
  to: string;
  subject: string;
  body: string;
  usedFactIds: string[];
  inventedNumbers: string[];
  nearDuplicateOf: string | null;
  provider: string;
}

interface Skipped {
  leadId: string;
  company: string;
  reason: string;
}

interface BatchData {
  campaign: { id: string; name: string; purpose: string };
  generated: Draft[];
  skipped: Skipped[];
  stats: {
    considered: number;
    drafted: number;
    nearDuplicates: number;
    flaggedForInventedNumbers: number;
    skipped: number;
    truncated: boolean;
  };
  sent: false;
}

interface Envelope {
  success: boolean;
  status: string;
  provider?: string;
  note?: string;
  error?: string;
  data?: BatchData;
}

interface Props {
  leads: Lead[];
}

export function CampaignBatchPanel({ leads }: Props) {
  const { showToast } = useToast();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [consent, setConsent] = useState<Record<string, any>>({});
  const [campaignId, setCampaignId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Envelope | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const refresh = useCallback(() => {
    const all = loadCampaigns();
    setCampaigns(all);
    setConsent(loadConsentStore());
    setCampaignId((prev) => (prev && all.some((c) => c.id === prev) ? prev : all[0]?.id ?? ""));
  }, []);

  useEffect(() => {
    refresh();
    window.addEventListener(CAMPAIGNS_UPDATED_EVENT, refresh);
    window.addEventListener(LEADS_UPDATED_EVENT, refresh);
    return () => {
      window.removeEventListener(CAMPAIGNS_UPDATED_EVENT, refresh);
      window.removeEventListener(LEADS_UPDATED_EVENT, refresh);
    };
  }, [refresh]);

  const campaign = campaigns.find((c) => c.id === campaignId) || null;

  const preflight = useMemo(() => {
    if (!campaign) return { ready: [] as Lead[], blocked: [] as { lead: Lead; reason: string }[] };
    const byId = new Map(leads.map((l) => [String(l.id), l]));
    const ready: Lead[] = [];
    const blocked: { lead: Lead; reason: string }[] = [];
    campaign.leadIds.forEach((id) => {
      const lead = byId.get(String(id));
      if (!lead) {
        blocked.push({
          lead: { id: String(id) } as Lead,
          reason: "This contact is no longer in the lead list.",
        });
        return;
      }
      const decision = decideChannel("email", {
        consent: consent[lead.id]?.email,
        phone: lead.phone,
        email: lead.email,
        stage: lead.stage,
      });
      if (!decision.allowed) {
        blocked.push({ lead, reason: decision.reason });
        return;
      }
      const usable = factsFromLead(lead).filter((f) => f.approvedByDefault);
      if (usable.length === 0) {
        blocked.push({
          lead,
          reason: "Nothing on this record is safe to state without your tick — fill in company, sector, location or website first.",
        });
        return;
      }
      ready.push(lead);
    });
    return { ready, blocked };
  }, [campaign, leads, consent]);

  const generate = async () => {
    if (!campaign || preflight.ready.length === 0) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/outreach/batch-compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaign: { id: campaign.id, name: campaign.name, purpose: campaign.purpose },
          senderCompany: "Iwaju Marketing",
          leads: preflight.ready,
          consent,
        }),
      });
      const data: Envelope = await res.json();
      setResult(data);
      if (!data.success) {
        showToast("No drafts written", data.error || "The writer refused this batch.", "info");
      } else {
        showToast(
          "Drafts ready",
          `${data.data?.generated.length ?? 0} unique draft(s), ${data.data?.skipped.length ?? 0} skipped. Nothing was sent.`,
          "success"
        );
      }
    } catch (err: any) {
      showToast("Batch failed", `Could not reach the writer: ${err?.message}`, "error");
    } finally {
      setBusy(false);
    }
  };

  const copyOne = async (draft: Draft) => {
    const ok = await copyToClipboard(`${draft.subject}\n\n${draft.body}`);
    if (ok) {
      setCopiedId(draft.leadId);
      window.setTimeout(() => setCopiedId(null), 2000);
    } else {
      showToast("Copy blocked", "The browser refused clipboard access. Select the text and copy manually.", "info");
    }
  };

  const exportCsv = () => {
    const rows = result?.data?.generated || [];
    if (rows.length === 0) return;
    const csv = buildCsv(
      ["company", "recipient", "subject", "body", "facts used", "flagged numbers", "near duplicate of", "written by"],
      rows.map((d) => [
        d.company,
        d.to,
        d.subject,
        d.body,
        d.usedFactIds.length,
        d.inventedNumbers.join(" "),
        d.nearDuplicateOf || "",
        d.provider,
      ])
    );
    if (!downloadText(`iwaju-campaign-drafts-${Date.now()}.csv`, csv)) {
      showToast("Download blocked", "This browser would not start the download.", "info");
    }
  };

  if (campaigns.length === 0) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Users className="w-4 h-4 text-emerald-400" />
          Draft for a whole campaign
        </h3>
        <p className="text-[11px] text-zinc-400 mt-1.5">
          No campaign exists yet. Create one in Campaigns and add contacts, then come back — this writes a separate,
          grounded email for every contact in it.
        </p>
        <Link
          href="/campaigns"
          className="inline-block mt-3 px-3 py-1.5 rounded-lg bg-emerald-500 text-black text-[11px] font-semibold"
        >
          Go to Campaigns
        </Link>
      </div>
    );
  }

  const data = result?.data ?? null;

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-400" />
            Draft for a whole campaign
          </h3>
          <p className="text-[11px] text-zinc-400 mt-1 max-w-2xl">
            One write per contact, each from that contact&apos;s own record. ChatGPT writes first and Gemini answers when
            ChatGPT has no key. A contact with no usable channel or no safe fact is listed with the reason instead of
            receiving recycled copy. Nothing leaves this browser.
          </p>
        </div>
        <label className="flex items-center gap-2 text-[11px] text-zinc-400">
          <span className="font-mono uppercase">Campaign</span>
          <select
            value={campaignId}
            onChange={(e) => {
              setCampaignId(e.target.value);
              setResult(null);
            }}
            className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1 text-[11px] text-white focus:outline-none focus:border-emerald-500"
          >
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.leadIds.length})
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Pre-flight */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
        <Stat label="Contacts" value={campaign?.leadIds.length ?? 0} />
        <Stat label="Ready to draft" value={preflight.ready.length} tone="emerald" />
        <Stat label="Blocked" value={preflight.blocked.length} tone={preflight.blocked.length > 0 ? "amber" : "zinc"} />
        <Stat label="Drafts written" value={data?.generated.length ?? 0} />
      </div>

      {preflight.blocked.length > 0 && (
        <ul className="space-y-1">
          {preflight.blocked.slice(0, 6).map((b) => (
            <li key={String(b.lead.id)} className="flex items-start gap-2 text-[11px] text-amber-300">
              <ShieldAlert className="w-3 h-3 mt-0.5 shrink-0" />
              <span>
                <span className="text-zinc-200 font-medium">{b.lead.company || b.lead.id}</span>
                <span className="text-zinc-500"> — {b.reason}</span>
              </span>
            </li>
          ))}
          {preflight.blocked.length > 6 && (
            <li className="text-[10px] font-mono text-zinc-600">
              and {preflight.blocked.length - 6} more blocked contact(s).
            </li>
          )}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={generate}
          disabled={busy || preflight.ready.length === 0}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-[11px] font-semibold disabled:opacity-40 cursor-pointer"
        >
          {busy ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Bot className="w-3.5 h-3.5" />}
          <span>{busy ? `Writing ${preflight.ready.length} draft(s)...` : `Write ${preflight.ready.length} unique draft(s)`}</span>
        </button>
        {(data?.generated.length ?? 0) > 0 && (
          <button
            onClick={exportCsv}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-[11px] font-semibold cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export drafts as CSV</span>
          </button>
        )}
        {result?.note && <p className="text-[10px] font-mono text-zinc-500 flex-1 min-w-[220px]">{result.note}</p>}
      </div>

      {result && !result.success && (
        <p className="text-[11px] text-amber-400 bg-amber-500/5 border border-amber-500/20 rounded-lg px-3 py-2">
          {result.error}
        </p>
      )}

      {data && data.skipped.length > 0 && (
        <div className="rounded-lg border border-zinc-800 bg-black/30 p-3 space-y-1">
          <p className="text-[10px] font-mono uppercase text-zinc-500">Skipped during the run</p>
          {data.skipped.map((s) => (
            <p key={s.leadId} className="text-[11px] text-zinc-400">
              <span className="text-zinc-200">{s.company || s.leadId}</span>
              <span className="text-zinc-500"> — {s.reason}</span>
            </p>
          ))}
        </div>
      )}

      {data && data.generated.length === 0 && data.skipped.length === 0 && (
        <p className="text-[11px] text-zinc-500">Nothing came back. Nothing was invented to fill the gap.</p>
      )}

      {data && data.generated.length > 0 && (
        <ul className="space-y-3">
          {data.generated.map((draft) => (
            <li key={draft.leadId} className="rounded-xl border border-zinc-800 bg-black/30 p-3 space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                <span className="text-white font-semibold">{draft.company}</span>
                <span className="text-zinc-500 font-mono">{draft.to}</span>
                <span className="ml-auto px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-mono text-[10px]">
                  {draft.provider}
                </span>
              </div>
              <p className="text-[11px] text-zinc-300 font-mono">Subject: {draft.subject || "(none returned)"}</p>
              <pre className="whitespace-pre-wrap text-[11px] text-zinc-200 font-sans leading-relaxed">{draft.body}</pre>

              <div className="flex flex-wrap gap-2 text-[10px] font-mono">
                <span className="text-zinc-500">
                  {draft.usedFactIds.length} fact(s) from this record appear in the copy
                </span>
                {draft.nearDuplicateOf && (
                  <span className="text-amber-400">
                    reads like the draft for {draft.nearDuplicateOf} — reword before use
                  </span>
                )}
                {draft.inventedNumbers.length > 0 && (
                  <span className="text-rose-400">
                    numbers with no approved fact behind them: {draft.inventedNumbers.join(", ")}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => copyOne(draft)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-[10px] font-semibold cursor-pointer"
                >
                  <Copy className="w-3 h-3" />
                  <span>{copiedId === draft.leadId ? "Copied" : "Copy"}</span>
                </button>
                <a
                  href={mailtoHref(draft.to, draft.subject, draft.body)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-[10px] font-semibold"
                >
                  <Mail className="w-3 h-3" />
                  <span>Open in my mail app</span>
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="text-[10px] font-mono text-zinc-600 border-t border-zinc-800 pt-2">
        Nothing has been sent, and this page cannot send. Record what actually happened back in Campaigns so the
        follow-up clock stays honest.
      </p>
    </div>
  );
}

function Stat({ label, value, tone = "zinc" }: { label: string; value: number; tone?: "zinc" | "emerald" | "amber" }) {
  const colour =
    tone === "emerald" ? "text-emerald-400" : tone === "amber" ? "text-amber-400" : "text-white";
  return (
    <div className="rounded-lg border border-zinc-800 bg-black/20 px-2 py-1.5">
      <p className="text-[9px] font-mono uppercase text-zinc-500">{label}</p>
      <p className={`text-sm font-extrabold font-mono ${colour}`}>{value}</p>
    </div>
  );
}
