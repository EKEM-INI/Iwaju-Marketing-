"use client";

import React, { useState } from "react";
import type { Campaign, CampaignChannel, CampaignStep, ConsentRecord, Lead } from "@/types";
import { ContactPicker } from "@/components/campaign/ContactPicker";
import { campaignAssumptions, defaultSteps, newCampaign, saveCampaigns, loadCampaigns } from "@/lib/campaigns";
import type { OutboundChannel } from "@/lib/consent";
import { Sparkles, Wand2, X } from "lucide-react";

const CHANNELS: { id: CampaignChannel; label: string; hint: string }[] = [
  { id: "email", label: "Email", hint: "Corporate mailboxes only unless the person replied or opted in." },
  { id: "mixed", label: "Email + call", hint: "Needs a live consent record before the call step is allowed." },
  { id: "phone", label: "Call sequence", hint: "Every call step is blocked until consent exists." },
  { id: "whatsapp", label: "WhatsApp", hint: "Personal channel. Consent required, always." },
  { id: "linkedin", label: "LinkedIn", hint: "Manual - this app has no LinkedIn connection." },
];

const STEP_KINDS: CampaignStep["kind"][] = ["email", "call", "whatsapp", "linkedin", "review"];

type ConsentStore = Record<string, Partial<Record<OutboundChannel, ConsentRecord>>>;

interface NewCampaignFormProps {
  leads: Lead[];
  consent: ConsentStore;
  onLeadsSaved: (leads: Lead[]) => void;
  onCreated: (campaign: Campaign) => void;
  onCancel: () => void;
}

const input =
  "w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50";

export function NewCampaignForm({ leads, consent, onLeadsSaved, onCreated, onCancel }: NewCampaignFormProps) {
  const [name, setName] = useState("");
  const [purpose, setPurpose] = useState("");
  const [channel, setChannel] = useState<CampaignChannel>("email");
  const [startAt, setStartAt] = useState(new Date().toISOString().slice(0, 10));
  const [targetValue, setTargetValue] = useState("");
  const [currency, setCurrency] = useState("NGN");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [steps, setSteps] = useState<CampaignStep[]>(() => defaultSteps("email"));
  const [stepsTouched, setStepsTouched] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [planNote, setPlanNote] = useState<{ text: string; warnings: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const chooseChannel = (next: CampaignChannel) => {
    setChannel(next);
    if (!stepsTouched) setSteps(defaultSteps(next));
  };

  const requestPlan = async () => {
    if (!purpose.trim()) {
      setError("Write the purpose first — the planner needs something to sequence against.");
      return;
    }
    setPlanning(true);
    setError(null);
    try {
      const res = await fetch("/api/campaigns/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purpose: purpose.trim(),
          channel,
          leads: leads.filter((l) => selectedIds.includes(l.id)),
          consent,
        }),
      });
      const envelope = await res.json();
      if (!envelope?.success) {
        setError(envelope?.error || "The planner refused to answer.");
        return;
      }
      setSteps(envelope.data.steps);
      setStepsTouched(false);
      setPlanNote({ text: envelope.note || "Sequence planned.", warnings: envelope.data.warnings || [] });
    } catch (err: any) {
      setError(`Planner call failed: ${err?.message}`);
    } finally {
      setPlanning(false);
    }
  };

  const patchStep = (index: number, patch: Partial<CampaignStep>) =>
    setSteps((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));

  const addStep = () =>
    setSteps((prev) => [
      ...prev,
      {
        id: `step-${prev.length + 1}`,
        order: prev.length + 1,
        kind: "email",
        label: `Step ${prev.length + 1}`,
        intent: "What this touch is trying to achieve.",
        waitDays: 4,
        source: "rules",
      },
    ]);

  const removeStep = (index: number) => setSteps((prev) => prev.filter((_, i) => i !== index).map((s, i) => ({ ...s, order: i + 1 })));

  const create = () => {
    if (!name.trim()) {
      setError("Name the campaign so the dashboard can tell it apart from the next one.");
      return;
    }
    if (selectedIds.length === 0) {
      setError("Pick at least one contact. A campaign with nobody in it is a note, not a campaign.");
      return;
    }
    const ordered = steps.map((s, i) => ({ ...s, order: i + 1 }));
    const campaign = newCampaign({
      name,
      purpose,
      channel,
      leadIds: selectedIds,
      startAt: new Date(`${startAt}T09:00:00`).toISOString(),
      targetValue: targetValue ? Number(targetValue) : undefined,
      currency,
      steps: ordered,
    });
    const next = [campaign, ...loadCampaigns()];
    saveCampaigns(next);
    onCreated(campaign);
  };

  return (
    <div className="space-y-5 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-white">New campaign</h3>
          <p className="text-xs text-zinc-500 mt-0.5">
            Contacts come from the CRM you already have. This creates the sequence and the follow-up clock — it does not send anything.
          </p>
        </div>
        <button type="button" onClick={onCancel} className="text-zinc-500 hover:text-white">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-[11px] uppercase tracking-wider text-zinc-500">Campaign name</label>
          <input className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Q4 logistics outreach" />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] uppercase tracking-wider text-zinc-500">Start date</label>
          <input type="date" className={input} value={startAt} onChange={(e) => setStartAt(e.target.value)} />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-[11px] uppercase tracking-wider text-zinc-500">Purpose — what a reply should look like</label>
        <textarea
          className={`${input} min-h-[72px]`}
          value={purpose}
          onChange={(e) => setPurpose(e.target.value)}
          placeholder="Book 15-minute calls with freight operators in Port Harcourt who are short on qualified dispatch staff."
        />
      </div>

      <div className="space-y-2">
        <label className="text-[11px] uppercase tracking-wider text-zinc-500">Primary channel</label>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {CHANNELS.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => chooseChannel(c.id)}
              className={`px-2.5 py-2 rounded-lg text-left border transition-colors ${
                channel === c.id ? "border-emerald-500/50 bg-emerald-500/10" : "border-zinc-800 bg-zinc-950 hover:border-zinc-700"
              }`}
            >
              <span className="block text-xs font-semibold text-zinc-100">{c.label}</span>
            </button>
          ))}
        </div>
        <p className="text-[11px] text-zinc-500">{CHANNELS.find((c) => c.id === channel)?.hint}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-[11px] uppercase tracking-wider text-zinc-500">Optional target value</label>
          <input className={input} value={targetValue} onChange={(e) => setTargetValue(e.target.value.replace(/[^\d.]/g, ""))} placeholder="e.g. 40000000" />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] uppercase tracking-wider text-zinc-500">Currency</label>
          <input className={input} value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase().slice(0, 4))} />
        </div>
      </div>
      <p className="text-[11px] text-zinc-600 -mt-2">
        Coverage is only worked out when you set a target, and totals are never mixed across currencies.
      </p>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-[11px] uppercase tracking-wider text-zinc-500">Contacts ({selectedIds.length})</label>
        </div>
        <ContactPicker leads={leads} selectedIds={selectedIds} onChange={setSelectedIds} onLeadsSaved={onLeadsSaved} />
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="text-[11px] uppercase tracking-wider text-zinc-500">Sequence</label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={requestPlan}
              disabled={planning}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-200 text-xs font-semibold border border-zinc-700"
            >
              <Wand2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>{planning ? "Planning..." : "Suggest spacing & wording"}</span>
            </button>
            <button type="button" onClick={addStep} className="px-2.5 py-2 rounded-lg text-xs text-zinc-400 hover:text-white border border-zinc-800">
              + step
            </button>
          </div>
        </div>

        <div className="space-y-2">
          {steps.map((step, i) => (
            <div key={`${step.id}-${i}`} className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-zinc-500">#{i + 1}</span>
                <select
                  value={step.kind}
                  onChange={(e) => {
                    setStepsTouched(true);
                    patchStep(i, { kind: e.target.value as CampaignStep["kind"] });
                  }}
                  className="px-2 py-1 rounded bg-zinc-900 border border-zinc-800 text-[11px] text-zinc-300"
                >
                  {STEP_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
                <input
                  className="flex-1 px-2 py-1 rounded bg-zinc-900 border border-zinc-800 text-[11px] text-zinc-200"
                  value={step.label}
                  onChange={(e) => {
                    setStepsTouched(true);
                    patchStep(i, { label: e.target.value });
                  }}
                />
                <label className="flex items-center gap-1 text-[11px] text-zinc-500">
                  wait
                  <input
                    type="number"
                    min={0}
                    max={30}
                    value={step.waitDays}
                    onChange={(e) => {
                      setStepsTouched(true);
                      patchStep(i, { waitDays: Math.max(0, Math.min(30, Number(e.target.value) || 0)) });
                    }}
                    className="w-12 px-1.5 py-1 rounded bg-zinc-900 border border-zinc-800 text-[11px] text-zinc-200"
                  />
                  d
                </label>
                {steps.length > 1 && (
                  <button type="button" onClick={() => removeStep(i)} className="text-zinc-600 hover:text-red-400">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <input
                className="w-full px-2 py-1 rounded bg-zinc-900 border border-zinc-800 text-[11px] text-zinc-400"
                value={step.intent}
                onChange={(e) => {
                  setStepsTouched(true);
                  patchStep(i, { intent: e.target.value });
                }}
                placeholder="What this touch achieves"
              />
              {step.source === "chatgpt" && (
                <p className="text-[10px] text-emerald-400/80">wording suggested by ChatGPT — spacing guard-railed to 0-30 days</p>
              )}
            </div>
          ))}
        </div>

        {planNote && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 space-y-2">
            <p className="text-[11px] text-zinc-400 flex items-start gap-2">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
              <span>{planNote.text}</span>
            </p>
            {planNote.warnings.length > 0 && (
              <ul className="space-y-1">
                {planNote.warnings.map((w, i) => (
                  <li key={i} className="text-[11px] text-amber-400">
                    • {w}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <ul className="space-y-0.5">
          {campaignAssumptions({ ...newCampaign({ name: "x", purpose: "", channel, leadIds: [] }), steps }).map((a, i) => (
            <li key={i} className="text-[10px] text-zinc-600">
              - {a}
            </li>
          ))}
        </ul>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={create}
          className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-glow"
        >
          Create campaign
        </button>
        <button type="button" onClick={onCancel} className="px-4 py-2.5 rounded-xl text-xs text-zinc-400 hover:text-white border border-zinc-800">
          Cancel
        </button>
        <span className="text-[11px] text-zinc-600">
          {selectedIds.length > 0
            ? `${selectedIds.length} contact(s). Saving consent for call steps happens in the pipeline Reachability tab.`
            : "It starts as a draft. Nothing runs until you activate it."}
        </span>
      </div>
    </div>
  );
}
