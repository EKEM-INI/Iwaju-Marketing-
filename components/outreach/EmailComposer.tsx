"use client";

import React, { useState, useEffect } from "react";
import { Lead, EmailTemplate } from "@/types";
import { EMAIL_TEMPLATES, interpolateTemplate } from "@/lib/email-templates";
import { TemplateSelector } from "@/components/outreach/TemplateSelector";
import { useToast } from "@/components/ui/Toast";
import {
  Copy,
  Check,
  Send,
  ExternalLink,
  Sparkles,
  User,
  Building2,
  Mail,
  CheckCheck,
} from "lucide-react";

interface EmailComposerProps {
  leads: Lead[];
  initialLeadId?: string;
  onMarkContacted: (leadId: string) => void;
}

export function EmailComposer({
  leads,
  initialLeadId,
  onMarkContacted,
}: EmailComposerProps) {
  const { showToast } = useToast();

  const [selectedLeadId, setSelectedLeadId] = useState<string>(
    initialLeadId || (leads[0]?.id ?? "")
  );
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate>(
    EMAIL_TEMPLATES[0]
  );
  const [copiedSubject, setCopiedSubject] = useState(false);
  const [copiedBody, setCopiedBody] = useState(false);
  const [markedContacted, setMarkedContacted] = useState(false);

  // Update selected lead if initialLeadId changes from query params
  useEffect(() => {
    if (initialLeadId && leads.some((l) => l.id === initialLeadId)) {
      setSelectedLeadId(initialLeadId);
    } else if (!selectedLeadId && leads.length > 0) {
      setSelectedLeadId(leads[0].id);
    }
  }, [initialLeadId, leads, selectedLeadId]);

  const currentLead = leads.find((l) => l.id === selectedLeadId) || leads[0];

  const interpolated = currentLead
    ? interpolateTemplate(selectedTemplate, {
        firstName: currentLead.name.split(" ")[0] || currentLead.name,
        companyName: currentLead.company,
        niche: currentLead.niche,
        location: currentLead.location,
      })
    : { subject: selectedTemplate.subject, body: selectedTemplate.body };

  const [subjectText, setSubjectText] = useState(interpolated.subject);
  const [bodyText, setBodyText] = useState(interpolated.body);

  useEffect(() => {
    setSubjectText(interpolated.subject);
    setBodyText(interpolated.body);
    setMarkedContacted(false);
  }, [selectedLeadId, selectedTemplate.id]);

  const handleCopySubject = () => {
    navigator.clipboard.writeText(subjectText);
    setCopiedSubject(true);
    showToast("Subject Copied", "Subject line copied to clipboard.", "success");
    setTimeout(() => setCopiedSubject(false), 2000);
  };

  const handleCopyBody = () => {
    navigator.clipboard.writeText(bodyText);
    setCopiedBody(true);
    showToast(
      "Email Body Copied",
      "Personalized cold email copy copied to clipboard.",
      "success"
    );
    setTimeout(() => setCopiedBody(false), 2000);
  };

  const handleCopyFull = () => {
    const fullText = `Subject: ${subjectText}\n\n${bodyText}`;
    navigator.clipboard.writeText(fullText);
    setCopiedBody(true);
    showToast(
      "Complete Email Copied",
      "Subject line and email body copied to clipboard.",
      "success"
    );
    setTimeout(() => setCopiedBody(false), 2000);
  };

  const handleMarkContacted = () => {
    if (!currentLead) return;
    onMarkContacted(currentLead.id);
    setMarkedContacted(true);
    showToast(
      "Lead Marked Contacted",
      `${currentLead.company} has been moved to 'Contacted' stage in the CRM.`,
      "success"
    );
  };

  const mailtoLink = currentLead
    ? `mailto:${encodeURIComponent(currentLead.email)}?subject=${encodeURIComponent(
        subjectText
      )}&body=${encodeURIComponent(bodyText)}`
    : "#";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left Column: Target Selector & Templates */}
      <div className="lg:col-span-5 space-y-6">
        {/* Target Lead Selector */}
        <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-5 backdrop-blur-md space-y-3">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-emerald-400" />
              <span>Target Lead Recipient</span>
            </span>
            <span className="text-[11px] text-slate-500 font-mono">
              {leads.length} Available
            </span>
          </label>

          <select
            value={selectedLeadId}
            onChange={(e) => setSelectedLeadId(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-100 focus:outline-none focus:border-emerald-500 font-medium"
          >
            {leads.map((l) => (
              <option key={l.id} value={l.id}>
                {l.company} — {l.name} ({l.niche})
              </option>
            ))}
          </select>

          {/* Recipient Profile Card */}
          {currentLead && (
            <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-200">
                  {currentLead.name}
                </span>
                <span className="text-emerald-400 font-mono text-[11px]">
                  {currentLead.title}
                </span>
              </div>
              <div className="text-slate-400 flex items-center gap-2 font-mono text-[11px] truncate">
                <Mail className="w-3 h-3 text-slate-500 shrink-0" />
                <span className="truncate">{currentLead.email}</span>
              </div>
              <div className="text-slate-500 text-[11px]">
                {currentLead.location} • Stage:{" "}
                <span className="text-slate-300 capitalize">{currentLead.stage}</span>
              </div>
            </div>
          )}
        </div>

        {/* Template Framework Selector */}
        <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-5 backdrop-blur-md">
          <TemplateSelector
            selectedTemplateId={selectedTemplate.id}
            onSelectTemplate={(tmpl) => setSelectedTemplate(tmpl)}
          />
        </div>
      </div>

      {/* Right Column: Live Email Editor & Sender */}
      <div className="lg:col-span-7">
        <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-6 backdrop-blur-md space-y-5 flex flex-col h-full shadow-xl">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm sm:text-base font-bold text-white">
                Personalized Cold Email Generator
              </h3>
            </div>
            <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
              High Deliverability
            </span>
          </div>

          {/* Subject Line */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label className="font-semibold uppercase tracking-wider text-slate-400">
                Subject Line
              </label>
              <button
                onClick={handleCopySubject}
                className="text-[11px] text-slate-400 hover:text-emerald-400 flex items-center gap-1 transition-colors"
              >
                {copiedSubject ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span className="text-emerald-400">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy Subject</span>
                  </>
                )}
              </button>
            </div>
            <input
              type="text"
              value={subjectText}
              onChange={(e) => setSubjectText(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-white font-medium focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Email Body */}
          <div className="space-y-1.5 flex-1 flex flex-col">
            <div className="flex items-center justify-between text-xs">
              <label className="font-semibold uppercase tracking-wider text-slate-400">
                Email Copy Body
              </label>
              <button
                onClick={handleCopyBody}
                className="text-[11px] text-slate-400 hover:text-emerald-400 flex items-center gap-1 transition-colors"
              >
                {copiedBody ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span className="text-emerald-400">Copied Body!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy Body</span>
                  </>
                )}
              </button>
            </div>
            <textarea
              rows={12}
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
              className="w-full flex-1 bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-emerald-500 leading-relaxed font-sans"
            />
          </div>

          {/* Actions Bar */}
          <div className="pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyFull}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700 transition-colors"
              >
                <Copy className="w-3.5 h-3.5 text-emerald-400" />
                <span>Copy Full Email</span>
              </button>

              <a
                href={mailtoLink}
                className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs border border-slate-700 transition-colors"
                title="Open default email application"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Open in Mail</span>
              </a>
            </div>

            <button
              onClick={handleMarkContacted}
              disabled={markedContacted || currentLead?.stage === "contacted"}
              className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs transition-all ${
                markedContacted || currentLead?.stage === "contacted"
                  ? "bg-slate-800 text-emerald-400 border border-emerald-500/30"
                  : "bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 shadow-glow"
              }`}
            >
              {markedContacted || currentLead?.stage === "contacted" ? (
                <>
                  <CheckCheck className="w-4 h-4 text-emerald-400" />
                  <span>Marked Contacted</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Send & Advance to Contacted</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
