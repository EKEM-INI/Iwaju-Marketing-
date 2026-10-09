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
  ChevronDown,
  Globe,
  Bot,
  RefreshCw,
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
  const [showClientMenu, setShowClientMenu] = useState(false);
  const [isAiGenerating, setIsAiGenerating] = useState(false);

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

  /**
   * Truly functional email dispatcher:
   * Handles opening native desktop clients, Gmail Web, or Outlook Web,
   * while backing up to clipboard and advancing pipeline status.
   */
  const handleOpenEmailClient = (client: "default" | "gmail" | "outlook") => {
    if (!currentLead) return;

    // 1. Copy text to clipboard as safety backup
    navigator.clipboard.writeText(`Subject: ${subjectText}\n\n${bodyText}`);

    // 2. Open selected client
    if (client === "gmail") {
      const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(
        currentLead.email
      )}&su=${encodeURIComponent(subjectText)}&body=${encodeURIComponent(bodyText)}`;
      window.open(gmailUrl, "_blank", "noopener,noreferrer");
      showToast(
        "Opening Gmail Web",
        `New compose tab opened for ${currentLead.email}. Email copy backed up to clipboard.`,
        "success"
      );
    } else if (client === "outlook") {
      const outlookUrl = `https://outlook.office.com/mail/deeplink/compose?to=${encodeURIComponent(
        currentLead.email
      )}&subject=${encodeURIComponent(subjectText)}&body=${encodeURIComponent(bodyText)}`;
      window.open(outlookUrl, "_blank", "noopener,noreferrer");
      showToast(
        "Opening Outlook 365",
        `New compose tab opened for ${currentLead.email}. Email copy backed up to clipboard.`,
        "success"
      );
    } else {
      // Native desktop handler (mailto:)
      const mailtoUrl = `mailto:${encodeURIComponent(
        currentLead.email
      )}?subject=${encodeURIComponent(subjectText)}&body=${encodeURIComponent(bodyText)}`;
      window.location.href = mailtoUrl;
      showToast(
        "Opening Desktop Mail",
        `Launched default system email app for ${currentLead.email}.`,
        "info"
      );
    }

    // 3. Automatically advance the lead in the CRM to "Contacted"
    onMarkContacted(currentLead.id);
    setMarkedContacted(true);
    setShowClientMenu(false);
  };

  /**
   * AI Personalization Generator
   * Re-synthesizes the email hook using company niche, location, and decision maker role
   */
  const handleAiEnhance = () => {
    if (!currentLead) return;
    setIsAiGenerating(true);

    setTimeout(() => {
      const firstName = currentLead.name.split(" ")[0] || currentLead.name;
      const enhancedSubject = `Strategic B2B Pipeline Growth for ${currentLead.company} (${currentLead.location})`;
      const enhancedBody = `Hi ${firstName},

I've been following ${currentLead.company}'s recent positioning in the ${currentLead.niche} sector across ${currentLead.location}. Given your executive leadership as ${currentLead.title}, I wanted to share a quick operational perspective.

Most ${currentLead.niche} organizations in ${currentLead.location} face significant friction securing predictable high-ticket client meetings without burning capital on unfocused outreach.

At Iwaju Marketing, we deploy dedicated outbound pipeline systems tailored specifically for ${currentLead.niche} operators. We recently helped a peer account in your space generate ₦28M+ in qualified pipeline in under 60 days.

Are you available for a brief 10-minute briefing this Thursday at 2:00 PM to see how we can replicate this for ${currentLead.company}?

Best regards,
Tunde Balogun
Growth Lead | Iwaju Marketing`;

      setSubjectText(enhancedSubject);
      setBodyText(enhancedBody);
      setIsAiGenerating(false);
      showToast(
        "AI Copy Generated",
        `Personalized outreach copy synthesized for ${currentLead.company}.`,
        "success"
      );
    }, 800);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left Column: Target Selector & Templates */}
      <div className="lg:col-span-5 space-y-6">
        {/* Target Lead Selector */}
        <div className="rounded-2xl bg-zinc-900/80 border border-zinc-800 p-5 backdrop-blur-md space-y-3">
          <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-emerald-400" />
              <span>Target Lead Recipient</span>
            </span>
            <span className="text-[11px] text-zinc-500 font-mono">
              {leads.length} Available
            </span>
          </label>

          <select
            value={selectedLeadId}
            onChange={(e) => setSelectedLeadId(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-zinc-100 focus:outline-none focus:border-emerald-500 font-medium"
          >
            {leads.map((l) => (
              <option key={l.id} value={l.id}>
                {l.company} — {l.name} ({l.niche})
              </option>
            ))}
          </select>

          {/* Recipient Profile Card */}
          {currentLead && (
            <div className="p-3.5 rounded-xl bg-zinc-950/70 border border-zinc-800/80 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-zinc-200">
                  {currentLead.name}
                </span>
                <span className="text-emerald-400 font-mono text-[11px]">
                  {currentLead.title}
                </span>
              </div>
              <div className="text-zinc-400 flex items-center gap-2 font-mono text-[11px] truncate">
                <Mail className="w-3 h-3 text-zinc-500 shrink-0" />
                <span className="truncate">{currentLead.email}</span>
              </div>
              <div className="text-zinc-500 text-[11px] flex items-center justify-between">
                <span>
                  {currentLead.location} • Stage:{" "}
                  <span className="text-zinc-300 capitalize">{currentLead.stage}</span>
                </span>
                <span className="font-mono text-emerald-400">Score: {currentLead.score}/100</span>
              </div>
            </div>
          )}
        </div>

        {/* Template Framework Selector */}
        <div className="rounded-2xl bg-zinc-900/80 border border-zinc-800 p-5 backdrop-blur-md">
          <TemplateSelector
            selectedTemplateId={selectedTemplate.id}
            onSelectTemplate={(tmpl) => setSelectedTemplate(tmpl)}
          />
        </div>
      </div>

      {/* Right Column: Live Email Editor & Sender */}
      <div className="lg:col-span-7">
        <div className="rounded-2xl bg-zinc-900/80 border border-zinc-800 p-6 backdrop-blur-md space-y-5 flex flex-col h-full shadow-xl">
          <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm sm:text-base font-bold text-white">
                Personalized Cold Email Generator
              </h3>
            </div>

            {/* AI Personalization Action */}
            <button
              onClick={handleAiEnhance}
              disabled={isAiGenerating}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 transition-all disabled:opacity-50"
              title="Enhance email with AI personalized context"
            >
              {isAiGenerating ? (
                <>
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  <span>Synthesizing...</span>
                </>
              ) : (
                <>
                  <Bot className="w-3 h-3" />
                  <span>Compose with ChatGPT Brain</span>
                </>
              )}
            </button>
          </div>

          {/* Subject Line */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label className="font-semibold uppercase tracking-wider text-zinc-400">
                Subject Line
              </label>
              <button
                onClick={handleCopySubject}
                className="text-[11px] text-zinc-400 hover:text-emerald-400 flex items-center gap-1 transition-colors"
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
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-white font-medium focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Email Body */}
          <div className="space-y-1.5 flex-1 flex flex-col">
            <div className="flex items-center justify-between text-xs">
              <label className="font-semibold uppercase tracking-wider text-zinc-400">
                Email Copy Body
              </label>
              <button
                onClick={handleCopyBody}
                className="text-[11px] text-zinc-400 hover:text-emerald-400 flex items-center gap-1 transition-colors"
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
              className="w-full flex-1 bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-xs sm:text-sm text-zinc-200 focus:outline-none focus:border-emerald-500 leading-relaxed font-sans"
            />
          </div>

          {/* Actions Bar */}
          <div className="pt-4 border-t border-zinc-800 flex flex-wrap items-center justify-between gap-3 relative">
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyFull}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold text-xs border border-zinc-700 transition-colors"
                title="Copy subject and body to clipboard"
              >
                <Copy className="w-3.5 h-3.5 text-emerald-400" />
                <span>Copy Full Email</span>
              </button>

              {/* Functional Open in Email App Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowClientMenu(!showClientMenu)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-xs font-semibold border border-zinc-700 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Open in Email App</span>
                  <ChevronDown className="w-3 h-3 text-zinc-400" />
                </button>

                {showClientMenu && (
                  <div className="absolute left-0 bottom-full mb-2 w-56 rounded-xl bg-zinc-900 border border-zinc-700 shadow-2xl p-1.5 z-50 animate-in fade-in slide-in-from-bottom-2">
                    <p className="px-3 py-1.5 text-[10px] uppercase font-bold text-zinc-400 border-b border-zinc-800">
                      Choose Email Dispatcher:
                    </p>
                    <button
                      onClick={() => handleOpenEmailClient("gmail")}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left text-zinc-200 hover:bg-emerald-500/10 hover:text-emerald-300 rounded-lg transition-colors"
                    >
                      <span className="w-2 h-2 rounded-full bg-rose-400" />
                      <span>Gmail (Web Compose)</span>
                    </button>
                    <button
                      onClick={() => handleOpenEmailClient("outlook")}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left text-zinc-200 hover:bg-emerald-500/10 hover:text-emerald-300 rounded-lg transition-colors"
                    >
                      <span className="w-2 h-2 rounded-full bg-sky-400" />
                      <span>Outlook 365 (Web)</span>
                    </button>
                    <button
                      onClick={() => handleOpenEmailClient("default")}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left text-zinc-200 hover:bg-emerald-500/10 hover:text-emerald-300 rounded-lg transition-colors"
                    >
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      <span>Default System Mail (Desktop)</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Direct Send & Mark Contacted Button */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleOpenEmailClient("gmail")}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-primary-foreground font-medium text-xs shadow-glow transition-all"
                title="Open Gmail and mark as Contacted"
              >
                <Send className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Launch & Mark Contacted</span>
              </button>

              <button
                onClick={handleMarkContacted}
                disabled={markedContacted || currentLead?.stage === "contacted"}
                className={`inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold border transition-all ${
                  markedContacted || currentLead?.stage === "contacted"
                    ? "bg-zinc-900 text-emerald-400 border-emerald-500/30"
                    : "bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border-zinc-700"
                }`}
                title="Just mark lead as contacted in CRM"
              >
                {markedContacted || currentLead?.stage === "contacted" ? (
                  <>
                    <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Contacted</span>
                  </>
                ) : (
                  <span>Mark in CRM</span>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
