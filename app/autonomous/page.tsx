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
  ExternalLink,
  X,
  Database,
  Search,
} from "lucide-react";

interface EvidenceItem {
  id: string;
  source: string;
  fact: string;
  confidence: "verified" | "observed" | "weak";
  timestamp: string;
}

interface AutonomousAccount {
  id: string;
  name: string;
  domain: string;
  niche: string;
  location: string;
  dealValue: string;
  agentStatus: "active" | "enriched" | "recheck-scheduled" | "needs-review";
  lastAction: string;
  facts: {
    decisionMaker: string;
    title: string;
    email: string;
    phone: string;
    employees: string;
    techStack: string[];
    summary: string;
    funding?: string;
  };
  evidenceLedger: EvidenceItem[];
  agentNotes: string[];
  nextRecheck: string;
  recheckReason?: string;
}

const INITIAL_ACCOUNTS: AutonomousAccount[] = [
  {
    id: "comp-1",
    name: "Apex Prime Realty & Landholdings",
    domain: "apexprimerealty.ng",
    niche: "Commercial Real Estate Development",
    location: "Ikoyi, Lagos",
    dealValue: "₦18.5M",
    agentStatus: "enriched",
    lastAction: "Extracted signature block and verified corporate MX",
    facts: {
      decisionMaker: "Olumide Adeyemi",
      title: "Managing Director",
      email: "o.adeyemi@apexprimerealty.ng",
      phone: "+234 803 491 8293",
      employees: "45-60 staff",
      techStack: ["Next.js", "Microsoft 365", "Google Workspace", "HubSpot"],
      summary: "Major real estate syndication holding firm developing multi-acre mixed-use luxury developments in Eko Atlantic and Victoria Island.",
      funding: "₦4.2B Series-A Land Capitalization",
    },
    evidenceLedger: [
      {
        id: "ev-1",
        source: "dns.mx-record",
        fact: "Corporate mail exchange routed through Google Workspace (ASPMX.L.GOOGLE.COM)",
        confidence: "verified",
        timestamp: "12m ago",
      },
      {
        id: "ev-2",
        source: "crm.signature-block",
        fact: "Direct phone line confirmed as +234 803 491 8293 with Managing Director title",
        confidence: "verified",
        timestamp: "8m ago",
      },
      {
        id: "ev-3",
        source: "web.crawler",
        fact: "Announced ₦4.2B land capitalization in Ikoyi corridor via BusinessDay",
        confidence: "observed",
        timestamp: "3m ago",
      },
    ],
    agentNotes: [
      "Agent identified high outbound syndication appetite.",
      "Evidence ledger confirms zero bounce risk on primary email.",
      "Auto-scheduled follow-up recheck in 7 days to monitor press announcements.",
    ],
    nextRecheck: "In 7 days",
    recheckReason: "Press announcement and executive hiring monitor",
  },
  {
    id: "comp-2",
    name: "Vanguard & Balogun Commercial Chambers",
    domain: "vanguardlegal.ng",
    niche: "Corporate Commercial Law",
    location: "Victoria Island, Lagos",
    dealValue: "₦12.0M",
    agentStatus: "active",
    lastAction: "Agent currently evaluating arbitration partner listings",
    facts: {
      decisionMaker: "Folake Balogun, SAN",
      title: "Senior Managing Partner",
      email: "folake.b@vanguardlegal.ng",
      phone: "+234 814 209 1144",
      employees: "25-35 attorneys",
      techStack: ["Clio Legal", "Microsoft Exchange", "Cloudflare"],
      summary: "Specialized arbitration and cross-border commercial litigation retainers for West African financial institutions.",
      funding: "Partner-Capitalized Boutique",
    },
    evidenceLedger: [
      {
        id: "ev-5",
        source: "law-society.registry",
        fact: "Senior Advocate of Nigeria (SAN) credentials verified on official bar gazette",
        confidence: "verified",
        timestamp: "24m ago",
      },
      {
        id: "ev-6",
        source: "company.reports",
        fact: "Lead legal counsel on Flutterwave $35M cross-border licensing escrow",
        confidence: "verified",
        timestamp: "18m ago",
      },
    ],
    agentNotes: [
      "Verified corporate retainer potential for automated compliance contract review.",
      "Agent detected high urgency for document parsing pipelines.",
    ],
    nextRecheck: "In 3 days",
    recheckReason: "Check if RFP submission window opened",
  },
  {
    id: "comp-3",
    name: "PayFlex Africa Technologies",
    domain: "payflex.africa",
    niche: "B2B Fintech & Payroll API",
    location: "Yaba / Lekki Phase 1, Lagos",
    dealValue: "₦28.0M",
    agentStatus: "needs-review",
    lastAction: "Weak evidence logged: Pending human review of CTO personal email",
    facts: {
      decisionMaker: "Chinedu Eze",
      title: "Chief Technology Officer",
      email: "chinedu@payflex.africa",
      phone: "+234 802 994 5100",
      employees: "80-120 engineers",
      techStack: ["Golang", "PostgreSQL", "AWS ECS", "Stripe", "Redis"],
      summary: "Embedded corporate salary streaming and treasury disbursement infrastructure connecting 400+ African enterprises.",
      funding: "$6.5M Seed (Tiger Global / Ventures Platform)",
    },
    evidenceLedger: [
      {
        id: "ev-8",
        source: "github.repository-inspect",
        fact: "Public SDK repositories show active Golang and Node client library commits",
        confidence: "verified",
        timestamp: "1h ago",
      },
      {
        id: "ev-9",
        source: "web.search-snippet",
        fact: "CTO personal contact discovered on open developer forum",
        confidence: "weak",
        timestamp: "4m ago",
      },
    ],
    agentNotes: [
      "Strict evidence rule: Personal Gmail held back from auto-outreach until confirmed.",
      "Agent drafted tailored enterprise outbound highlighting API reliability.",
    ],
    nextRecheck: "Awaiting human review",
    recheckReason: "Human settling of weak evidence required",
  },
  {
    id: "comp-4",
    name: "Helios Logistics & Cold Chain Network",
    domain: "helioslogistics.ng",
    niche: "Cold Chain Supply Infrastructure",
    location: "Ikeja Industrial Estate, Lagos",
    dealValue: "₦22.5M",
    agentStatus: "enriched",
    lastAction: "Contract signed. Deal closed won. Automated onboarding agent dispatched.",
    facts: {
      decisionMaker: "Alhaji Bashir Dangote-Bello",
      title: "Chief Operating Officer",
      email: "b.dangote@helioslogistics.ng",
      phone: "+234 805 771 9022",
      employees: "210 staff",
      techStack: ["SAP S/4HANA", "Geotab Telematics", "Azure Cloud"],
      summary: "Interstate refrigerated fleet transporting pharmaceuticals and agro-exports across 14 Nigerian state corridors.",
      funding: "$12M Private Equity Consortium",
    },
    evidenceLedger: [
      {
        id: "ev-10",
        source: "corp.filings",
        fact: "CAC registry registration validated with ₦500M paid-up capital",
        confidence: "verified",
        timestamp: "2d ago",
      },
    ],
    agentNotes: [
      "Deal won and archived. Automated recheck set to 90 days for quarterly renewal.",
    ],
    nextRecheck: "In 84 days",
    recheckReason: "Quarterly account review and upsell survey",
  },
];

export default function AutonomousPage() {
  const [accounts, setAccounts] = useState<AutonomousAccount[]>(INITIAL_ACCOUNTS);
  const [selectedAccount, setSelectedAccount] = useState<AutonomousAccount | null>(INITIAL_ACCOUNTS[0]);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [agentRunning, setAgentRunning] = useState(true);
  const [researchBudgetSpent, setResearchBudgetSpent] = useState(0.84);
  const [composerPrompt, setComposerPrompt] = useState("");
  const [isDispatching, setIsDispatching] = useState(false);
  const [directiveInput, setDirectiveInput] = useState("");
  const [agentLogs, setAgentLogs] = useState<string[]>([
    "[DISPATCH] Work queue leased 4 accounts with FOR UPDATE SKIP LOCKED",
    "[SCOUT] Domain apexprimerealty.ng passed DNS MX & SPF handshake",
    "[EVIDENCE] Logged observed fact: signature-block confirmed title 'Managing Director'",
    "[SCHEDULER] schedule_recheck executed: reason='Press monitor' in 7d",
    "[ENRICHER] Finished tech stack inspection: Next.js + Microsoft 365",
    "[EVIDENCE_LEDGER] Strong evidence written to record: 100% deliverable corporate email",
  ]);

  useEffect(() => {
    if (!agentRunning) return;
    const interval = setInterval(() => {
      const acc = accounts[Math.floor(Math.random() * accounts.length)];
      const sample = [
        `[SCOUT] Crawling domain ${acc.domain}... DNS verified with zero bounce risk`,
        `[EVIDENCE] Observed signature block for ${acc.facts.decisionMaker} (${acc.name})`,
        `[LEDGER] Recorded zero-hallucination fact: Corporate MX routing confirmed`,
        `[SCHEDULER] Leased work queue task: schedule_recheck(dueAt="in 7d", reason="Press monitor")`,
        `[ENRICHER] Detected tech stack update: Cloudflare CDN + Next.js`,
        `[DISPATCH] Completed task run for ${acc.name}. Work session leased next row.`,
      ];
      const randomEv = sample[Math.floor(Math.random() * sample.length)];
      setAgentLogs((prev) => [randomEv, ...prev.slice(0, 9)]);
      setResearchBudgetSpent((b) => +(b + 0.01).toFixed(2));
    }, 7000);
    return () => clearInterval(interval);
  }, [agentRunning, accounts]);

  const handleDispatchComposer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!composerPrompt.trim()) return;
    setIsDispatching(true);
    const p = composerPrompt.trim();
    setComposerPrompt("");

    setTimeout(() => {
      setAgentLogs((prev) => [
        `[COMPOSER] Dispatched new autonomous routine: "${p}"`,
        `[COMPILER] Authored 3 tools: search_crm, enrich_company, record_fact`,
        `[SCHEDULER] Leased 4 candidate records matching ICP`,
        ...prev,
      ]);
      setIsDispatching(false);
    }, 800);
  };

  return (
    <div className="space-y-6">
      {/* Telemetry Header */}
      <div className="p-5 rounded-2xl bg-[#09090b] border border-[#27272a] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-[#121215] border border-emerald-500/30 flex items-center justify-center">
            <Cpu className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-white tracking-tight">Autonomous Agent Fleet</h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950/60 text-emerald-400 border border-emerald-500/30">
                claimDue(Lease Loop Active)
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5 font-mono">
              "The agent is not a feature of the CRM; the CRM is where the agent keeps its notes."
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 rounded-xl bg-[#121215] border border-[#27272a] text-xs font-mono">
            <span className="text-zinc-500">Research Budget: </span>
            <span className="text-emerald-400 font-bold">${researchBudgetSpent}</span>
            <span className="text-zinc-600"> / $5.00</span>
          </div>

          <button
            onClick={() => setAgentRunning(!agentRunning)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
              agentRunning
                ? "bg-[#18181b] text-zinc-300 border border-[#27272a] hover:bg-[#27272a]"
                : "bg-primary text-primary-foreground hover:bg-primary-hover"
            }`}
          >
            {agentRunning ? (
              <Pause className="w-3.5 h-3.5 text-amber-400 fill-current" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current" />
            )}
            <span>{agentRunning ? "Pause Dispatcher" : "Resume Dispatcher"}</span>
          </button>
        </div>
      </div>

      {/* One-Sentence Agent Composer (Comp AI Hallmark) */}
      <div className="p-5 bg-[#09090b] border border-[#27272a] rounded-2xl space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            One-Sentence Agent Composer
          </span>
          <span className="text-[11px] font-mono text-zinc-500">Vercel Eve runtime engine</span>
        </div>

        <form onSubmit={handleDispatchComposer} className="relative">
          <input
            type="text"
            value={composerPrompt}
            onChange={(e) => setComposerPrompt(e.target.value)}
            placeholder="Describe an autonomous agent in plain English..."
            className="w-full bg-[#000000] border border-[#27272a] rounded-xl pl-4 pr-24 py-3 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 font-mono"
          />
          <button
            type="submit"
            disabled={isDispatching || !composerPrompt.trim()}
            className="absolute right-2 top-2 px-3 py-1.5 bg-primary hover:bg-primary-hover disabled:opacity-40 text-primary-foreground font-medium rounded-lg text-xs transition-colors cursor-pointer"
          >
            {isDispatching ? "Compiling..." : "Dispatch"}
          </button>
        </form>

        <div className="flex flex-wrap gap-1.5 text-[11px] font-mono">
          <span className="text-zinc-600 py-0.5">Suggestions:</span>
          {[
            "Enrich all unverified fintech companies in Lagos with tech stack evidence",
            "Audit stale deals (>14d) and schedule rechecks with explicit reasons",
            "Verify corporate MX records for real estate syndicates",
          ].map((chip, idx) => (
            <button
              key={idx}
              onClick={() => setComposerPrompt(chip)}
              className="px-2 py-0.5 rounded bg-[#121215] hover:bg-[#18181b] text-zinc-400 hover:text-zinc-200 border border-[#27272a] transition-colors cursor-pointer"
            >
              {chip}
            </button>
          ))}
        </div>
      </div>

      {/* 4 Specialized Autonomous Agents Fleet */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 text-xs">
        {[
          {
            title: "Scout Agent (scout.ts)",
            role: "DNS & Domain Crawler",
            desc: "Tests corporate SPF/MX records. Never sends mail to unverified addresses.",
            status: "Running",
          },
          {
            title: "Enricher Agent (enricher.ts)",
            role: "Signature Block Extractor",
            desc: "Reads signature blocks, GitHub identity & LinkedIn URLs for exact titles.",
            status: "Active",
          },
          {
            title: "Evidence Ledger (evidence.ts)",
            role: "Zero Guessing Validator",
            desc: "Strong observations write directly. Weak evidence queues for human approval.",
            status: "Strict",
          },
          {
            title: "Scheduler (dispatch.ts)",
            role: "dueAt Task Queue",
            desc: "Books its own follow-ups and records explicit reasons for every re-check.",
            status: "Leasing",
          },
        ].map((agent, i) => (
          <div key={i} className="p-4 bg-[#09090b] border border-[#27272a] rounded-xl space-y-1.5">
            <div className="flex items-center justify-between font-mono text-[10px]">
              <span className="text-zinc-500 uppercase">{agent.title}</span>
              <span className="text-emerald-400 font-semibold">{agent.status}</span>
            </div>
            <p className="font-semibold text-white">{agent.role}</p>
            <p className="text-[11px] text-zinc-400 leading-relaxed">{agent.desc}</p>
          </div>
        ))}
      </div>

      {/* Dual Pane: Monitored Accounts + Live Execution Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-5 bg-[#09090b] border border-[#27272a] rounded-2xl overflow-hidden flex flex-col">
          <div className="p-4 border-b border-[#18181b] flex items-center justify-between">
            <h3 className="text-xs font-semibold text-zinc-300 font-mono uppercase tracking-wider">
              Autonomous Lease Queue ({accounts.length})
            </h3>
            <span className="text-[10px] font-mono text-emerald-400">claimDue(active)</span>
          </div>

          <div className="divide-y divide-[#121215] overflow-y-auto max-h-[420px]">
            {accounts.map((acc) => (
              <div
                key={acc.id}
                onClick={() => {
                  setSelectedAccount(acc);
                  setIsDetailOpen(true);
                }}
                className={`p-4 cursor-pointer transition-all ${
                  selectedAccount?.id === acc.id
                    ? "bg-[#121215] border-l-2 border-emerald-400"
                    : "hover:bg-[#0d0d10]"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-xs font-semibold text-white">{acc.name}</h4>
                    <p className="text-[11px] font-mono text-zinc-500">{acc.domain}</p>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-[#27272a] bg-[#121215] text-zinc-300">
                    {acc.agentStatus}
                  </span>
                </div>

                <p className="text-[11px] text-zinc-400 mt-2 line-clamp-1">{acc.lastAction}</p>

                <div className="mt-2 pt-2 border-t border-[#18181b] flex items-center justify-between text-[11px] font-mono text-zinc-500">
                  <span>Recheck: {acc.nextRecheck}</span>
                  <span className="text-emerald-400 font-semibold">{acc.dealValue}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-7 bg-[#09090b] border border-[#27272a] rounded-2xl flex flex-col overflow-hidden">
          <div className="p-4 border-b border-[#18181b] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs font-semibold text-zinc-300 font-mono uppercase tracking-wider">
                Live Agent Task Dispatcher
              </h3>
            </div>
            <span className="text-[10px] font-mono text-zinc-500">
              {agentRunning ? "POLLING (every 7s)" : "PAUSED"}
            </span>
          </div>

          <div className="p-4 bg-[#000000] font-mono text-[11px] space-y-2.5 flex-1 overflow-y-auto max-h-[420px]">
            {agentLogs.map((log, i) => (
              <div key={i} className="flex items-start gap-2 leading-relaxed">
                <span className="text-emerald-500 select-none">›</span>
                <span
                  className={
                    log.includes("EVIDENCE")
                      ? "text-sky-300"
                      : log.includes("SCOUT")
                      ? "text-amber-300"
                      : log.includes("SCHEDULER")
                      ? "text-purple-300"
                      : "text-zinc-300"
                  }
                >
                  {log}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Slide-over Detail Sheet */}
      {isDetailOpen && selectedAccount && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            onClick={() => setIsDetailOpen(false)}
            className="fixed inset-0 bg-black/70 backdrop-blur-xs transition-opacity"
          />

          <div className="relative w-full max-w-xl bg-[#09090b] border-l border-[#27272a] h-full shadow-2xl flex flex-col z-10 overflow-hidden">
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
                  className="p-1 rounded-md text-zinc-500 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
              <div className="p-3.5 bg-[#0d0d10] border border-[#27272a] rounded-xl space-y-1">
                <span className="text-[10px] uppercase font-mono text-zinc-500">Summary Brief</span>
                <p className="text-zinc-300 leading-relaxed">{selectedAccount.facts.summary}</p>
              </div>

              <div className="p-3.5 bg-[#0d0d10] border border-[#27272a] rounded-xl space-y-2">
                <span className="text-[10px] uppercase font-mono text-zinc-500">Decision Maker</span>
                <p className="text-sm font-semibold text-white">{selectedAccount.facts.decisionMaker}</p>
                <p className="text-zinc-400">{selectedAccount.facts.title}</p>
                <div className="pt-2 border-t border-[#18181b] font-mono text-[11px] text-zinc-300">
                  <p>Email: {selectedAccount.facts.email}</p>
                  <p>Phone: {selectedAccount.facts.phone}</p>
                </div>
              </div>

              <div className="p-3.5 bg-[#0d0d10] border border-[#27272a] rounded-xl space-y-2">
                <span className="text-[10px] uppercase font-mono text-zinc-500">Strict Evidence Ledger</span>
                <div className="space-y-2">
                  {selectedAccount.evidenceLedger.map((ev) => (
                    <div key={ev.id} className="p-2.5 bg-[#000000] border border-[#18181b] rounded-lg">
                      <div className="flex justify-between font-mono text-[10px] text-emerald-400">
                        <span>{ev.source}</span>
                        <span className="text-zinc-500">{ev.timestamp}</span>
                      </div>
                      <p className="text-zinc-300 mt-1">{ev.fact}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-[10px] uppercase font-mono text-zinc-500">
                  Instruct Worker Assigned to this Record
                </span>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!directiveInput.trim()) return;
                    const d = directiveInput.trim();
                    setDirectiveInput("");
                    setSelectedAccount((prev) =>
                      prev ? { ...prev, agentNotes: [`Rep Instruction: "${d}"`, ...prev.agentNotes] } : null
                    );
                  }}
                  className="relative"
                >
                  <input
                    type="text"
                    value={directiveInput}
                    onChange={(e) => setDirectiveInput(e.target.value)}
                    placeholder="Give custom directive for next run..."
                    className="w-full bg-[#000000] border border-[#27272a] rounded-lg pl-3 pr-9 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 font-mono"
                  />
                  <button type="submit" className="absolute right-2 top-2 text-zinc-400 hover:text-white">
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
