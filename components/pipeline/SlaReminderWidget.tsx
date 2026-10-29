"use client";

import React, { useState, useMemo } from "react";
import {
  AlertTriangle,
  Clock,
  ShieldCheck,
  Check,
  ChevronRight,
  ExternalLink,
  RefreshCw,
  X,
  Mail,
  Send,
  Zap,
} from "lucide-react";
import { Lead, SlaAuditReport, SlaItem } from "@/types";
import { auditLeadsSla } from "@/lib/sla";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";
import Link from "next/link";

interface Props {
  leads: Lead[];
  onMarkContacted: (leadId: string) => void;
}

export function SlaReminderWidget({ leads, onMarkContacted }: Props) {
  const { showToast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [serverEmailSent, setServerEmailSent] = useState<boolean | null>(null);

  // Compute live client-side SLA report instantly on any lead changes
  const report: SlaAuditReport = useMemo(() => {
    return auditLeadsSla(leads);
  }, [leads]);

  const handleRunServerAudit = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch("/api/cron/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leads,
          sendEmailAlert: true,
          generateAiFollowUps: true,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setServerEmailSent(Boolean(data.emailSent));
        showToast(
          "SLA Audit Complete",
          data.emailSent
            ? `Audit logged. Alert digest emailed to sales management.`
            : `Evaluated ${data.report?.totalEvaluated} leads. ${data.report?.breachedCount} breach(es) active.`,
          data.report?.breachedCount > 0 ? "info" : "success"
        );
      }
    } catch (err: any) {
      showToast("Audit Error", err?.message || "Failed to trigger server audit", "error");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleQuickContact = (leadId: string, company: string) => {
    onMarkContacted(leadId);
    showToast(
      "SLA Reset",
      `Marked ${company} as contacted right now. SLA timer renewed.`,
      "success"
    );
  };

  return (
    <>
      {/* Top Interactive Banner */}
      <div
        className={`w-full rounded-xl border p-3 sm:p-4 transition-all ${
          report.breachedCount > 0
            ? "border-red-500/30 bg-red-950/20 text-red-200"
            : report.approachingCount > 0
            ? "border-amber-500/30 bg-amber-950/20 text-amber-200"
            : "border-emerald-500/20 bg-emerald-950/10 text-emerald-300"
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-3">
            <div
              className={`rounded-lg p-2 ${
                report.breachedCount > 0
                  ? "bg-red-500/20 text-red-400"
                  : report.approachingCount > 0
                  ? "bg-amber-500/20 text-amber-400"
                  : "bg-emerald-500/20 text-emerald-400"
              }`}
            >
              {report.breachedCount > 0 ? (
                <AlertTriangle className="size-4 animate-pulse" />
              ) : report.approachingCount > 0 ? (
                <Clock className="size-4" />
              ) : (
                <ShieldCheck className="size-4" />
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-semibold uppercase tracking-wider">
                  {report.breachedCount > 0
                    ? "SLA Follow-Up Breaches"
                    : report.approachingCount > 0
                    ? "SLA Approaching Deadline"
                    : "SLA Cadence Healthy"}
                </span>
                <span className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-[10px]">
                  Policy: 24h New / 72h Follow-up
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                {report.breachedCount > 0 ? (
                  <>
                    <strong className="text-red-400 font-semibold">
                      {report.breachedCount} high-priority deal(s)
                    </strong>{" "}
                    exceeded touch SLA deadline ({formatCurrency(report.totalAtRiskDealValue)} pipeline at risk).
                  </>
                ) : report.approachingCount > 0 ? (
                  <>
                    {report.approachingCount} deal(s) will breach their SLA within 6 hours without logged contact.
                  </>
                ) : (
                  "All candidate leads are within SLA touch windows. Follow-up cadences are up to date."
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            {report.breachedCount > 0 && (
              <button
                onClick={() => setIsOpen(true)}
                className="flex items-center gap-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 px-3 py-1.5 text-xs font-semibold text-red-300 transition-colors cursor-pointer"
              >
                <span>Review Breaches ({report.breachedCount})</span>
                <ChevronRight className="size-3.5" />
              </button>
            )}

            <button
              onClick={handleRunServerAudit}
              disabled={isSyncing || leads.length === 0}
              className="flex items-center gap-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors cursor-pointer disabled:opacity-40"
              title="Execute autonomous reminder cron audit and send email digest if configured"
            >
              {isSyncing ? (
                <RefreshCw className="size-3.5 animate-spin" />
              ) : (
                <Zap className="size-3.5 text-emerald-400" />
              )}
              <span>{isSyncing ? "Auditing..." : "Cron Audit"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* SLA Inspection Modal / Drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="relative w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl border border-zinc-800 bg-[#09090b] shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
              <div className="flex items-center gap-2.5">
                <div className="rounded-lg bg-red-500/10 p-2 text-red-400 border border-red-500/20">
                  <AlertTriangle className="size-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    SLA Follow-Up Breaches & Overdue Deals
                  </h3>
                  <p className="text-xs text-zinc-400">
                    High-priority opportunities requiring immediate rep contact or follow-up
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Metrics Overview Bar */}
            <div className="grid grid-cols-3 gap-2 border-b border-zinc-800/80 bg-zinc-950/60 p-4 text-center">
              <div>
                <p className="text-[10px] uppercase font-mono text-zinc-500">Breached Deals</p>
                <p className="text-lg font-bold text-red-400 mt-0.5">{report.breachedCount}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-mono text-zinc-500">Approaching SLA</p>
                <p className="text-lg font-bold text-amber-400 mt-0.5">{report.approachingCount}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-mono text-zinc-500">At-Risk Pipeline</p>
                <p className="text-lg font-bold text-emerald-400 mt-0.5">
                  {formatCurrency(report.totalAtRiskDealValue)}
                </p>
              </div>
            </div>

            {/* List of Breached & Approaching Deals */}
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {report.items.filter((i) => i.status !== "healthy").length === 0 ? (
                <div className="py-8 text-center text-zinc-500 text-xs">
                  <ShieldCheck className="size-8 mx-auto text-emerald-500/40 mb-2" />
                  No overdue leads found. All customer SLAs are satisfied.
                </div>
              ) : (
                report.items
                  .filter((i) => i.status !== "healthy")
                  .map((item) => (
                    <div
                      key={item.leadId}
                      className="rounded-xl border border-zinc-800 bg-[#0e0e11] p-4 space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-white text-sm">
                              {item.company}
                            </span>
                            <span className="rounded bg-zinc-800 px-2 py-0.5 font-mono text-[10px] text-zinc-300 uppercase">
                              {item.stage}
                            </span>
                            {item.isHighPriority && (
                              <span className="rounded bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.5 text-[9px] font-mono text-emerald-400 uppercase">
                                High Priority
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-zinc-400 mt-0.5">
                            {item.name} {item.title ? `• ${item.title}` : ""}
                            {item.email ? ` • ${item.email}` : ""}
                          </p>
                        </div>

                        <div className="text-right">
                          <span
                            className={`inline-block rounded-md px-2 py-1 font-mono text-xs font-semibold ${
                              item.status === "breached"
                                ? "bg-red-500/20 text-red-300 border border-red-500/30"
                                : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                            }`}
                          >
                            {item.status === "breached"
                              ? `+${item.overdueHours}h Overdue`
                              : `${item.targetSlaHours - item.elapsedHours}h Remaining`}
                          </span>
                          <p className="text-xs font-bold text-white mt-1">
                            {formatCurrency(item.dealValue)}
                          </p>
                        </div>
                      </div>

                      {/* Breach explanation */}
                      <div className="rounded-lg bg-zinc-950/70 p-2.5 text-xs border border-zinc-800/80">
                        <p className="text-zinc-300">
                          <span className="font-mono text-zinc-500 mr-1.5">REASON:</span>
                          {item.breachReason}
                        </p>
                        <p className="text-emerald-400 mt-1 font-medium">
                          <span className="font-mono text-zinc-500 mr-1.5">ACTION:</span>
                          {item.recommendedAction}
                        </p>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          onClick={() => handleQuickContact(item.leadId, item.company)}
                          className="flex items-center gap-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer"
                        >
                          <Check className="size-3.5 stroke-[2.5]" />
                          <span>Mark Contacted Now</span>
                        </button>

                        <Link
                          href="/outreach"
                          onClick={() => setIsOpen(false)}
                          className="flex items-center gap-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-3 py-1.5 text-xs font-medium transition-colors"
                        >
                          <Mail className="size-3.5 text-zinc-400" />
                          <span>Draft Follow-Up</span>
                        </Link>
                      </div>
                    </div>
                  ))
              )}
            </div>

            {/* Modal Footer */}
            <div className="border-t border-zinc-800 px-5 py-3 flex items-center justify-between text-xs text-zinc-500 font-mono">
              <span>Automatic Cron Schedule: 08:00 UTC Daily</span>
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-lg px-3 py-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
