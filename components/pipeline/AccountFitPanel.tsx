"use client";

import { scopeKey } from "@/lib/account-scope";
import React, { useEffect, useMemo, useState } from "react";
import { Lead } from "@/types";
import {
  AccountFit,
  COMPONENT_LABELS,
  DEFAULT_PROFILE,
  DEFAULT_WEIGHTS,
  EvidenceCounts,
  FitSignals,
  IcpComponentKey,
  IcpProfile,
  IcpWeights,
  rankAccounts,
} from "@/lib/icp";

const CONFIG_KEY = "iwaju_icp_config_v1";

interface StoredConfig {
  weights: IcpWeights;
  profile: IcpProfile;
}

function loadConfig(): StoredConfig {
  try {
    const raw = localStorage.getItem(scopeKey(CONFIG_KEY));
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        weights: { ...DEFAULT_WEIGHTS, ...(parsed.weights || {}) },
        profile: { ...DEFAULT_PROFILE, ...(parsed.profile || {}) },
      };
    }
  } catch {
    // fall through to defaults
  }
  return { weights: DEFAULT_WEIGHTS, profile: DEFAULT_PROFILE };
}

interface AccountFitPanelProps {
  leads: Lead[];
  evidenceByLead?: Map<string, EvidenceCounts>;
  signalsByLead?: Map<string, FitSignals>;
  onApplyOrder: (orderedIds: string[]) => void;
}

export function AccountFitPanel({ leads, evidenceByLead, signalsByLead, onApplyOrder }: AccountFitPanelProps) {
  const [{ weights, profile }, setConfig] = useState<StoredConfig>(() => ({
    weights: DEFAULT_WEIGHTS,
    profile: DEFAULT_PROFILE,
  }));
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    setConfig(loadConfig());
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(scopeKey(CONFIG_KEY), JSON.stringify({ weights, profile }));
    } catch {
      // storage may be full; the panel still works in-memory
    }
  }, [weights, profile]);

  const ranked: AccountFit[] = useMemo(
    () =>
      rankAccounts(leads, profile, weights, (lead) => ({
        evidence: evidenceByLead?.get(String(lead.id)),
        signals: signalsByLead?.get(String(lead.id)),
      })),
    [leads, profile, weights, evidenceByLead, signalsByLead]
  );

  const signalsCovered = signalsByLead ? leads.filter((l) => signalsByLead.has(String(l.id))).length : 0;

  const setWeight = (key: IcpComponentKey, value: number) =>
    setConfig((prev) => ({ ...prev, weights: { ...prev.weights, [key]: value } }));

  const dealValueShare = Math.round(
    (weights.dealValue / Math.max(1, Object.values(weights).reduce((a, b) => a + b, 0))) * 100
  );

  return (
    <div className="p-5 bg-[#09090b] border border-[#27272a] rounded-xl space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#18181b] pb-3">
        <div className="space-y-0.5">
          <h2 className="text-xs font-semibold text-white font-mono uppercase tracking-wider">
            Account Fit (explainable ICP score)
          </h2>
          <p className="text-[11px] text-zinc-400">
            Computed in your browser from stored records. Nothing here is a model guess: each component shows the
            fields it used, and components with no data are reported as unmeasured instead of averaged to 50.
          </p>
        </div>
        <button
          onClick={() => onApplyOrder(ranked.map((r) => r.leadId))}
          disabled={ranked.length === 0}
          className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-[11px] font-semibold transition-colors cursor-pointer disabled:opacity-40"
        >
          Apply this order to the board
        </button>
      </div>

      {/* Weight controls */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {(Object.keys(COMPONENT_LABELS) as IcpComponentKey[]).map((key) => (
          <label key={key} className="space-y-1">
            <div className="flex items-center justify-between text-[10px] font-mono uppercase text-zinc-500">
              <span>{COMPONENT_LABELS[key]}</span>
              <span className="text-zinc-300">{weights[key]}</span>
            </div>
            <input
              type="range"
              min={0}
              max={40}
              step={1}
              value={weights[key]}
              onChange={(e) => setWeight(key, Number(e.target.value))}
              className="w-full accent-emerald-500"
              aria-label={`${COMPONENT_LABELS[key]} weight`}
            />
          </label>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] font-mono text-zinc-500">
        <span>
          Deal size is <span className="text-emerald-400">{dealValueShare}%</span> of the total weight.
        </span>
        <span>Target niches: {profile.targetNiches.length}</span>
        <span>Target cities: {profile.targetCities.length}</span>
        <span>Employee band: {profile.minEmployees}-{profile.maxEmployees}</span>
        <span>
          Growth/technology inputs measured for{" "}
          <span className={signalsCovered > 0 ? "text-emerald-400" : "text-zinc-400"}>{signalsCovered}</span> of{" "}
          {leads.length} record(s){signalsCovered === 0 ? " — run the Buying-Signal Monitor to fill them" : ""}.
        </span>
      </div>

      {/* Ranked list */}
      <div className="space-y-1.5">
        {ranked.length === 0 ? (
          <p className="text-[11px] text-zinc-500 py-4 text-center">No leads in the CRM to score.</p>
        ) : (
          ranked.slice(0, 25).map((fit, index) => (
            <div key={fit.leadId} className="border border-[#18181b] rounded-lg bg-[#050505]">
              <button
                type="button"
                onClick={() => setExpanded(expanded === fit.leadId ? null : fit.leadId)}
                className="w-full flex items-center gap-3 px-3 py-2 text-left cursor-pointer"
              >
                <span className="text-[10px] font-mono text-zinc-600 w-5">{index + 1}</span>
                <span className="text-xs text-white font-medium flex-1 truncate">{fit.company || "Unnamed account"}</span>
                <span className="text-[10px] font-mono text-zinc-600">data {fit.confidence}%</span>
                <span
                  className={`text-sm font-semibold font-mono ${
                    fit.totalScore >= 70 ? "text-emerald-400" : fit.totalScore >= 45 ? "text-amber-400" : "text-zinc-400"
                  }`}
                >
                  {fit.totalScore}
                </span>
              </button>

              {expanded === fit.leadId && (
                <div className="px-3 pb-3 space-y-1.5 border-t border-[#18181b] pt-2.5">
                  {fit.components.map((component) => (
                    <div
                      key={component.key}
                      className="flex items-start gap-2 text-[11px]"
                    >
                      <span
                        className={`font-mono w-8 shrink-0 ${
                          !component.measured
                            ? "text-zinc-600"
                            : component.rawScore >= 70
                              ? "text-emerald-400"
                              : component.rawScore >= 40
                                ? "text-amber-400"
                                : "text-red-400"
                        }`}
                      >
                        {component.measured ? component.rawScore : "—"}
                      </span>
                      <div className="min-w-0">
                        <p className="text-zinc-300">
                          {component.label}
                          <span className="text-zinc-600"> · weight {component.weight}</span>
                        </p>
                        <p className="text-zinc-500">{component.reason}</p>
                      </div>
                    </div>
                  ))}
                  {fit.unmeasured.length > 0 && (
                    <p className="text-[10px] text-zinc-600 font-mono pt-1.5 border-t border-[#18181b]">
                      Unmeasured: {fit.unmeasured.map((k) => COMPONENT_LABELS[k]).join(", ")}. The score renormalises
                      over what is known rather than inventing a midpoint.
                    </p>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {ranked.length > 25 && (
        <p className="text-[10px] text-zinc-600 font-mono">
          Showing the top 25 of {ranked.length} scored records.
        </p>
      )}
    </div>
  );
}
