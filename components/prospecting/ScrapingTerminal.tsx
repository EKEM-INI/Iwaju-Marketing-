"use client";

import React, { useEffect, useState } from "react";
import { ScrapingLog } from "@/types";
import { Terminal, CheckCircle2, AlertTriangle, Info, Radio } from "lucide-react";

interface ScrapingTerminalProps {
  logs: ScrapingLog[];
  progress: number;
}

export function ScrapingTerminal({ logs, progress }: ScrapingTerminalProps) {
  const [visibleLogs, setVisibleLogs] = useState<ScrapingLog[]>([]);

  useEffect(() => {
    setVisibleLogs([]);
    logs.forEach((log, index) => {
      const timer = setTimeout(() => {
        setVisibleLogs((prev) => [...prev, log]);
      }, (index + 1) * 350);
      return () => clearTimeout(timer);
    });
  }, [logs]);

  return (
    <div className="rounded-2xl bg-zinc-950 border border-emerald-500/30 overflow-hidden shadow-2xl font-mono text-xs">
      {/* Terminal Bar */}
      <div className="bg-zinc-900/90 px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-rose-500/80" />
          <div className="w-3 h-3 rounded-full bg-amber-500/80" />
          <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
          <span className="ml-2 text-zinc-400 text-[11px] font-sans font-medium flex items-center gap-1.5">
            <Terminal className="w-3.5 h-3.5 text-emerald-400" />
            iwaju-crawler-daemon://v4.8 --mode=deep-discovery
          </span>
        </div>
        <div className="flex items-center gap-2 text-emerald-400 text-[11px]">
          <Radio className="w-3.5 h-3.5 animate-pulse" />
          <span>Active Scanner</span>
        </div>
      </div>

      {/* Progress Line */}
      <div className="h-1 bg-zinc-900 w-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-300 shadow-glow"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Terminal Body */}
      <div className="p-4 sm:p-5 space-y-2.5 max-h-64 overflow-y-auto bg-black/60 scrollbar-thin">
        {visibleLogs.map((log) => (
          <div
            key={log.id}
            className="flex items-start gap-2.5 text-zinc-300 animate-in fade-in slide-in-from-left-2 duration-200"
          >
            <span className="text-zinc-600 select-none">[{log.timestamp}]</span>
            {log.status === "success" && (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
            )}
            {log.status === "warning" && (
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
            )}
            {log.status === "info" && (
              <Info className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />
            )}
            <span
              className={
                log.status === "success"
                  ? "text-emerald-300 font-semibold"
                  : log.status === "warning"
                  ? "text-amber-300"
                  : "text-zinc-300"
              }
            >
              {log.text}
            </span>
          </div>
        ))}

        {progress < 100 && (
          <div className="flex items-center gap-2 text-emerald-400/80 pt-1 animate-pulse">
            <span className="inline-block w-2 h-4 bg-emerald-400 animate-bounce" />
            <span>Parsing target registries & verifying decision-maker MX records...</span>
          </div>
        )}
      </div>
    </div>
  );
}
