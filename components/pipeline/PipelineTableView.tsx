"use client";

import React, { useState, useMemo } from "react";
import { Lead, PipelineStage } from "@/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import { StageBadge, LeadScoreBadge } from "@/components/ui/Badge";
import {
  Search,
  ArrowUpDown,
  Download,
  Mail,
  Phone,
  Globe,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Send,
  MoreHorizontal,
  CheckCircle2,
  Filter,
} from "lucide-react";
import Link from "next/link";

interface PipelineTableViewProps {
  leads: Lead[];
  onSelectLead: (lead: Lead) => void;
  onUpdateStage: (leadId: string, stage: PipelineStage) => void;
  onDeleteLead: (leadId: string) => void;
}

const STAGES: { id: PipelineStage; label: string }[] = [
  { id: "new", label: "New Lead" },
  { id: "contacted", label: "Contacted" },
  { id: "meeting", label: "Meeting Booked" },
  { id: "closed", label: "Closed Won" },
];

export function PipelineTableView({
  leads,
  onSelectLead,
  onUpdateStage,
  onDeleteLead,
}: PipelineTableViewProps) {
  const [search, setSearch] = useState("");
  const [selectedStage, setSelectedStage] = useState<string>("all");
  const [sortField, setSortField] = useState<"dealValue" | "score" | "createdAt" | "company">("dealValue");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Filter and sort leads
  const filteredLeads = useMemo(() => {
    return leads
      .filter((lead) => {
        const matchesStage = selectedStage === "all" || lead.stage === selectedStage;
        if (!matchesStage) return false;

        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return (
          lead.company.toLowerCase().includes(q) ||
          lead.name.toLowerCase().includes(q) ||
          lead.email.toLowerCase().includes(q) ||
          lead.niche.toLowerCase().includes(q) ||
          lead.location.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        let valA = a[sortField];
        let valB = b[sortField];

        if (sortField === "dealValue" || sortField === "score") {
          return sortOrder === "desc" ? (valB as number) - (valA as number) : (valA as number) - (valB as number);
        }

        if (sortField === "createdAt") {
          return sortOrder === "desc"
            ? new Date(valB as string).getTime() - new Date(valA as string).getTime()
            : new Date(valA as string).getTime() - new Date(valB as string).getTime();
        }

        return sortOrder === "desc"
          ? String(valB).localeCompare(String(valA))
          : String(valA).localeCompare(String(valB));
      });
  }, [leads, search, selectedStage, sortField, sortOrder]);

  const totalPages = Math.ceil(filteredLeads.length / pageSize) || 1;
  const paginatedLeads = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredLeads.slice(start, start + pageSize);
  }, [filteredLeads, page, pageSize]);

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  const exportCsv = () => {
    const headers = [
      "Company",
      "Contact Person",
      "Title",
      "Email",
      "Phone",
      "Website",
      "Industry",
      "Location",
      "Stage",
      "Deal Value",
      "Score",
    ];

    const rows = filteredLeads.map((l) => [
      `"${l.company.replace(/"/g, '""')}"`,
      `"${l.name.replace(/"/g, '""')}"`,
      `"${l.title.replace(/"/g, '""')}"`,
      `"${l.email.replace(/"/g, '""')}"`,
      `"${l.phone.replace(/"/g, '""')}"`,
      `"${l.website.replace(/"/g, '""')}"`,
      `"${l.niche.replace(/"/g, '""')}"`,
      `"${l.location.replace(/"/g, '""')}"`,
      `"${l.stage}"`,
      l.dealValue,
      l.score,
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `iwaju-pipeline-export-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4">
      {/* Search, Filter Tabs & Export Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-md">
        {/* Stage Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => {
              setSelectedStage("all");
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              selectedStage === "all"
                ? "bg-emerald-500 text-slate-950 shadow-glow"
                : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
            }`}
          >
            All Accounts ({leads.length})
          </button>
          {STAGES.map((s) => {
            const count = leads.filter((l) => l.stage === s.id).length;
            const isSelected = selectedStage === s.id;
            return (
              <button
                key={s.id}
                onClick={() => {
                  setSelectedStage(s.id);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  isSelected
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-glow"
                    : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
                }`}
              >
                {s.label} ({count})
              </button>
            );
          })}
        </div>

        {/* Search & Actions */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[240px]">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search across 1,000+ accounts..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <button
            onClick={exportCsv}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors"
            title="Export full list to CSV / Excel"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="rounded-2xl border border-slate-800 bg-slate-950/70 overflow-hidden shadow-2xl backdrop-blur-md">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/90 text-slate-400 font-semibold uppercase tracking-wider text-[11px] select-none">
                <th
                  onClick={() => handleSort("company")}
                  className="py-3.5 px-4 cursor-pointer hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Company & Domain</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-3.5 px-4">Decision Maker</th>
                <th className="py-3.5 px-4">Contact Info</th>
                <th className="py-3.5 px-4">Location</th>
                <th
                  onClick={() => handleSort("dealValue")}
                  className="py-3.5 px-4 cursor-pointer hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Deal Value</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("score")}
                  className="py-3.5 px-4 cursor-pointer hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Intent Score</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-3.5 px-4">Pipeline Stage</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {paginatedLeads.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    No leads found matching your search criteria.
                  </td>
                </tr>
              ) : (
                paginatedLeads.map((lead) => (
                  <tr
                    key={lead.id}
                    onClick={() => onSelectLead(lead)}
                    className="hover:bg-slate-900/60 transition-colors cursor-pointer group"
                  >
                    {/* Company */}
                    <td className="py-3.5 px-4">
                      <div>
                        <span className="font-bold text-white group-hover:text-emerald-400 transition-colors block text-sm">
                          {lead.company}
                        </span>
                        <a
                          href={lead.website}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-[11px] text-slate-500 hover:text-slate-300 font-mono inline-flex items-center gap-1"
                        >
                          <Globe className="w-2.5 h-2.5" />
                          <span className="truncate max-w-[150px]">{lead.website.replace(/https?:\/\//, "")}</span>
                        </a>
                      </div>
                    </td>

                    {/* Decision Maker */}
                    <td className="py-3.5 px-4">
                      <div>
                        <span className="font-semibold text-slate-200 block">
                          {lead.name}
                        </span>
                        <span className="text-[11px] text-emerald-400 font-medium">
                          {lead.title}
                        </span>
                      </div>
                    </td>

                    {/* Contact Info */}
                    <td className="py-3.5 px-4 font-mono text-[11px] text-slate-400">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5 truncate max-w-[180px]">
                          <Mail className="w-3 h-3 text-slate-500 shrink-0" />
                          <span className="truncate">{lead.email}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Phone className="w-3 h-3 text-slate-500 shrink-0" />
                          <span>{lead.phone}</span>
                        </div>
                      </div>
                    </td>

                    {/* Location */}
                    <td className="py-3.5 px-4 text-slate-300 text-xs">
                      <span className="block truncate max-w-[140px]" title={lead.location}>
                        {lead.location}
                      </span>
                      <span className="text-[10px] text-slate-500">{lead.niche}</span>
                    </td>

                    {/* Deal Value */}
                    <td className="py-3.5 px-4 font-mono font-bold text-emerald-400 text-xs">
                      {formatCurrency(lead.dealValue, lead.currency)}
                    </td>

                    {/* Score */}
                    <td className="py-3.5 px-4">
                      <LeadScoreBadge score={lead.score} />
                    </td>

                    {/* Stage Dropdown */}
                    <td className="py-3.5 px-4" onClick={(e) => e.stopPropagation()}>
                      <select
                        value={lead.stage}
                        onChange={(e) => onUpdateStage(lead.id, e.target.value as PipelineStage)}
                        className={`text-xs font-semibold rounded-lg px-2 py-1 border focus:outline-none ${
                          lead.stage === "new"
                            ? "bg-sky-500/10 text-sky-400 border-sky-500/30"
                            : lead.stage === "contacted"
                            ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                            : lead.stage === "meeting"
                            ? "bg-purple-500/10 text-purple-400 border-purple-500/30"
                            : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                        }`}
                      >
                        <option value="new">New Lead</option>
                        <option value="contacted">Contacted</option>
                        <option value="meeting">Meeting Booked</option>
                        <option value="closed">Closed Won</option>
                      </select>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          href={`/outreach?leadId=${encodeURIComponent(lead.id)}`}
                          className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-emerald-400 border border-slate-800 transition-colors"
                          title="Generate cold email copy"
                        >
                          <Send className="w-3.5 h-3.5 text-emerald-400" />
                        </Link>
                        <button
                          onClick={() => onSelectLead(lead)}
                          className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-colors"
                          title="View lead profile"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/60 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span>
              Showing <strong className="text-white">{(page - 1) * pageSize + 1}</strong> to{" "}
              <strong className="text-white">{Math.min(page * pageSize, filteredLeads.length)}</strong> of{" "}
              <strong className="text-emerald-400">{filteredLeads.length}</strong> total leads
            </span>
            <span className="text-slate-600">|</span>
            <div className="flex items-center gap-1.5">
              <span>Per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="bg-slate-950 border border-slate-800 text-slate-200 rounded px-2 py-1 text-xs focus:outline-none"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
              disabled={page === 1}
              className="p-1.5 rounded-lg bg-slate-900 text-slate-400 hover:text-white border border-slate-800 disabled:opacity-40 disabled:hover:text-slate-400 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 font-mono">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
              disabled={page === totalPages}
              className="p-1.5 rounded-lg bg-slate-900 text-slate-400 hover:text-white border border-slate-800 disabled:opacity-40 disabled:hover:text-slate-400 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
