"use client";

import React from "react";
import { EmailTemplate } from "@/types";
import { EMAIL_TEMPLATES } from "@/lib/email-templates";
import { Sparkles, Check, Mail } from "lucide-react";

interface TemplateSelectorProps {
  selectedTemplateId: string;
  onSelectTemplate: (template: EmailTemplate) => void;
}

export function TemplateSelector({
  selectedTemplateId,
  onSelectTemplate,
}: TemplateSelectorProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
          <Mail className="w-3.5 h-3.5 text-emerald-400" />
          <span>Select Outreach Copy Framework</span>
        </label>
        <span className="text-[11px] text-zinc-500 font-mono">
          {EMAIL_TEMPLATES.length} Frameworks
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {EMAIL_TEMPLATES.map((tmpl) => {
          const isSelected = tmpl.id === selectedTemplateId;

          return (
            <button
              key={tmpl.id}
              type="button"
              onClick={() => onSelectTemplate(tmpl)}
              className={`p-3.5 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
                isSelected
                  ? "bg-emerald-500/10 border-emerald-500/50 shadow-glow"
                  : "bg-zinc-950/70 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/60"
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                      isSelected
                        ? "bg-emerald-500/20 text-emerald-300"
                        : "bg-zinc-800 text-zinc-400"
                    }`}
                  >
                    {tmpl.category}
                  </span>
                  {isSelected && (
                    <span className="w-4 h-4 rounded-full bg-emerald-500 text-zinc-950 flex items-center justify-center">
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    </span>
                  )}
                </div>
                <h4 className="text-xs font-bold text-zinc-100 pt-1">
                  {tmpl.name}
                </h4>
                <p className="text-[11px] text-zinc-400 line-clamp-2 leading-relaxed">
                  {tmpl.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
