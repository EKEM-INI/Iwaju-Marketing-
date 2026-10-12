"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import type { Campaign, CampaignProgress, CampaignTouch, Lead } from "@/types";
import { progressForCampaign, statsForCampaign } from "@/lib/campaigns";
import { AlertTriangle, CalendarClock, Mail, ShieldAlert } from "lucide-react";

interface DashboardProps {
  campaigns: Campaign[];
  leads: Lead[];
  touches: CampaignTouch[];
  onOpen: (campaignId: string) => void;
}

function money(value: number, currency: string): string {
  return `${currency} ${value.toLocaleString()}`;
}

function relative(iso: string | null): string {
  if (!iso) return "never";
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "never";
  const days = Math.round((Date.now() - ms) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

export function CampaignDashboard({ campaigns, leads, touches, onOpen }: DashboardProps) {
  const perCampaign = useMemo(
    () => campaigns.map((c) => ({ campaign: c, stats: statsForCampaign(c, leads, touches), progress: progressForCampaign(c, leads, touches) })),
    [campaigns, leads, touches]
  );

  const totals = useMemo(() => {
    const sum = { contacts: 0, touched: 0, dueNow: 0, overdue: 0, replied: 0, stopped: 0 };
    const currencies = new Map<string, number>();
    for (const row of perCampaign) {
      sum.contacts += row.stats.contacts;
      sum.touched += row.stats.touched;
      sum.dueNow += row.stats.dueNow;
      sum.overdue += row.stats.overdue;
      sum.replied += row.stats.replied;
      sum.stopped += row.stats.declined + row.stats.unsubscribed + row.stats.blocked;
      row.stats.valueByCurrency.forEach((v) => currencies.set(v.currency, (currencies.get(v.currency) || 0) + v.total));
    }
    return { sum, currencies: Array.from(currencies.entries()) };
  }, [perCampaign]);

  const due = useMemo(
    () =>
      perCampaign
        .flatMap<CampaignProgress & { campaignId: string; campaignName: string }>((row) =>
          row.progress
            .filter((p) => p.state === "overdue" || p.state === "due_now")
            .map((p) => ({ ...p, campaignId: row.campaign.id, campaignName: row.campaign.name }))
        )
        .sort((a, b) => b.overdueDays - a.overdueDays)
        .slice(0, 8),
    [perCampaign]
  );

  const recent = useMemo(
    () =>
      [...touches]
        .sort((a, b) => b.at.localeCompare(a.at))
        .slice(0, 6)
        .map((t) => ({ touch: t, campaign: campaigns.find((c) => c.id === t.campaignId), lead: leads.find((l) => String(l.id) === t.leadId) }))
        .filter((r) => r.touch && r.campaign),
    [touches, campaigns, leads]
  );

  if (campaigns.length === 0) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-8 space-y-3">
        <h3 className="text-sm font-bold text-white">No campaigns yet</h3>
        <p className="text-xs text-zinc-400 max-w-2xl">
          A campaign here is a sequenced list of follow-ups over contacts you already own. The contacts come from the same CRM store the
          pipeline board and the outreach generator read, so anything you source in Prospecting is immediately campaign-able.
        </p>
        <p className="text-[11px] text-zinc-500">
          Nothing is sent from this app. It keeps the cadence, records what you did, and tells you when to follow up.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { k: "Running", v: campaigns.filter((c) => c.status === "active").length, sub: `${campaigns.length} total` },
          { k: "Contacts", v: totals.sum.contacts, sub: `${totals.sum.touched} touched` },
          { k: "Due now", v: totals.sum.dueNow, sub: "across campaigns" },
          { k: "Overdue", v: totals.sum.overdue, sub: "past the wait window" },
          { k: "Replies", v: totals.sum.replied, sub: "you recorded" },
          { k: "Stopped", v: totals.sum.stopped, sub: "declined / opted out" },
        ].map((cell) => (
          <div key={cell.k} className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4">
            <p className="text-[10px] uppercase tracking-widest text-zinc-500">{cell.k}</p>
            <p className="text-2xl font-extrabold text-white mt-1">{cell.v}</p>
            <p className="text-[10px] text-zinc-600 mt-0.5">{cell.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Work due */}
        <div className="lg:col-span-2 rounded-2xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800">
            <CalendarClock className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300">Follow-ups due</h3>
          </div>
          {due.length === 0 ? (
            <p className="p-5 text-xs text-zinc-500">
              Nothing is due. Either every step is recorded, or the campaigns are still drafts — a sequence only runs while a campaign is started.
            </p>
          ) : (
            <ul className="divide-y divide-zinc-800/70">
              {due.map((row) => (
                <li key={`${row.campaignId}-${row.leadId}`} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-zinc-100 truncate">{row.company}</p>
                    <p className="text-[11px] text-zinc-500 truncate">
                      {row.campaignName} · next {row.nextStepLabel} · last touch {relative(row.lastTouchAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {row.overdueDays > 0 ? (
                      <span className="text-[10px] px-2 py-0.5 rounded border border-amber-500/40 text-amber-300">{row.overdueDays}d late</span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded border border-emerald-500/40 text-emerald-300">due today</span>
                    )}
                    <button
                      type="button"
                      onClick={() => onOpen(row.campaignId)}
                      className="px-2.5 py-1.5 rounded-lg text-[11px] text-zinc-300 hover:text-white border border-zinc-800"
                    >
                      Open
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* What this cannot know */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300">What this dashboard cannot know</h3>
          </div>
          <ul className="space-y-1.5">
            {(perCampaign[0]?.stats.notMeasured || []).map((item) => (
              <li key={item} className="text-[11px] text-zinc-500 flex gap-2">
                <AlertTriangle className="w-3 h-3 text-zinc-600 mt-0.5 shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <p className="text-[10px] text-zinc-600 border-t border-zinc-800 pt-2">
            Every number above comes from a touch you recorded. A campaign marked running does not mean messages are going out — this app has no
            sender.{" "}
            <Link href="/outreach" className="text-emerald-400 hover:underline">
              Write the cold email
            </Link>
          </p>
        </div>
      </div>

      {/* Per-campaign rows */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800">
          <Mail className="w-4 h-4 text-emerald-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300">Campaign performance (recorded touches only)</h3>
        </div>
        <div className="divide-y divide-zinc-800/70">
          {perCampaign.map((row) => (
            <button
              key={row.campaign.id}
              type="button"
              onClick={() => onOpen(row.campaign.id)}
              className="w-full text-left px-4 py-3 hover:bg-zinc-800/30 flex flex-wrap items-center gap-x-6 gap-y-2"
            >
              <div className="min-w-[180px] flex-1">
                <p className="text-xs font-bold text-white">{row.campaign.name}</p>
                <p className="text-[10px] text-zinc-500">
                  {row.campaign.status} · {row.campaign.channel} · {row.campaign.steps.length} steps
                </p>
              </div>
              <div className="text-[11px] text-zinc-400">
                {row.stats.touched}/{row.stats.contacts} touched
              </div>
              <div className="text-[11px] text-emerald-300">{row.stats.dueNow} due</div>
              <div className="text-[11px] text-amber-300">{row.stats.overdue} overdue</div>
              <div className="text-[11px] text-violet-300">{row.stats.replied} replied</div>
              {row.campaign.targetValue ? (
                <div className="text-[11px] text-zinc-500">
                  target {money(row.campaign.targetValue, row.campaign.currency || "NGN")} · pipeline{" "}
                  {money(row.stats.valueByCurrency.reduce((t, v) => t + (v.currency === (row.campaign.currency || "NGN") ? v.total : 0), 0), row.campaign.currency || "NGN")}
                </div>
              ) : (
                <div className="text-[11px] text-zinc-700">no target set</div>
              )}
            </button>
          ))}
        </div>
        {totals.currencies.length > 1 && (
          <p className="px-4 py-2.5 text-[10px] text-amber-400 border-t border-zinc-800">
            {totals.currencies.map(([c, v]) => `${c} ${v.toLocaleString()}`).join(" · ")} — these are kept apart on purpose. Mixing currencies needs an
            FX source, which this app does not have.
          </p>
        )}
      </div>

      {/* Recent touches */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300">Last things you recorded</h3>
        {recent.length === 0 ? (
          <p className="text-[11px] text-zinc-500">Nothing recorded yet. Open a campaign and log a touch after you actually contact someone.</p>
        ) : (
          <ul className="space-y-1.5">
            {recent.map(({ touch, campaign, lead }) => (
              <li key={touch.id} className="text-[11px] text-zinc-500">
                <span className="text-zinc-400">{relative(touch.at)}</span> · {campaign?.name} · {lead?.company || touch.leadId} · step {touch.stepOrder} ·{" "}
                {touch.outcome.replace("_", " ")}
                {touch.note ? ` · "${touch.note}"` : ""}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
