"use client";

import React, { useState, useEffect } from "react";
import {
  Cpu,
  Bot,
  Sparkles,
  Terminal,
  Play,
  Pause,
  Send,
  CheckCheck,
  Check,
  CheckCircle2,
  X,
  ExternalLink,
  Database,
  Search,
  Target,
  MapPin,
  Building2,
  ShieldCheck,
  AlertCircle,
  ArrowRight,
  Filter,
  RefreshCw,
  Edit3,
} from "lucide-react";
import { getStoredLeads, logActivity, saveLeads } from "@/lib/storage";
import { factsFromLead, stripCitations } from "@/lib/outreach-facts";
import { ComposeAudit } from "@/components/outreach/ComposeAudit";
import { AutonomousRunPanel } from "@/components/ai/AutonomousRunPanel";
import { Lead, FactItem, AutonomousAccount, AISortResult, AIComposedEmail, EvaluatedLead, LeadVerdict, AgentReport, PipelineStage } from "@/types";

const ACCOUNT_STAGE_FOR_PIPELINE: Record<PipelineStage, AutonomousAccount["stage"]> = {
  new: "new",
  contacted: "discovery",
  meeting: "demo",
  closed: "won",
};

/**
 * A CRM record shown in the monitoring queue before any agent has looked at it.
 * The queue is built from the stored leads so this page lists the same companies
 * the pipeline board lists, instead of a separate cast of demo accounts.
 */
function accountFromLead(lead: Lead): AutonomousAccount {
  const domain = (lead.website || "")
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0];

  return {
    id: `acc-${lead.id}`,
    name: lead.company,
    domain: domain || "not recorded",
    niche: lead.niche || "Not recorded",
    location: lead.location || "Not recorded",
    dealValue: `${lead.currency || "NGN"} ${(lead.dealValue || 0).toLocaleString()}`,
    rawDealValue: lead.dealValue || 0,
    stage: ACCOUNT_STAGE_FOR_PIPELINE[lead.stage] || "new",
    agentStatus: "not-audited",
    lastAction: "In the queue but no agent pass has judged this record yet.",
    owner: lead.name || "Unassigned",
    facts: {
      decisionMaker: lead.name || "Not recorded",
      title: lead.title || "Not recorded",
      email: lead.email || "Not recorded",
      phone: lead.phone || "Not recorded",
      employees: "Not recorded",
      techStack: [],
      summary: lead.notes || "No notes on record.",
    },
    evidenceLedger: [],
    agentNotes: [],
    nextRecheck: "Not scheduled",
  };
}

function reportAsText(report: AgentReport): string {
  return [
    "IWAJU MARKETING — LEAD QUALIFICATION REPORT",
    report.headline,
    "",
    `Audited: ${report.reviewedCount} | Qualified: ${report.qualifiedCount} | Needs review: ${report.needsReviewCount} | Disqualified: ${report.disqualifiedCount} | Avg score: ${report.averageScore}`,
    "",
    report.executiveSummary,
    "",
    "DATA QUALITY FINDINGS",
    ...report.dataQualityFindings.map((f) => `- ${f}`),
    "",
    "TOP TARGETS",
    ...report.topTargets.map((t) => `- ${t.company}: ${t.why}`),
    "",
    "NEXT ACTIONS",
    ...report.nextActions.map((a, i) => `${i + 1}. ${a}`),
    "",
    "Assessment only: ChatGPT judged stored fields. No DNS, registry or LinkedIn verification was performed.",
  ].join("\n");
}

export default function AutonomousPage() {
  const [accounts, setAccounts] = useState<AutonomousAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<AutonomousAccount | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [detailTab, setDetailTab] = useState<"overview" | "evidence" | "agent">("overview");

  // Keep the monitoring queue in step with the CRM store it is drawn from.
  useEffect(() => {
    const syncFromStore = () => {
      setAccounts((prev) => {
        const audited = prev.filter((a) => a.agentStatus !== "not-audited");
        const auditedIds = new Set(audited.map((a) => a.id));
        const queue = getStoredLeads().map(accountFromLead).filter((a) => !auditedIds.has(a.id));
        return [...audited, ...queue];
      });
    };
    syncFromStore();
    window.addEventListener("iwaju-leads-updated", syncFromStore);
    return () => window.removeEventListener("iwaju-leads-updated", syncFromStore);
  }, []);

  // Real Agent Loop State (Comp AI Reference)
  const [targetNiche, setTargetNiche] = useState<string>("Commercial Real Estate Development");
  const [targetCity, setTargetCity] = useState<string>("Lagos, Nigeria");
  const [loopRunning, setLoopRunning] = useState<boolean>(false);
  const [loopPhase, setLoopPhase] = useState<"idle" | "scouting" | "researching" | "analyzing" | "completed">("idle");
  const [currentStepText, setCurrentStepText] = useState<string>("");
  const [loopProgress, setLoopProgress] = useState<number>(0);
  const [facts, setFacts] = useState<FactItem[]>([]);
  const [factLedgerTab, setFactLedgerTab] = useState<"suggestions" | "strong" | "all" | "terminal">("suggestions");
  const [editingFactId, setEditingFactId] = useState<string | null>(null);
  const [editFactValue, setEditFactValue] = useState<string>("");
  const [notificationBanner, setNotificationBanner] = useState<{ message: string; type: "success" | "info" | "warn" } | null>(null);
  // ChatGPT Brain States
  const [brainProvider, setBrainProvider] = useState<string>("No AI pass run yet");
  const [isLiveChatGPT, setIsLiveChatGPT] = useState<boolean>(false);
  const [brainError, setBrainError] = useState<string | null>(null);
  const [agentReport, setAgentReport] = useState<AgentReport | null>(null);
  const [isAiSortingOpen, setIsAiSortingOpen] = useState<boolean>(false);
  const [isAiSortingLoading, setIsAiSortingLoading] = useState<boolean>(false);
  const [aiSortResult, setAiSortResult] = useState<AISortResult | null>(null);

  // ChatGPT Cold Email Composer State
  const [isAiEmailOpen, setIsAiEmailOpen] = useState<boolean>(false);
  const [isAiEmailLoading, setIsAiEmailLoading] = useState<boolean>(false);
  const [emailTargetLead, setEmailTargetLead] = useState<any | null>(null);
  const [composedEmail, setComposedEmail] = useState<AIComposedEmail | null>(null);
  const [emailAngle, setEmailAngle] = useState<string>("direct");
  const [copiedEmail, setCopiedEmail] = useState<boolean>(false);

  const [agentLogs, setAgentLogs] = useState<string[]>([
    "[STANDBY] Agent loop has not run yet. It audits leads already sourced by Apollo; it does not find new companies.",
  ]);

  const LOOP_BATCH_SIZE = 12;

  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const finishFailedRun = (message: string) => {
    setBrainError(message);
    setIsLiveChatGPT(false);
    setLoopRunning(false);
    setLoopPhase("completed");
    setLoopProgress(100);
    setCurrentStepText("Agent pass stopped: no live ChatGPT result.");
    setAgentLogs((prev) => [`[BRAIN FAILED] ${message}`, ...prev]);
    setNotificationBanner({ message, type: "warn" });
  };

  // Execute Agent Loop: audits CRM records already sourced by Apollo.
  const runTargetAgentLoop = async (customNiche?: string, customCity?: string) => {
    const niche = customNiche || targetNiche;
    const city = customCity || targetCity;
    if (customNiche) setTargetNiche(customNiche);
    if (customCity) setTargetCity(customCity);

    setLoopRunning(true);
    setLoopPhase("scouting");
    setLoopProgress(5);
    setAgentReport(null);
    setBrainError(null);
    setCurrentStepText(`Reading stored CRM leads for "${niche}" in "${city}"...`);
    setAgentLogs((prev) => [
      `[SCOUT] Agent pass started: "${niche}" / "${city}". Sourcing is Apollo's job; this pass only audits records.`,
      ...prev,
    ]);

    const stored = getStoredLeads();
    const cityName = city.split(",")[0].trim().toLowerCase();
    const nicheTerms = niche
      .toLowerCase()
      .split(/[&,/]| and /)
      .map((term) => term.trim())
      .filter((term) => term.length > 3);

    const matchesTarget = (lead: Lead) => {
      const location = (lead.location || "").toLowerCase();
      const leadNiche = (lead.niche || "").toLowerCase();
      const tags = (lead.tags || []).join(" ").toLowerCase();
      return (
        location.includes(cityName) ||
        nicheTerms.some((term) => leadNiche.includes(term) || tags.includes(term))
      );
    };

    const matched = stored.filter(matchesTarget);
    const pool = matched.length > 0 ? matched : stored;

    if (pool.length === 0) {
      setLoopRunning(false);
      setLoopPhase("completed");
      setLoopProgress(100);
      setCurrentStepText("No CRM records to qualify.");
      setAgentLogs((prev) => [
        "[BLOCKED] The CRM holds no leads. Run an Apollo search on the Prospecting page first.",
        ...prev,
      ]);
      setNotificationBanner({
        message:
          "There are no leads to qualify yet. The agent only audits records — new leads come from Apollo on the Prospecting page.",
        type: "warn",
      });
      return;
    }

    const batch = pool.slice(0, LOOP_BATCH_SIZE);
    setAgentLogs((prev) => [
      `[READ] ${stored.length} lead(s) in CRM · ${matched.length} matched the target · qualifying ${batch.length}.`,
      ...prev,
    ]);

    setLoopPhase("researching");
    setLoopProgress(20);
    setCurrentStepText(`Sending ${batch.length} stored leads to ChatGPT for qualification and reporting...`);

    let brainData: any;
    try {
      const brainRes = await fetch("/api/autonomous/brain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leads: batch, targetNiche: niche, targetCity: city }),
      });
      brainData = await brainRes.json();
    } catch (err: any) {
      finishFailedRun(`Could not reach the qualification endpoint: ${err?.message}`);
      return;
    }

    setBrainProvider(brainData?.provider || "Unknown provider");
    setIsLiveChatGPT(Boolean(brainData?.isLiveChatGPT));

    if (!brainData?.success) {
      finishFailedRun(brainData?.error || "Qualification failed.");
      return;
    }

    const verdicts: LeadVerdict[] = Array.isArray(brainData.verdicts) ? brainData.verdicts : [];
    const verdictByLead = new Map(verdicts.map((verdict) => [verdict.leadId, verdict]));

    setAgentLogs((prev) => [
      `[BRAIN] ${brainData.provider} returned ${verdicts.length} verdict(s).`,
      ...prev,
    ]);

    setLoopPhase("analyzing");

    for (let index = 0; index < batch.length; index += 1) {
      const lead = batch[index];
      const verdict = verdictByLead.get(lead.id);

      setLoopProgress(20 + Math.round(((index + 1) / batch.length) * 70));
      setCurrentStepText(`Auditing ${lead.company} (${index + 1}/${batch.length})...`);

      if (!verdict) {
        setAgentLogs((prev) => [`[SKIPPED] No verdict came back for ${lead.company}.`, ...prev]);
        continue;
      }

      const stamp = Date.now();
      const accountId = `acc-${lead.id}`;
      const domain = (lead.website || "")
        .replace(/^https?:\/\//, "")
        .replace(/^www\//, "")
        .split("/")[0];
      const statusLabel = verdict.status.replace("_", " ");

      const account: AutonomousAccount = {
        id: accountId,
        name: lead.company,
        domain: domain || "not recorded",
        niche: lead.niche || niche,
        location: lead.location || city,
        dealValue: `${lead.currency || "NGN"} ${(lead.dealValue || 0).toLocaleString()}`,
        rawDealValue: lead.dealValue || 0,
        stage: "new",
        agentStatus: verdict.status === "qualified" ? "enriched" : "needs-review",
        lastAction: `ChatGPT audit: ${statusLabel} (${verdict.qualificationScore}/100)`,
        owner: lead.name || "Unassigned",
        facts: {
          decisionMaker: lead.name || "Not recorded",
          title: lead.title || "Not recorded",
          email: lead.email || "Not recorded",
          phone: lead.phone || "Not recorded",
          employees: "Not recorded",
          techStack: [],
          summary: lead.notes || "No notes on record.",
        },
        evidenceLedger: [
          {
            id: `ev-${stamp}-${lead.id}-source`,
            source: (lead.notes || "").toUpperCase().includes("APOLLO")
              ? "apollo.organizations-search"
              : "crm.stored-record",
            fact: "Record loaded from the CRM exactly as sourced. This pass did not write contact data.",
            confidence: "observed",
            confidenceScore: 1,
            status: "auto_applied",
            timestamp: "Just now",
          },
          {
            id: `ev-${stamp}-${lead.id}-ai`,
            source: "chatgpt.assessment",
            fact: verdict.rationale || verdict.recommendedAction,
            confidence: verdict.status === "qualified" ? "observed" : "weak",
            confidenceScore: verdict.confidence,
            status: verdict.status === "qualified" ? "auto_applied" : "pending_approval",
            timestamp: "Just now",
          },
        ],
        agentNotes: [verdict.recommendedAction, ...verdict.issues].filter(Boolean).slice(0, 6),
        nextRecheck: verdict.status === "disqualified" ? "Not scheduled" : "In 7 days",
        recheckReason:
          verdict.status === "qualified"
            ? "Qualified account, periodic refresh"
            : "Rep decision required on flagged issues",
      };

      const newFacts: FactItem[] = [
        {
          id: `f-${stamp}-${lead.id}-verdict`,
          accountId,
          companyName: lead.company,
          field: "summary",
          fieldLabel: "AI Qualification Verdict",
          value: `${statusLabel} · ${verdict.qualificationScore}/100`,
          source: "chatgpt.assessment",
          method: "llm_audit",
          kind: "supporting",
          confidence: verdict.confidence,
          scoreBand: verdict.confidence >= 0.8 ? "strong" : "weak",
          status: verdict.status === "qualified" ? "auto_applied" : "pending_approval",
          rationale: verdict.rationale,
          timestamp: "Just now",
        },
        ...verdict.issues.map((issue, issueIndex) => ({
          id: `f-${stamp}-${lead.id}-issue-${issueIndex}`,
          accountId,
          companyName: lead.company,
          field: "summary" as const,
          fieldLabel: `Flagged issue ${issueIndex + 1}`,
          value: issue,
          source: "chatgpt.assessment",
          method: "llm_audit",
          kind: "weak" as const,
          confidence: verdict.confidence,
          scoreBand: "weak" as const,
          status: "pending_approval" as const,
          rationale: "Raised by ChatGPT while auditing the supplied record only.",
          timestamp: "Just now",
        })),
      ];

      setAccounts((prev) => [account, ...prev.filter((a) => a.id !== account.id)]);
      setFacts((prev) => [...newFacts, ...prev]);
      setAgentLogs((prev) => [
        `[AUDIT] ${lead.company} -> ${statusLabel.toUpperCase()} (${verdict.qualificationScore}/100, confidence ${verdict.confidence.toFixed(2)})`,
        ...(verdict.issues.length > 0
          ? verdict.issues.map((issue) => `[FLAG] ${lead.company}: ${issue}`)
          : [`[CLEAR] ${lead.company}: no data issues detected in the stored fields.`]),
        `[ACTION] ${verdict.recommendedAction}`,
        ...prev,
      ]);

      await wait(180);
    }

    const scored = stored.map((lead) => {
      const verdict = verdictByLead.get(lead.id);
      return verdict ? { ...lead, score: verdict.qualificationScore } : lead;
    });
    saveLeads(scored);

    const report: AgentReport | null = brainData.report || null;
    setAgentReport(report);

    if (report) {
      logActivity({
        id: `act-${Date.now()}`,
        type: "note_added",
        title: `Qualification pass: ${report.reviewedCount} lead(s) audited`,
        description: report.headline,
        timestamp: new Date().toISOString(),
      });
    }

    setLoopProgress(100);
    setLoopPhase("completed");
    setLoopRunning(false);
    setCurrentStepText(
      `Pass complete: ${verdicts.length} stored lead(s) audited for "${niche}" in "${city}".`
    );
    setAgentLogs((prev) => [
      `[LEDGER_SWEEP] Pass settled. Scores written to ${verdicts.length} record(s); flagged issues queued for rep review.`,
      ...prev,
    ]);
    setNotificationBanner({
      message:
        report?.executiveSummary ||
        `Audited ${verdicts.length} leads. ${verdicts.filter((v) => v.status === "qualified").length} qualified.`,
      type: "info",
    });
  };

  // Suggestion Approval Handlers
  const handleApproveSuggestion = (factId: string, customVal?: string) => {
    const targetFact = facts.find((f) => f.id === factId);
    if (!targetFact) return;

    const finalVal = customVal || targetFact.value;

    setFacts((prev) =>
      prev.map((f) => (f.id === factId ? { ...f, status: "approved", value: finalVal } : f))
    );

    setAccounts((prev) =>
      prev.map((acc) => {
        if (acc.id === targetFact.accountId || acc.name === targetFact.companyName) {
          const updatedFacts = { ...acc.facts };
          if (targetFact.field === "techStack") {
            const stacks = Array.isArray(acc.facts.techStack)
              ? [...acc.facts.techStack.filter((t) => t !== "Pending Rep Approval"), finalVal]
              : [finalVal];
            updatedFacts.techStack = stacks;
          } else if (targetFact.field === "decisionMaker") {
            updatedFacts.decisionMaker = finalVal;
          } else if (targetFact.field === "email") {
            updatedFacts.email = finalVal;
          } else if (targetFact.field === "phone" || targetFact.field === "directMobile") {
            updatedFacts.phone = finalVal;
          }

          const newEvLedger = [
            ...acc.evidenceLedger,
            {
              id: `ev-appr-${Date.now()}`,
              source: targetFact.source,
              fact: `Approved by rep: ${targetFact.fieldLabel} set to "${finalVal}"`,
              confidence: "verified" as const,
              confidenceScore: targetFact.confidence,
              status: "approved" as const,
              timestamp: "Just now",
            },
          ];

          return {
            ...acc,
            dealValue: targetFact.field === "dealValue" ? finalVal : acc.dealValue,
            lastAction: `Rep approved suggestion: ${targetFact.fieldLabel} updated`,
            facts: updatedFacts,
            evidenceLedger: newEvLedger,
          };
        }
        return acc;
      })
    );

    // Sync into stored CRM leads
    const stored = getStoredLeads();
    const updated = stored.map((l) => {
      if (l.company === targetFact.companyName) {
        return {
          ...l,
          email: targetFact.field === "email" ? finalVal : l.email,
          phone: targetFact.field === "phone" || targetFact.field === "directMobile" ? finalVal : l.phone,
          name: targetFact.field === "decisionMaker" ? finalVal.split("(")[0].trim() : l.name,
          score: Math.min(100, l.score + 4),
        };
      }
      return l;
    });
    saveLeads(updated);

    logActivity({
      id: `act-${Date.now()}`,
      type: "note_added",
      title: `Fact Approved: ${targetFact.companyName}`,
      description: `Verified ${targetFact.fieldLabel} as "${finalVal}" via Comp AI human-in-the-loop.`,
      timestamp: new Date().toISOString(),
    });

    setNotificationBanner({
      message: `Approved! Updated "${targetFact.companyName}" with ${targetFact.fieldLabel}: "${finalVal}"`,
      type: "success",
    });
    setEditingFactId(null);
  };

  const handleRejectSuggestion = (factId: string) => {
    const targetFact = facts.find((f) => f.id === factId);
    if (!targetFact) return;

    setFacts((prev) =>
      prev.map((f) => (f.id === factId ? { ...f, status: "rejected" } : f))
    );

    setNotificationBanner({
      message: `Suggestion rejected for "${targetFact.companyName}". Record left pristine.`,
      type: "info",
    });
    setEditingFactId(null);
  };

  const handleApproveAllSuggestions = () => {
    const pendingHighProb = facts.filter((f) => f.status === "pending_approval" && f.confidence >= 0.50);
    if (pendingHighProb.length === 0) return;

    pendingHighProb.forEach((fact) => {
      handleApproveSuggestion(fact.id);
    });

    setNotificationBanner({
      message: `Approved ${pendingHighProb.length} probable suggestions in batch! All records updated.`,
      type: "success",
    });
  };

  
  const handleOpenAiSort = async () => {
    setIsAiSortingOpen(true);
    setIsAiSortingLoading(true);
    try {
      const stored = getStoredLeads();
      const res = await fetch("/api/leads/ai-sort", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leads: stored, sortBy: "deal_potential" }),
      });
      const data = await res.json();
      if (data && data.sortedLeads) {
        setAiSortResult(data);
        if (data.provider) setBrainProvider(data.provider);
        if (typeof data.isLiveChatGPT === "boolean") setIsLiveChatGPT(data.isLiveChatGPT);
      }
    } catch (err) {
      console.warn("AI sort failed:", err);
    } finally {
      setIsAiSortingLoading(false);
    }
  };

  const composeFactsFor = (accountOrLead: any) => {
    const ledger = accountOrLead?.evidenceLedger;
    if (Array.isArray(ledger) && ledger.length > 0) {
      return ledger
        .filter((entry: any) => entry?.status !== "rejected")
        .map((entry: any) => ({
          id: String(entry.id),
          field: "evidence",
          value: String(entry.fact ?? ""),
          verified: entry.confidence === "verified",
          source: String(entry.source ?? "agent ledger"),
        }));
    }
    // No ledger means it is a plain CRM lead: only its firmographic defaults are usable.
    return factsFromLead(accountOrLead).map((f) => ({
      id: f.id,
      field: f.field,
      value: f.value,
      verified: f.approvedByDefault,
      source: f.source,
    }));
  };

  const handleOpenAiEmail = async (accountOrLead: any) => {
    setEmailTargetLead(accountOrLead);
    setIsAiEmailOpen(true);
    setIsAiEmailLoading(true);
    setComposedEmail(null);
    try {
      const leadPayload = {
        name: accountOrLead.facts?.decisionMaker || accountOrLead.name || "Executive Officer",
        title: accountOrLead.facts?.title || accountOrLead.title || "",
        company: accountOrLead.name || accountOrLead.company,
        niche: accountOrLead.niche || targetNiche,
        location: accountOrLead.location || targetCity,
      };
      const res = await fetch("/api/outreach/ai-compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lead: leadPayload,
          tone: emailAngle,
          senderName: "Cyril Charles",
          facts: composeFactsFor(accountOrLead),
        }),
      });
      const data: AIComposedEmail = await res.json();
      setComposedEmail(data);
    } catch (err) {
      console.warn("AI email compose failed:", err);
    } finally {
      setIsAiEmailLoading(false);
    }
  };

  const handleApplyAiSortToPipeline = () => {
    if (!aiSortResult || !aiSortResult.sortedLeads) return;
    const current = getStoredLeads();
    const rankMap = new Map(aiSortResult.sortedLeads.map((s) => [s.leadId, s.rank]));
    const reordered = [...current].sort((a, b) => {
      const rankA = rankMap.get(a.id) ?? 999;
      const rankB = rankMap.get(b.id) ?? 999;
      return rankA - rankB;
    });
    saveLeads(reordered);
    setNotificationBanner({
      message: "ChatGPT Brain triage applied! Pipeline re-ordered by AI commercial priority.",
      type: "success",
    });
    setIsAiSortingOpen(false);
  };

  const handleSaveEditedSuggestion = (factId: string) => {
    if (!editFactValue.trim()) return;
    handleApproveSuggestion(factId, editFactValue.trim());
    setEditingFactId(null);
    setEditFactValue("");
  };

  return (
    <div className="space-y-6">
      {/* Global Notification Banner */}
      {notificationBanner && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between transition-all ${
            notificationBanner.type === "success"
              ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-200"
              : notificationBanner.type === "warn"
              ? "bg-amber-950/40 border-amber-500/30 text-amber-200"
              : "bg-zinc-900 border-zinc-800 text-zinc-300"
          }`}
        >
          <div className="flex items-center gap-2.5 text-xs font-mono">
            <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{notificationBanner.message}</span>
          </div>
          <button
            onClick={() => setNotificationBanner(null)}
            className="text-zinc-500 hover:text-zinc-200 text-xs px-2 py-0.5 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Interstellar Telemetry Header */}
      <div className="p-5 rounded-xl bg-[#09090b] border border-[#27272a] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-[#121215] border border-emerald-500/30 flex items-center justify-center">
            <Cpu className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold text-white tracking-tight">Comp AI Autonomous Agent Loop</h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-500/30">
                {loopRunning ? "LOOP_EXECUTING" : loopPhase === "completed" ? "PASS_SETTLED" : "READY_TO_LEASE"}
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5 font-mono">
              "The agent is not a feature of the CRM; the CRM is where the agent keeps its notes."
            </p>
          </div>
        </div>

        {/* Counter Badges & ChatGPT Brain */}
        <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
          <div className="px-3 py-1.5 rounded-lg bg-[#121215] border border-emerald-500/40 flex items-center gap-2">
            <Bot className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-zinc-400">Brain:</span>
            <span className={`${isLiveChatGPT ? "text-emerald-400" : "text-amber-400"} font-semibold flex items-center gap-1.5`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isLiveChatGPT ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />
              {brainProvider}
            </span>
          </div>
          <button
            onClick={handleOpenAiSort}
            disabled={isAiSortingLoading}
            className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700 flex items-center gap-1.5 text-xs font-semibold cursor-pointer transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>{isAiSortingLoading ? "Sorting Leads..." : "Sort Leads with ChatGPT"}</span>
          </button>
          <div className="px-3 py-1.5 rounded-lg bg-[#121215] border border-[#27272a] flex items-center gap-2">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-zinc-400">Strong:</span>
            <span className="text-emerald-400 font-semibold">
              {facts.filter((f) => f.status === "auto_applied").length}
            </span>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-[#121215] border border-[#27272a] flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-zinc-400">Suggestions:</span>
            <span className="text-amber-400 font-semibold">
              {facts.filter((f) => f.status === "pending_approval").length}
            </span>
          </div>
        </div>
      </div>

      {/* FULL AUTONOMOUS RUN: APOLLO -> BRAIN -> WRITER -> SEND */}
      <AutonomousRunPanel defaultNiche={targetNiche} defaultLocation={targetCity} />

      {/* TARGET SPECIFICATION & AGENT LOOP LAUNCHER */}
      <div className="p-5 bg-[#09090b] border border-[#27272a] rounded-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#18181b] pb-3">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-emerald-400" />
            <h2 className="text-xs font-semibold text-white font-mono uppercase tracking-wider">
              Target Specification (Niche + City Loop)
            </h2>
          </div>
          <span className="text-[11px] font-mono text-zinc-500">
            Researches companies • Logs facts with source & confidence
          </span>
        </div>

        {/* Target Form */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          <div className="md:col-span-5 relative">
            <label className="text-[10px] font-mono uppercase text-zinc-500 block mb-1">Target Niche / Industry</label>
            <input
              type="text"
              value={targetNiche}
              onChange={(e) => setTargetNiche(e.target.value)}
              placeholder="e.g. Commercial Real Estate, HVAC, Fintech..."
              className="w-full bg-[#000000] border border-[#27272a] rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/60 font-mono"
            />
          </div>

          <div className="md:col-span-4 relative">
            <label className="text-[10px] font-mono uppercase text-zinc-500 block mb-1">Target City / Geography</label>
            <div className="relative">
              <MapPin className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-2.5" />
              <input
                type="text"
                value={targetCity}
                onChange={(e) => setTargetCity(e.target.value)}
                placeholder="e.g. Lagos, Austin, London..."
                className="w-full bg-[#000000] border border-[#27272a] rounded-lg pl-8.5 pr-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/60 font-mono"
              />
            </div>
          </div>

          <div className="md:col-span-3 flex items-end gap-2 pt-4 md:pt-0">
            <button
              onClick={() => runTargetAgentLoop()}
              disabled={loopRunning || !targetNiche.trim() || !targetCity.trim()}
              className="w-full px-4 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-black font-semibold rounded-lg text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
            >
              {loopRunning ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Loop Running...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Qualify Stored Leads</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Preset Quick Target Chips */}
        <div className="pt-2 border-t border-[#18181b] flex flex-wrap items-center gap-2 text-[11px] font-mono">
          <span className="text-zinc-600">Quick Target Presets:</span>
          {[
            { niche: "Commercial Real Estate Development", city: "Lagos, Nigeria" },
            { niche: "HVAC & Facility Management", city: "Austin, TX" },
            { niche: "B2B SaaS & Cloud Infrastructure", city: "San Francisco, CA" },
            { niche: "Commercial Litigation & Corporate Law", city: "London, UK" },
            { niche: "Fintech & Payment APIs", city: "Nairobi, Kenya" },
          ].map((p, idx) => (
            <button
              key={idx}
              onClick={() => {
                setTargetNiche(p.niche);
                setTargetCity(p.city);
                runTargetAgentLoop(p.niche, p.city);
              }}
              disabled={loopRunning}
              className="px-2.5 py-1 rounded-md bg-[#121215] hover:bg-[#1a1a20] text-zinc-300 hover:text-white border border-[#27272a] transition-colors cursor-pointer"
            >
              {p.niche.split("&")[0].trim()} • {p.city.split(",")[0]}
            </button>
          ))}
        </div>

        {/* Live Progress Bar */}
        {(loopRunning || loopProgress > 0) && (
          <div className="pt-2 space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-mono">
              <span className="text-zinc-300 flex items-center gap-1.5">
                <span className={`size-2 rounded-full ${loopRunning ? "bg-emerald-400 animate-pulse" : "bg-zinc-500"}`} />
                {currentStepText || "Agent loop standing by"}
              </span>
              <span className="text-emerald-400 font-semibold">{loopProgress}%</span>
            </div>
            <div className="w-full h-1.5 bg-[#18181b] rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all duration-500 ease-out rounded-full"
                style={{ width: `${loopProgress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* AGENT QUALIFICATION REPORT */}
      {(brainError || agentReport) && (
        <div className="p-5 bg-[#09090b] border border-[#27272a] rounded-xl space-y-4">
          {brainError && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-950/40 border border-amber-500/40">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-[11px] font-semibold text-amber-300 font-mono uppercase tracking-wider">
                  No live ChatGPT result
                </p>
                <p className="text-[11px] text-amber-200/80 leading-relaxed whitespace-pre-wrap">{brainError}</p>
              </div>
            </div>
          )}

          {agentReport && (
            <>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#18181b] pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <div className="space-y-0.5">
                    <h2 className="text-xs font-semibold text-white font-mono uppercase tracking-wider">
                      Qualification Report
                    </h2>
                    <p className="text-[11px] text-zinc-400">{agentReport.headline}</p>
                  </div>
                </div>
                <button
                  onClick={async () => {
                    await navigator.clipboard.writeText(reportAsText(agentReport));
                    setNotificationBanner({ message: "Report copied to your clipboard.", type: "success" });
                  }}
                  className="px-3 py-1.5 rounded-lg bg-[#18181b] hover:bg-[#27272a] text-zinc-300 border border-[#27272a] text-[11px] transition-colors cursor-pointer"
                >
                  Copy report
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 font-mono text-center">
                {[
                  { label: "Audited", value: agentReport.reviewedCount, tone: "text-zinc-200" },
                  { label: "Qualified", value: agentReport.qualifiedCount, tone: "text-emerald-400" },
                  { label: "Need review", value: agentReport.needsReviewCount, tone: "text-amber-400" },
                  { label: "Disqualified", value: agentReport.disqualifiedCount, tone: "text-red-400" },
                  { label: "Avg score", value: agentReport.averageScore, tone: "text-zinc-200" },
                ].map((stat) => (
                  <div key={stat.label} className="p-2.5 bg-[#050505] border border-[#18181b] rounded-lg">
                    <p className={`text-lg font-semibold ${stat.tone}`}>{stat.value}</p>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wide">{stat.label}</p>
                  </div>
                ))}
              </div>

              <p className="text-[12px] text-zinc-300 leading-relaxed">{agentReport.executiveSummary}</p>

              {agentReport.dataQualityFindings.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold text-zinc-400 font-mono uppercase tracking-wider">
                    Data quality findings
                  </p>
                  <ul className="space-y-1">
                    {agentReport.dataQualityFindings.map((finding, index) => (
                      <li key={index} className="flex items-start gap-2 text-[11px] text-zinc-400">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                        <span>{finding}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {agentReport.topTargets.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold text-zinc-400 font-mono uppercase tracking-wider">
                    Top targets
                  </p>
                  <ul className="space-y-1">
                    {agentReport.topTargets.map((target) => (
                      <li key={target.leadId} className="flex items-start gap-2 text-[11px]">
                        <Target className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        <span className="text-zinc-300">
                          <span className="font-semibold text-white">{target.company}</span> — {target.why}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {agentReport.nextActions.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold text-zinc-400 font-mono uppercase tracking-wider">
                    Next actions
                  </p>
                  <ol className="space-y-1 list-decimal list-inside">
                    {agentReport.nextActions.map((action, index) => (
                      <li key={index} className="text-[11px] text-zinc-400">
                        {action}
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              <p className="text-[10px] text-zinc-600 font-mono border-t border-[#18181b] pt-3">
                Assessment only. ChatGPT judged the fields stored on each record; no DNS lookup, registry check or
                LinkedIn verification was performed by this pass.
              </p>
            </>
          )}
        </div>
      )}

      {/* SUGGESTIONS AWAITING REP APPROVAL */}
      <div className="p-5 bg-[#09090b] border border-[#27272a] rounded-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#18181b] pb-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-amber-400 animate-pulse" />
              <h2 className="text-xs font-semibold text-white font-mono uppercase tracking-wider">
                Weak Facts Awaiting Your Approval ({facts.filter((f) => f.status === "pending_approval").length})
              </h2>
            </div>
            <p className="text-[11px] text-zinc-400">
              Comp AI Rule: Strong facts auto-update the lead. Weak or unverified claims become suggestions for you to approve or reject.
            </p>
          </div>

          <div className="flex items-center gap-2 font-mono text-xs">
            <button
              onClick={handleApproveAllSuggestions}
              disabled={facts.filter((f) => f.status === "pending_approval").length === 0}
              className="px-3 py-1.5 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-500/40 text-[11px] transition-colors disabled:opacity-40 cursor-pointer flex items-center gap-1.5"
            >
              <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Approve All High Probable</span>
            </button>
          </div>
        </div>

        {/* Suggestion Cards Grid */}
        {facts.filter((f) => f.status === "pending_approval").length === 0 ? (
          <div className="p-8 text-center bg-[#050505] border border-dashed border-[#27272a] rounded-xl space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto opacity-70" />
            <p className="text-xs text-white font-medium">All suggestions settled!</p>
            <p className="text-[11px] text-zinc-500 font-mono">
              Run the agent loop above to audit the leads already in your CRM. New companies come from Apollo on the Prospecting page.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {facts
              .filter((f) => f.status === "pending_approval")
              .map((suggestion) => (
                <div
                  key={suggestion.id}
                  className="p-4 bg-[#050505] border border-[#27272a] hover:border-zinc-700 rounded-xl space-y-3 transition-colors flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-xs font-semibold text-white">{suggestion.companyName}</h3>
                        <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wide">
                          Field: <span className="text-zinc-300 font-medium">{suggestion.fieldLabel}</span>
                        </span>
                      </div>
                      <div className="text-right font-mono">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded border ${
                            suggestion.confidence >= 0.60
                              ? "bg-amber-950/60 text-amber-300 border-amber-500/30"
                              : "bg-zinc-900 text-zinc-400 border-zinc-800"
                          }`}
                        >
                          {Math.round(suggestion.confidence * 100)}% Conf ({suggestion.confidence >= 0.60 ? "Probable" : "Weak"})
                        </span>
                      </div>
                    </div>

                    {editingFactId === suggestion.id ? (
                      <div className="pt-1 space-y-2">
                        <input
                          type="text"
                          value={editFactValue}
                          onChange={(e) => setEditFactValue(e.target.value)}
                          className="w-full bg-[#121215] border border-zinc-700 rounded px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleSaveEditedSuggestion(suggestion.id)}
                            className="px-2.5 py-1 rounded bg-emerald-500 text-black text-[11px] font-semibold"
                          >
                            Save & Approve
                          </button>
                          <button
                            onClick={() => setEditingFactId(null)}
                            className="px-2.5 py-1 rounded bg-zinc-800 text-zinc-300 text-[11px]"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="p-2.5 rounded-lg bg-[#0e0e12] border border-[#1e1e24] font-mono text-xs text-zinc-200">
                        <span className="text-zinc-500 text-[10px] block">Suggested Claim:</span>
                        <span className="text-white font-medium break-all">{suggestion.value}</span>
                      </div>
                    )}

                    <div className="space-y-1 text-[11px] font-mono text-zinc-500">
                      <div className="flex items-center gap-1.5 text-zinc-400">
                        <span className="text-emerald-400">source:</span>
                        <span>{suggestion.source}</span>
                      </div>
                      <p className="text-zinc-500 text-[10px] leading-relaxed">{suggestion.rationale}</p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[#18181b] flex items-center justify-between gap-2">
                    <button
                      onClick={() => {
                        setEditingFactId(suggestion.id);
                        setEditFactValue(suggestion.value);
                      }}
                      className="text-[11px] font-mono text-zinc-500 hover:text-zinc-300 flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>Edit</span>
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleRejectSuggestion(suggestion.id)}
                        className="px-2.5 py-1 rounded-md bg-[#121215] hover:bg-zinc-900 text-zinc-400 hover:text-red-400 border border-[#27272a] text-[11px] font-mono transition-colors cursor-pointer"
                        title="Reject and discard suggestion"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => handleApproveSuggestion(suggestion.id)}
                        className="px-3 py-1 rounded-md bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-[11px] font-mono transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                        title="Approve suggestion and update lead record"
                      >
                        <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>Approve & Update Lead</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* FACT LEDGER AUDIT TABS */}
      <div className="p-5 bg-[#09090b] border border-[#27272a] rounded-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#18181b] pb-3">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-emerald-400" />
            <h2 className="text-xs font-semibold text-white font-mono uppercase tracking-wider">
              Fact Ledger & Dispatcher Audit ({facts.length} facts logged)
            </h2>
          </div>

          <div className="flex items-center gap-1 text-[11px] font-mono bg-[#000000] p-1 rounded-lg border border-[#27272a]">
            {[
              { id: "suggestions", label: `Pending Suggestions (${facts.filter((f) => f.status === "pending_approval").length})` },
              { id: "strong", label: `Strong Auto-Applied (${facts.filter((f) => f.status === "auto_applied").length})` },
              { id: "all", label: `All Facts (${facts.length})` },
              { id: "terminal", label: "Raw Dispatcher Stream" },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setFactLedgerTab(t.id as any)}
                className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                  factLedgerTab === t.id ? "bg-zinc-800 text-white font-semibold" : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {factLedgerTab === "strong" && (
          <div className="divide-y divide-[#18181b] max-h-[380px] overflow-y-auto">
            {facts
              .filter((f) => f.status === "auto_applied")
              .map((f) => (
                <div key={f.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 font-mono text-xs">
                      <span className="text-emerald-400 font-semibold">[AUTO-APPLIED]</span>
                      <span className="text-white font-medium">{f.companyName}</span>
                      <span className="text-zinc-500">•</span>
                      <span className="text-zinc-400">{f.fieldLabel}:</span>
                      <span className="text-zinc-100 font-semibold">{f.value}</span>
                    </div>
                    <p className="text-[11px] text-zinc-500 font-mono">
                      Source: <span className="text-zinc-300">{f.source}</span> • {f.rationale}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 font-mono text-[10px] shrink-0">
                    <span className="px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-500/30 font-semibold">
                      {Math.round(f.confidence * 100)}% Conf (Strong)
                    </span>
                    <span className="text-zinc-600">{f.timestamp}</span>
                  </div>
                </div>
              ))}
          </div>
        )}

        {factLedgerTab === "suggestions" && (
          <div className="divide-y divide-[#18181b] max-h-[380px] overflow-y-auto">
            {facts
              .filter((f) => f.status === "pending_approval")
              .map((f) => (
                <div key={f.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 font-mono text-xs">
                      <span className="text-amber-400 font-semibold">[SUGGESTION QUEUED]</span>
                      <span className="text-white font-medium">{f.companyName}</span>
                      <span className="text-zinc-500">•</span>
                      <span className="text-zinc-400">{f.fieldLabel}:</span>
                      <span className="text-zinc-100">{f.value}</span>
                    </div>
                    <p className="text-[11px] text-zinc-500 font-mono">
                      Source: <span className="text-zinc-300">{f.source}</span> • {f.rationale}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 font-mono text-[11px] shrink-0">
                    <button
                      onClick={() => handleApproveSuggestion(f.id)}
                      className="px-2.5 py-1 rounded bg-emerald-500 text-black font-semibold text-[10px] cursor-pointer"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleRejectSuggestion(f.id)}
                      className="px-2.5 py-1 rounded bg-zinc-800 text-zinc-400 hover:text-white text-[10px] cursor-pointer"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
          </div>
        )}

        {factLedgerTab === "all" && (
          <div className="divide-y divide-[#18181b] max-h-[380px] overflow-y-auto">
            {facts.map((f) => (
              <div key={f.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded ${
                        f.status === "auto_applied"
                          ? "bg-emerald-950/60 text-emerald-400 border border-emerald-500/30"
                          : f.status === "approved"
                          ? "bg-sky-950/60 text-sky-400 border border-sky-500/30"
                          : f.status === "rejected"
                          ? "bg-red-950/60 text-red-400 border border-red-500/30"
                          : "bg-amber-950/60 text-amber-400 border border-amber-500/30"
                      }`}
                    >
                      {f.status.toUpperCase()}
                    </span>
                    <span className="text-white font-medium">{f.companyName}</span>
                    <span className="text-zinc-500">•</span>
                    <span className="text-zinc-400">{f.fieldLabel}:</span>
                    <span className="text-zinc-200">{f.value}</span>
                  </div>
                  <p className="text-[11px] text-zinc-500">
                    Source: {f.source} • {f.rationale}
                  </p>
                </div>
                <span className="text-zinc-500 text-[11px] shrink-0">{Math.round(f.confidence * 100)}% Conf</span>
              </div>
            ))}
          </div>
        )}

        {factLedgerTab === "terminal" && (
          <div className="p-4 bg-[#000000] font-mono text-[11px] space-y-2 max-h-[360px] overflow-y-auto rounded-lg border border-[#1e1e24]">
            {agentLogs.map((log, i) => (
              <div key={i} className="flex items-start gap-2 leading-relaxed">
                <span className="text-emerald-500 select-none">›</span>
                <span
                  className={
                    log.includes("AUTO-APPLY")
                      ? "text-emerald-400 font-semibold"
                      : log.includes("SUGGESTION")
                      ? "text-amber-300"
                      : log.includes("SCOUT")
                      ? "text-sky-300"
                      : log.includes("LEDGER")
                      ? "text-purple-300"
                      : "text-zinc-300"
                  }
                >
                  {log}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MONITORED LEASE QUEUE (ACCOUNTS TABLE) */}
      <div className="bg-[#09090b] border border-[#27272a] rounded-xl overflow-hidden flex flex-col">
        <div className="p-4 border-b border-[#18181b] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-emerald-400" />
            <h2 className="text-xs font-semibold text-white font-mono uppercase tracking-wider">
              Autonomous Lease Queue ({accounts.length} Companies Monitored)
            </h2>
          </div>
          <span className="text-[10px] font-mono text-zinc-500">Click any company to open Evidence Ledger</span>
        </div>

        <div className="divide-y divide-[#14141a] overflow-y-auto max-h-[400px]">
          {accounts.length === 0 && (
            <div className="p-8 text-center">
              <p className="text-xs text-zinc-400">
                Nothing in the CRM yet. This queue is built from stored leads, so source accounts in
                Lead Prospecting first — the agent only judges records that already exist.
              </p>
            </div>
          )}
          {accounts.map((acc) => {
            const accFacts = facts.filter((f) => f.accountId === acc.id || f.companyName === acc.name);
            const strongCount = accFacts.filter((f) => f.status === "auto_applied").length;
            const pendingCount = accFacts.filter((f) => f.status === "pending_approval").length;

            return (
              <div
                key={acc.id}
                onClick={() => {
                  setSelectedAccount(acc);
                  setIsDetailOpen(true);
                }}
                className={`p-4 cursor-pointer transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  selectedAccount?.id === acc.id ? "bg-[#12121a] border-l-2 border-emerald-400" : "hover:bg-[#0c0c10]"
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-semibold text-white">{acc.name}</h3>
                    <span className="text-[10px] font-mono text-zinc-500">({acc.domain})</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#141418] border border-[#27272a] text-zinc-400">
                      {acc.location}
                    </span>
                  </div>

                  <p className="text-[11px] text-zinc-400 font-mono">
                    On record:{" "}
                    <span className="text-zinc-200 font-medium">
                      {acc.facts.decisionMaker} ({acc.facts.title})
                    </span>
                    {" • "}
                    Email: <span className="text-zinc-200">{acc.facts.email}</span>
                  </p>

                  <p className="text-[10px] text-zinc-500 font-mono line-clamp-1">{acc.lastAction}</p>
                </div>

                <div className="flex items-center gap-3 font-mono text-xs shrink-0">
                  {strongCount > 0 && (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-500/30">
                      {strongCount} Auto-Applied
                    </span>
                  )}
                  {pendingCount > 0 && (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-amber-950/60 text-amber-400 border border-amber-500/30 animate-pulse">
                      {pendingCount} Pending Suggestions
                    </span>
                  )}
                  {acc.agentStatus === "not-audited" && (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-[#141418] text-zinc-500 border border-[#27272a]">
                      Not audited
                    </span>
                  )}
                  <span className="text-emerald-400 font-semibold">{acc.dealValue}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-zinc-500" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Slide-over Detail Sheet (Comp AI format) */}
      {isDetailOpen && selectedAccount && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div onClick={() => setIsDetailOpen(false)} className="fixed inset-0 bg-black/70 backdrop-blur-xs transition-opacity" />
          <div className="relative w-full max-w-xl bg-[#09090b] border-l border-[#27272a] h-full shadow-2xl flex flex-col z-10 overflow-hidden">
            {/* Drawer Header */}
            <div className="p-5 border-b border-[#18181b] flex items-center justify-between bg-[#050505]">
              <div>
                <h2 className="text-sm font-semibold text-white">{selectedAccount.name}</h2>
                <p className="text-xs text-zinc-500 font-mono mt-0.5">
                  {selectedAccount.domain} • {selectedAccount.location}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-semibold text-emerald-400 px-2.5 py-1 rounded bg-[#121215] border border-[#27272a]">
                  {selectedAccount.dealValue}
                </span>
                <button
                  onClick={() => setIsDetailOpen(false)}
                  className="p-1 rounded-md text-zinc-500 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Drawer Tabs */}
            <div className="flex items-center border-b border-[#1b1b22] px-5 gap-6 text-xs bg-[#09090c] font-medium font-mono">
              {[
                { id: "overview", label: "Overview" },
                { id: "evidence", label: "Evidence Ledger" },
                { id: "agent", label: "Autonomous Worker" },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setDetailTab(t.id as any)}
                  className={`py-3 transition-colors cursor-pointer ${
                    detailTab === t.id
                      ? "text-white border-b-2 border-emerald-400 font-semibold"
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Tab Contents */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs font-mono">
              {detailTab === "overview" && (
                <div className="space-y-4 font-sans">
                  <div className="p-3.5 bg-[#0d0d10] border border-[#27272a] rounded-xl space-y-1">
                    <span className="text-[10px] uppercase font-mono text-zinc-500">Summary Brief</span>
                    <p className="text-zinc-300 leading-relaxed text-xs">{selectedAccount.facts.summary}</p>
                  </div>

                  <div className="p-3.5 bg-[#0d0d10] border border-[#27272a] rounded-xl space-y-2">
                    <span className="text-[10px] uppercase font-mono text-zinc-500">Decision Maker</span>
                    <p className="text-sm font-semibold text-white">{selectedAccount.facts.decisionMaker}</p>
                    <p className="text-zinc-400 text-xs">{selectedAccount.facts.title}</p>
                    <div className="pt-2 border-t border-[#18181b] font-mono text-[11px] text-zinc-300 space-y-1">
                      <p>Email: {selectedAccount.facts.email}</p>
                      <p>Phone: {selectedAccount.facts.phone}</p>
                    </div>
                  </div>

                  <div className="p-3.5 bg-[#0d0d10] border border-[#27272a] rounded-xl space-y-2">
                    <span className="text-[10px] uppercase font-mono text-zinc-500">Observed Tech Stack</span>
                    <div className="flex flex-wrap gap-1.5 font-mono">
                      {selectedAccount.facts.techStack.map((tech, i) => (
                        <span key={i} className="px-2 py-0.5 rounded bg-[#121218] text-zinc-300 border border-[#252530] text-[11px]">
                          {tech}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {detailTab === "evidence" && (
                <div className="space-y-3">
                  <div className="p-3 bg-[#0d0d10] border border-[#27272a] rounded-xl font-mono text-[11px] space-y-1">
                    <span className="text-emerald-400 font-semibold block">Comp AI Evidence Ledger</span>
                    <p className="text-zinc-400 text-[10px]">
                      Strong facts (≥80%) auto-update the record; weak claims (&lt;80%) await rep approval.
                    </p>
                  </div>

                  <div className="space-y-2.5">
                    {facts
                      .filter((f) => f.accountId === selectedAccount.id || f.companyName === selectedAccount.name)
                      .map((f) => (
                        <div key={f.id} className="p-3.5 bg-[#000000] border border-[#1e1e24] rounded-xl space-y-2">
                          <div className="flex items-center justify-between font-mono text-[10px]">
                            <span
                              className={`px-2 py-0.5 rounded font-semibold ${
                                f.status === "auto_applied"
                                  ? "bg-emerald-950/60 text-emerald-400 border border-emerald-500/30"
                                  : f.status === "approved"
                                  ? "bg-sky-950/60 text-sky-400 border border-sky-500/30"
                                  : f.status === "rejected"
                                  ? "bg-red-950/60 text-red-400 border border-red-500/30"
                                  : "bg-amber-950/60 text-amber-400 border border-amber-500/30 animate-pulse"
                              }`}
                            >
                              {f.status === "auto_applied"
                                ? "AUTO-APPLIED"
                                : f.status === "approved"
                                ? "APPROVED"
                                : f.status === "rejected"
                                ? "REJECTED"
                                : "SUGGESTION AWAITING APPROVAL"}
                            </span>
                            <span className="text-zinc-400">{Math.round(f.confidence * 100)}% Conf</span>
                          </div>

                          <p className="text-xs font-semibold text-white">{f.value}</p>

                          <div className="pt-2 border-t border-[#181820] flex items-center justify-between text-[10px] font-mono text-zinc-500">
                            <div>
                              <span className="text-emerald-400">source:</span> {f.source}
                            </div>
                            <span>{f.timestamp}</span>
                          </div>

                          <p className="text-[10px] text-zinc-500 leading-relaxed font-mono">{f.rationale}</p>

                          {f.status === "pending_approval" && (
                            <div className="pt-2 border-t border-[#181820] flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleRejectSuggestion(f.id)}
                                className="px-2.5 py-1 rounded bg-[#141418] text-zinc-400 hover:text-white text-[11px] font-mono border border-zinc-800 cursor-pointer"
                              >
                                Reject
                              </button>
                              <button
                                onClick={() => handleApproveSuggestion(f.id)}
                                className="px-3 py-1 rounded bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-[11px] font-mono flex items-center gap-1 cursor-pointer"
                              >
                                <Check className="w-3 h-3 stroke-[3]" />
                                <span>Approve & Write to Record</span>
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {detailTab === "agent" && (
                <div className="space-y-4">
                  <div className="p-3.5 bg-[#0d0d10] border border-[#27272a] rounded-xl space-y-1.5 font-mono">
                    <span className="text-[10px] uppercase text-zinc-500">Autonomous Schedule</span>
                    <p className="text-white font-semibold">Next recheck: {selectedAccount.nextRecheck}</p>
                    <p className="text-[11px] text-zinc-400">
                      Reason: {selectedAccount.recheckReason || "Periodic follow-up inspection"}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    
      {/* CHATGPT LEAD SORTING DRAWER */}
      {isAiSortingOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-3xl max-h-[90vh] bg-[#09090b] border border-[#27272a] rounded-2xl flex flex-col overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-[#27272a] flex items-center justify-between bg-[#0d0d10]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white">ChatGPT Lead Sorting & Qualification</h3>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-950/60 text-emerald-400 border border-emerald-500/30">
                      {aiSortResult?.provider || "No live ChatGPT result"}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 font-mono mt-0.5">
                    Autonomous qualification, commercial triage & buying signal ranking
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAiSortingOpen(false)}
                className="p-1 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 flex-1 overflow-y-auto space-y-5 text-xs font-mono">
              {isAiSortingLoading ? (
                <div className="py-16 text-center space-y-3">
                  <RefreshCw className="w-6 h-6 text-emerald-400 animate-spin mx-auto" />
                  <p className="text-sm text-white font-sans font-semibold">
                    ChatGPT Brain is reviewing and ranking your leads...
                  </p>
                  <p className="text-xs text-zinc-500">
                    Evaluating ICP fit, deal velocity, and decision maker certainty.
                  </p>
                </div>
              ) : aiSortResult ? (
                <>
                  {/* Executive Summary */}
                  <div className="p-4 rounded-xl bg-[#121215] border border-emerald-500/30 space-y-2">
                    <div className="flex items-center gap-2 text-emerald-400 font-bold uppercase text-[10px] tracking-wider">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>AI Portfolio Executive Summary</span>
                    </div>
                    <p className="text-zinc-200 text-xs leading-relaxed font-sans">
                      {aiSortResult.executiveSummary}
                    </p>
                    <div className="pt-2 border-t border-zinc-800 flex flex-wrap items-center gap-4 text-[11px] text-zinc-400">
                      <span>Avg Score: <strong className="text-white">{aiSortResult.averageScore}/100</strong></span>
                      <span>Tier A Targets: <strong className="text-emerald-400">{aiSortResult.tierACount}</strong></span>
                      <span>Total Value: <strong className="text-emerald-400">{aiSortResult.totalDealValueEstimate}</strong></span>
                    </div>
                  </div>

                  {/* Ranked Leads List */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] uppercase tracking-wider text-zinc-400 font-semibold">
                        Ranked Pipeline Accounts ({aiSortResult.sortedLeads.length})
                      </span>
                      <button
                        onClick={handleApplyAiSortToPipeline}
                        className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-xs flex items-center gap-1.5 cursor-pointer font-sans"
                      >
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                        <span>Apply AI Ranking to Pipeline</span>
                      </button>
                    </div>

                    <div className="space-y-2.5">
                      {aiSortResult.sortedLeads.map((item) => (
                        <div
                          key={item.leadId}
                          className="p-3.5 rounded-xl bg-[#0d0d10] border border-[#27272a] hover:border-zinc-700 transition-colors space-y-2 font-sans"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <span className="w-6 h-6 rounded-md bg-[#181820] text-emerald-400 text-xs font-mono font-bold flex items-center justify-center border border-zinc-800">
                                #{item.rank}
                              </span>
                              <span className="text-sm font-semibold text-white">
                                {item.company}
                              </span>
                            </div>
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-mono font-semibold ${
                                item.tier.startsWith("Tier A")
                                  ? "bg-emerald-950/70 text-emerald-400 border border-emerald-500/30"
                                  : item.tier.startsWith("Tier B")
                                  ? "bg-sky-950/70 text-sky-400 border border-sky-500/30"
                                  : "bg-zinc-800 text-zinc-400 border border-zinc-700"
                              }`}
                            >
                              {item.tier}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                            <div className="p-2.5 rounded-lg bg-black/50 border border-zinc-800 space-y-1">
                              <span className="text-[10px] font-mono uppercase text-zinc-500">Primary Urgent Pain Point</span>
                              <p className="text-zinc-300 text-[11px] leading-relaxed italic">
                                "{item.primaryPainPoint}"
                              </p>
                            </div>
                            <div className="p-2.5 rounded-lg bg-black/50 border border-zinc-800 space-y-1">
                              <span className="text-[10px] font-mono uppercase text-zinc-500">Recommended Sales Action</span>
                              <p className="text-emerald-300 text-[11px] leading-relaxed font-mono">
                                {item.recommendedAction}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-2 border-t border-zinc-800/80 text-[11px] font-mono text-zinc-400">
                            <div>
                              <span>Qualification: <strong className="text-white">{item.qualificationScore}/100</strong></span>
                              <span className="ml-3">Deal Prob: <strong className="text-emerald-400">{Math.round(item.dealProbability * 100)}%</strong></span>
                            </div>
                            <button
                              onClick={() => {
                                const matched = getStoredLeads().find((l) => l.id === item.leadId) || { company: item.company, id: item.leadId };
                                handleOpenAiEmail(matched);
                              }}
                              className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-white text-xs flex items-center gap-1 cursor-pointer font-sans"
                            >
                              <Send className="w-3 h-3 text-emerald-400" />
                              <span>Draft Cold Email</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* CHATGPT COLD EMAIL COMPOSER MODAL */}
      {isAiEmailOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-2xl max-h-[90vh] bg-[#09090b] border border-[#27272a] rounded-2xl flex flex-col overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-[#27272a] flex items-center justify-between bg-[#0d0d10]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                  <Send className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    ChatGPT Cold Email Generator
                  </h3>
                  <p className="text-xs text-zinc-400 font-mono mt-0.5">
                    Target: {emailTargetLead?.name || emailTargetLead?.company} • Writes only from the facts on this record
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAiEmailOpen(false)}
                className="p-1 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 flex-1 overflow-y-auto space-y-4 font-sans text-xs">
              {/* Tone Selector */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono uppercase text-zinc-400 font-semibold">
                  Tone
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: "direct", label: "Direct" },
                    { id: "consultative", label: "Consultative" },
                    { id: "peer_to_peer", label: "Executive Peer-to-Peer" },
                    { id: "short_question", label: "Short Question" },
                  ].map((a) => (
                    <button
                      key={a.id}
                      onClick={() => {
                        setEmailAngle(a.id);
                        if (emailTargetLead) handleOpenAiEmail(emailTargetLead);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-colors cursor-pointer ${
                        emailAngle === a.id
                          ? "bg-emerald-500 text-black font-semibold"
                          : "bg-[#141418] text-zinc-400 hover:text-white border border-zinc-800"
                      }`}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              </div>

              {isAiEmailLoading ? (
                <div className="py-12 text-center space-y-2 font-mono">
                  <RefreshCw className="w-5 h-5 text-emerald-400 animate-spin mx-auto" />
                  <p className="text-white text-xs">Drafting personalized sequence with ChatGPT Brain...</p>
                </div>
              ) : composedEmail ? (
                <>
                  <ComposeAudit email={composedEmail} />
                  {composedEmail.success && (
                    <>
                  {/* Subject Line with swap options */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-mono uppercase text-zinc-400 font-semibold">
                      Subject Line
                    </label>
                    <div className="p-3 bg-black border border-zinc-800 rounded-xl text-white font-medium text-xs">
                      {composedEmail.subject}
                    </div>
                    {composedEmail.altSubjects && composedEmail.altSubjects.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1 text-[11px] font-mono">
                        <span className="text-zinc-500">A/B Alternatives:</span>
                        {composedEmail.altSubjects.map((alt, idx) => (
                          <button
                            key={idx}
                            onClick={() => setComposedEmail({ ...composedEmail, subject: alt })}
                            className="px-2 py-0.5 rounded bg-zinc-900 text-zinc-300 hover:text-emerald-400 border border-zinc-800 cursor-pointer"
                          >
                            "{alt}"
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Body */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-mono uppercase text-zinc-400 font-semibold">
                        Grounded Body
                      </label>
                      {composedEmail.estimatedReadTimeSec > 0 && (
                        <span className="text-[10px] font-mono text-emerald-400">
                          ~{composedEmail.estimatedReadTimeSec}s read
                        </span>
                      )}
                    </div>
                    <textarea
                      rows={8}
                      value={composedEmail.body}
                      onChange={(e) => setComposedEmail({ ...composedEmail, body: e.target.value })}
                      className="w-full bg-black border border-zinc-800 rounded-xl p-3.5 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500 font-sans leading-relaxed"
                    />
                  </div>

                  {/* Follow-up Sequence */}
                  {composedEmail.followUpBody && (
                    <div className="space-y-1.5 p-3 rounded-xl bg-[#121215] border border-zinc-800/80">
                      <div className="flex items-center justify-between font-mono text-[10px] text-zinc-400">
                        <span>Sequence Step 2 (3 Days Later)</span>
                        <span className="text-zinc-500">{composedEmail.followUpSubject}</span>
                      </div>
                      <p className="text-zinc-300 text-[11px] leading-relaxed whitespace-pre-line">
                        {stripCitations(composedEmail.followUpBody)}
                      </p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="pt-2 flex items-center justify-between gap-2">
                    <button
                      onClick={() => {
                        const full = `Subject: ${composedEmail.subject}\n\n${stripCitations(composedEmail.body)}\n\n---\nFollow-Up (3 Days Later):\n${stripCitations(composedEmail.followUpBody)}`;
                        navigator.clipboard.writeText(full);
                        setCopiedEmail(true);
                        setTimeout(() => setCopiedEmail(false), 2000);
                      }}
                      className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      {copiedEmail ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : <CheckCheck className="w-3.5 h-3.5" />}
                      <span>{copiedEmail ? "Copied to Clipboard!" : "Copy Full Sequence"}</span>
                    </button>
                    <button
                      onClick={() => setIsAiEmailOpen(false)}
                      className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold cursor-pointer"
                    >
                      Done
                    </button>
                  </div>
                    </>
                  )}
                </>
              ) : (
                <p className="py-8 text-center text-zinc-500 font-mono text-xs">
                  No draft yet. The writer only produces copy when ChatGPT is connected and at least one
                  verified fact exists on the record.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}