"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import type {
  Campaign,
  CampaignProgress,
  CampaignStep,
  CampaignTouch,
  ConsentRecord,
  Lead,
  TouchOutcome,
} from "@/types";
import { loadTouches, progressForCampaign, saveTouches, statsForCampaign, recordTouch } from "@/lib/campaigns";
import { decideChannel, type OutboundChannel } from "@/lib/consent";
import { factsFromLead } from "@/lib/outreach-facts";
import { buildCsv, copyToClipboard, downloadText, handoffOptions } from "@/lib/handoff";
import { ContactPicker } from "@/components/campaign/ContactPicker";
import { Check, Copy, Download, Pause, Play, Trash2, X } from "lucide-react";

type ConsentStore = Record<string, Partial<Record<OutboundChannel, ConsentRecord>>>;

interface DraftState {
  leadId: string;
  stepId: string;
  loading: boolean;
  subject: string;
  body: string;
  note: string;
  channelAllowed: boolean;
  channelReason: string;
  droppedClaims: string[];
  placeholders: string[];
  error: string | null;
}

interface CampaignDetailProps {
  campaign: Campaign;
  leads: Lead[];
  touches: CampaignTouch[];
  consent: ConsentStore;
  onChange: (campaign: Campaign) => void;
  onLeadsSaved: (leads: Lead[]) => void;
  onTouchesChanged: (touches: CampaignTouch[]) => void;
  onDelete: (campaignId: string) => void;
  onStageChange: (leadId: string, stage: "contacted") => void;
}

const OUTCOMES: { id: TouchOutcome; label: string; help: string }[] = [
  { id: "prepared", label: "Draft ready", help: "You wrote it. Nothing has left the building." },
  { id: "handed_off", label: "Handed off / sent by me", help: "You sent it through your own mail app or phone." },
  { id: "replied", label: "They replied", help: "Stops the sequence so it does not follow up over a live conversation." },
  { id: "no_answer", label: "No answer", help: "Call or message went unanswered; the next step stays queued." },
  { id: "declined", label: "Declined", help: "Stops the sequence on this contact." },
  { id: "unsubscribed", label: "Asked to be left alone", help: "Stops permanently. Remove them from every campaign." },
  { id: "blocked", label: "Blocked / bounced", help: "Stops and flags the channel as dead." },
];

const STATE_STYLE: Record<CampaignProgress["state"], string> = {
  not_started: "text-zinc-400 border-zinc-700",
  due_now: "text-emerald-300 border-emerald-500/40 bg-emerald-500/10",
  overdue: "text-amber-300 border-amber-500/40 bg-amber-500/10",
  waiting: "text-sky-300 border-sky-500/30 bg-sky-500/5",
  awaiting_reply: "text-violet-300 border-violet-500/30 bg-violet-500/5",
  finished: "text-zinc-300 border-zinc-600",
  stopped: "text-red-300 border-red-500/30 bg-red-500/5",
};

const STATUS_LABEL: Record<Campaign["status"], string> = {
  draft: "Draft",
  active: "Running",
  paused: "Paused",
  finished: "Finished",
  archived: "Archived",
};

function formatDue(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) + " " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export function CampaignDetail({
  campaign,
  leads,
  touches,
  consent,
  onChange,
  onLeadsSaved,
  onTouchesChanged,
  onDelete,
  onStageChange,
}: CampaignDetailProps) {
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [outcomePick, setOutcomePick] = useState<Record<string, TouchOutcome>>({});
  const [notePick, setNotePick] = useState<Record<string, string>>({});
  const [addingContacts, setAddingContacts] = useState(false);
  const [copiedFlash, setCopiedFlash] = useState(false);

  const leadById = useMemo(() => new Map(leads.map((l) => [String(l.id), l])), [leads]);
  const contacts = useMemo(() => campaign.leadIds.map((id) => leadById.get(id)).filter((l): l is Lead => Boolean(l)), [campaign.leadIds, leadById]);
  const progress = useMemo(() => progressForCampaign(campaign, leads, touches), [campaign, leads, touches]);
  const stats = useMemo(() => statsForCampaign(campaign, leads, touches), [campaign, leads, touches]);
  const progressByLead = useMemo(() => new Map(progress.map((p) => [p.leadId, p])), [progress]);

  const missingFromCrm = campaign.leadIds.filter((id) => !leadById.has(id));

  const setStatus = (status: Campaign["status"]) => onChange({ ...campaign, status, updatedAt: new Date().toISOString() });

  const writeDraft = async (lead: Lead, step: CampaignStep) => {
    setDraft({
      leadId: lead.id,
      stepId: step.id,
      loading: true,
      subject: "",
      body: "",
      note: "",
      channelAllowed: true,
      channelReason: "",
      droppedClaims: [],
      placeholders: [],
      error: null,
    });
    try {
      const priors = touches.filter((t) => t.campaignId === campaign.id && t.leadId === lead.id).map((t) => ({ stepOrder: t.stepOrder, outcome: t.outcome, at: t.at }));
      const res = await fetch("/api/campaigns/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaign: { name: campaign.name, purpose: campaign.purpose, channel: campaign.channel },
          lead,
          step,
          approvedFacts: factsFromLead(lead).filter((f) => f.approvedByDefault),
          priors,
          consent,
        }),
      });
      const envelope = await res.json();
      if (!envelope?.success) {
        setDraft((prev) => (prev ? { ...prev, loading: false, error: envelope?.error || "The writer refused." } : prev));
        return;
      }
      const d = envelope.data;
      setDraft({
        leadId: lead.id,
        stepId: step.id,
        loading: false,
        subject: d.subject || "",
        body: d.body || "",
        note: envelope.note || "",
        channelAllowed: d.channelAllowed,
        channelReason: d.channelReason,
        droppedClaims: d.droppedClaims || [],
        placeholders: d.placeholders || [],
        error: null,
      });
    } catch (err: any) {
      setDraft((prev) => (prev ? { ...prev, loading: false, error: `Writer call failed: ${err?.message}` } : prev));
    }
  };

  const saveTouch = (lead: Lead, step: CampaignStep, outcome: TouchOutcome, note?: string) => {
    const entry = recordTouch({ campaign, leadId: lead.id, step, outcome, note });
    const next = [entry, ...loadTouches()];
    saveTouches(next);
    onTouchesChanged(next);
    if (outcome === "handed_off" && lead.stage === "new") onStageChange(lead.id, "contacted");
  };

  const exportCsv = () => {
    const header = ["campaign", "status", "company", "contact", "stage", "state", "next_step", "due", "last_touch", "outcome", "deal_value", "currency"];
    const rows = progress.map((p) => {
      const lead = leadById.get(p.leadId);
      return [
        campaign.name,
        STATUS_LABEL[campaign.status],
        p.company,
        p.name,
        p.stage,
        p.state.replace("_", " "),
        p.nextStepLabel,
        p.nextDueAt ? formatDue(p.nextDueAt) : "",
        p.lastTouchAt ? formatDue(p.lastTouchAt) : "",
        p.lastOutcome || "",
        lead?.dealValue ?? 0,
        lead?.currency || "NGN",
      ];
    });
    downloadText(`${campaign.name.replace(/[^\w-]+/g, "-").toLowerCase()}.csv`, buildCsv(header, rows));
  };

  const copyDraft = async () => {
    if (!draft) return;
    const ok = await copyToClipboard(`${draft.subject ? `${draft.subject}\n\n` : ""}${draft.body}`);
    if (ok) {
      setCopiedFlash(true);
      window.setTimeout(() => setCopiedFlash(false), 1800);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header + controls */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-extrabold text-white tracking-tight truncate">{campaign.name}</h3>
              <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border border-zinc-700 text-zinc-400">
                {STATUS_LABEL[campaign.status]}
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-1 max-w-2xl">{campaign.purpose || "No purpose recorded."}</p>
            <p className="text-[11px] text-zinc-600 mt-1">
              {campaign.channel} · {contacts.length} contact(s) · started {formatDue(campaign.startAt)}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {campaign.status !== "active" ? (
              <button
                type="button"
                onClick={() => setStatus("active")}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
              >
                <Play className="w-3.5 h-3.5" /> Start
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setStatus("paused")}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold border border-zinc-700"
              >
                <Pause className="w-3.5 h-3.5" /> Pause
              </button>
            )}
            <button
              type="button"
              onClick={() => setStatus("finished")}
              className="px-3 py-2 rounded-lg text-xs text-zinc-400 hover:text-white border border-zinc-800"
            >
              Mark finished
            </button>
            <button
              type="button"
              onClick={exportCsv}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-zinc-400 hover:text-white border border-zinc-800"
            >
              <Download className="w-3.5 h-3.5" /> Export CSV
            </button>
            <button
              type="button"
              onClick={() => onDelete(campaign.id)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-zinc-500 hover:text-red-400 border border-zinc-800"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
          {[
            { k: "Contacts", v: stats.contacts },
            { k: "Touched", v: stats.touched },
            { k: "Due now", v: stats.dueNow },
            { k: "Overdue", v: stats.overdue },
            { k: "Replied", v: stats.replied },
            { k: "Stopped", v: stats.declined + stats.unsubscribed + stats.blocked },
          ].map((cell) => (
            <div key={cell.k} className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">{cell.k}</p>
              <p className="text-lg font-bold text-white">{cell.v}</p>
            </div>
          ))}
        </div>

        {/* Sequence strip */}
        <div className="flex flex-wrap gap-2">
          {campaign.steps.map((step, i) => {
            const sp = stats.stepProgress.find((row) => row.stepId === step.id);
            return (
              <div key={step.id} className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 min-w-[150px]">
                <p className="text-[10px] font-mono text-zinc-500">#{i + 1} · +{step.waitDays}d · {step.kind}</p>
                <p className="text-xs font-semibold text-zinc-100">{step.label}</p>
                <p className="text-[10px] text-zinc-500 mt-0.5">
                  {sp ? `${sp.done} done · ${sp.pending} waiting` : "0 done"}
                </p>
              </div>
            );
          })}
        </div>

        <p className="text-[10px] text-zinc-600">{stats.measuredFrom}</p>
        {missingFromCrm.length > 0 && (
          <p className="text-[11px] text-amber-400">
            {missingFromCrm.length} contact(s) in this campaign are no longer in the CRM (deleted from the pipeline). They are still counted in the list but have no record to work from.
          </p>
        )}
      </div>

      {/* Contacts */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Contacts &amp; follow-up clock</h4>
          <button
            type="button"
            onClick={() => setAddingContacts((v) => !v)}
            className="px-2.5 py-1.5 rounded-lg text-xs text-zinc-300 hover:text-white border border-zinc-800"
          >
            {addingContacts ? "Close" : "+ Add contacts"}
          </button>
        </div>

        {addingContacts && (
          <div className="p-4 border-b border-zinc-800">
            <ContactPicker
              leads={leads}
              selectedIds={campaign.leadIds}
              onChange={(ids) => onChange({ ...campaign, leadIds: ids, updatedAt: new Date().toISOString() })}
              onLeadsSaved={onLeadsSaved}
            />
          </div>
        )}

        <div className="divide-y divide-zinc-800/70">
          {contacts.length === 0 && (
            <p className="p-6 text-xs text-zinc-500">No contacts in this campaign yet. Add them above — they come from the same CRM list the pipeline board shows.</p>
          )}
          {contacts.map((lead) => {
            const p = progressByLead.get(lead.id);
            if (!p) return null;
            const nextStep = campaign.steps.find((s) => s.id === p.nextStepId) || null;
            const emailDecision = decideChannel("email", { consent: consent[lead.id]?.email, email: lead.email, stage: lead.stage });
            const phoneDecision = decideChannel("phone", { consent: consent[lead.id]?.phone, phone: lead.phone, email: lead.email, stage: lead.stage });
            const isOpen = draft?.leadId === lead.id;
            const key = `${lead.id}:${nextStep?.id || "none"}`;

            return (
              <div key={lead.id} className="px-4 py-3.5 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-zinc-100 truncate">{lead.company}</p>
                    <p className="text-[11px] text-zinc-500 truncate">
                      {lead.name || "no person named"} {lead.title ? `· ${lead.title}` : ""} · {lead.email || "no email"}
                    </p>
                    <p className="text-[10px] text-zinc-600 mt-0.5 flex flex-wrap items-center gap-2">
                      <span className={`px-1.5 py-0.5 rounded border ${STATE_STYLE[p.state]}`}>{p.state.replace("_", " ")}</span>
                      <span className={emailDecision.allowed ? "text-zinc-500" : "text-amber-400"}>
                        email {emailDecision.allowed ? "ok" : "blocked"}
                      </span>
                      <span className={phoneDecision.allowed ? "text-zinc-500" : "text-amber-400"}>
                        call {phoneDecision.allowed ? "ok" : "needs consent"}
                      </span>
                      {p.overdueDays > 0 && <span className="text-amber-400">{p.overdueDays}d late</span>}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-2 shrink-0">
                    <div className="text-right">
                      <p className="text-[10px] uppercase tracking-wider text-zinc-600">next</p>
                      <p className="text-[11px] text-zinc-300">{p.terminal ? p.nextStepLabel : `${p.nextStepLabel} · ${formatDue(p.nextDueAt)}`}</p>
                    </div>
                    <Link
                      href={`/outreach?leadId=${encodeURIComponent(lead.id)}`}
                      className="px-2.5 py-1.5 rounded-lg text-[11px] text-zinc-400 hover:text-white border border-zinc-800"
                    >
                      Cold email
                    </Link>
                    <Link
                      href={`/pipeline?leadId=${encodeURIComponent(lead.id)}`}
                      className="px-2.5 py-1.5 rounded-lg text-[11px] text-zinc-400 hover:text-white border border-zinc-800"
                    >
                      Record
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        onChange({ ...campaign, leadIds: campaign.leadIds.filter((id) => id !== lead.id), updatedAt: new Date().toISOString() });
                      }}
                      className="text-zinc-600 hover:text-red-400"
                      title="Remove from this campaign (stays in the CRM)"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {!p.terminal && nextStep && campaign.status === "active" && (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => writeDraft(lead, nextStep)}
                      className="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-700"
                    >
                      Draft step {nextStep.order}: {nextStep.label}
                    </button>
                    <div className="flex items-center gap-1.5">
                      <select
                        value={outcomePick[key] || "handed_off"}
                        onChange={(e) => setOutcomePick({ ...outcomePick, [key]: e.target.value as TouchOutcome })}
                        className="px-2 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-[11px] text-zinc-300"
                      >
                        {OUTCOMES.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                      <input
                        value={notePick[key] || ""}
                        onChange={(e) => setNotePick({ ...notePick, [key]: e.target.value })}
                        placeholder="note (optional)"
                        className="w-36 px-2 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-[11px] text-zinc-300 placeholder-zinc-600"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const outcome = outcomePick[key] || "handed_off";
                          saveTouch(lead, nextStep, outcome, notePick[key]);
                          setNotePick({ ...notePick, [key]: "" });
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-emerald-600/90 hover:bg-emerald-500 text-white"
                      >
                        <Check className="w-3 h-3" /> Record touch
                      </button>
                    </div>
                  </div>
                )}

                {p.terminal && (
                  <p className="text-[11px] text-zinc-500">
                    Sequence stopped on this contact ({p.lastOutcome}). Record what happened next in the pipeline note instead of adding another touch.
                  </p>
                )}

                {isOpen && draft && (
                  <DraftPanel
                    draft={draft}
                    lead={lead}
                    step={campaign.steps.find((s) => s.id === draft.stepId) || campaign.steps[0]}
                    campaign={campaign}
                    onClose={() => setDraft(null)}
                    onBodyChange={(body) => setDraft({ ...draft, body })}
                    onSubjectChange={(subject) => setDraft({ ...draft, subject })}
                    onCopy={copyDraft}
                    copied={copiedFlash}
                    onRecord={(outcome) => {
                      saveTouch(lead, campaign.steps.find((s) => s.id === draft.stepId) || campaign.steps[0], outcome, draft.note);
                      setDraft(null);
                    }}
                  />
                )}

                <TouchHistory campaign={campaign} leadId={lead.id} touches={touches} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function TouchHistory({ campaign, leadId, touches }: { campaign: Campaign; leadId: string; touches: CampaignTouch[] }) {
  const mine = touches.filter((t) => t.campaignId === campaign.id && t.leadId === leadId).sort((a, b) => b.at.localeCompare(a.at));
  if (mine.length === 0) return null;
  return (
    <ul className="space-y-1 pl-3 border-l border-zinc-800">
      {mine.slice(0, 6).map((t) => (
        <li key={t.id} className="text-[10px] text-zinc-500">
          <span className="text-zinc-400">{formatDue(t.at)}</span> · step {t.stepOrder} ({t.kind}) · {t.outcome.replace("_", " ")}
          {t.note ? ` · "${t.note}"` : ""}
          <button
            type="button"
            onClick={() => {
              const next = loadTouches().filter((x) => x.id !== t.id);
              saveTouches(next);
            }}
            className="ml-2 text-zinc-700 hover:text-red-400"
            title="Remove this recorded touch"
          >
            undo
          </button>
        </li>
      ))}
    </ul>
  );
}

function DraftPanel({
  draft,
  lead,
  step,
  campaign,
  onClose,
  onBodyChange,
  onSubjectChange,
  onCopy,
  copied,
  onRecord,
}: {
  draft: DraftState;
  lead: Lead;
  step?: CampaignStep;
  campaign: Campaign;
  onClose: () => void;
  onBodyChange: (body: string) => void;
  onSubjectChange: (subject: string) => void;
  onCopy: () => void;
  copied: boolean;
  onRecord: (outcome: TouchOutcome) => void;
}) {
  if (draft.loading) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
        <p className="text-xs text-zinc-400 animate-pulse">Writing this step for {lead.company}...</p>
      </div>
    );
  }
  if (draft.error) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 space-y-2">
        <p className="text-xs text-red-300">{draft.error}</p>
        <button type="button" onClick={onClose} className="text-[11px] text-zinc-500 hover:text-white">
          Close
        </button>
      </div>
    );
  }

  const options = step
    ? handoffOptions({
        kind: step.kind,
        lead,
        subject: draft.subject,
        body: draft.body,
        channelAllowed: draft.channelAllowed,
        channelReason: draft.channelReason,
      })
    : [];

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] text-zinc-400">{draft.note || "Draft assembled locally."}</p>
        <button type="button" onClick={onClose} className="text-zinc-500 hover:text-white">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {draft.droppedClaims.length > 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5">
          <p className="text-[11px] font-semibold text-amber-300">Flagged before you use it</p>
          <ul className="text-[11px] text-amber-200/80 mt-1 space-y-0.5">
            {draft.droppedClaims.map((c, i) => (
              <li key={i}>- {c}</li>
            ))}
          </ul>
        </div>
      )}

      {draft.placeholders.length > 0 && (
        <p className="text-[11px] text-zinc-500">
          Still to fill by hand: {draft.placeholders.join(" · ")}
        </p>
      )}

      {step && (step.kind === "call" || step.kind === "whatsapp" || step.kind === "review") ? (
        <pre className="whitespace-pre-wrap text-[11px] text-zinc-300 font-mono leading-relaxed">{draft.body}</pre>
      ) : (
        <>
          <input
            value={draft.subject}
            onChange={(e) => onSubjectChange(e.target.value)}
            placeholder="Subject"
            className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-200"
          />
          <textarea
            value={draft.body}
            onChange={(e) => onBodyChange(e.target.value)}
            className="w-full min-h-[180px] px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-[11px] text-zinc-200 font-mono leading-relaxed"
          />
        </>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {options.map((opt) =>
          opt.available && opt.href ? (
            <a
              key={opt.id}
              href={opt.href}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-500 text-white"
              title={opt.reason}
            >
              {opt.label}
            </a>
          ) : opt.available && opt.id === "copy" ? (
            <button
              key={opt.id}
              type="button"
              onClick={onCopy}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-700"
              title={opt.reason}
            >
              <Copy className="w-3 h-3" /> {copied ? "Copied" : opt.label}
            </button>
          ) : (
            <span
              key={opt.id}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] text-zinc-600 border border-zinc-800/70 cursor-not-allowed"
              title={opt.reason}
            >
              {opt.label} — {opt.reason}
            </span>
          )
        )}
        {step && (
          <button
            type="button"
            onClick={() => onRecord("prepared")}
            className="ml-auto px-3 py-2 rounded-lg text-[11px] text-zinc-400 hover:text-white border border-zinc-800"
          >
            Record as draft-ready only
          </button>
        )}
      </div>

      <p className="text-[10px] text-zinc-600">
        Nothing has been sent. {campaign.name} counts a touch only when you record one, so the dashboard reflects what you actually did, not what was queued.
      </p>
    </div>
  );
}
