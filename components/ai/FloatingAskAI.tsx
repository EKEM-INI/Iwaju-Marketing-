"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Sparkles,
  X,
  Send,
  Bot,
  User,
  Minimize2,
  Maximize2,
  Trash2,
} from "lucide-react";

interface Message {
  id: string;
  sender: "user" | "ai";
  text: string;
  timestamp: string;
  provider?: string;
}

export function FloatingAskAI() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome-msg",
      sender: "ai",
      text: "👋 Hello! I am **Iwaju AI Copilot** powered by Google Gemini. Ask me anything about using this platform, lead prospecting, pipeline CRM, or generating cold outreach copy!",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      provider: "Iwaju Intelligence",
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && !isMinimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen, isMinimized]);

  useEffect(() => {
    if (isOpen && !isMinimized) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen, isMinimized]);

  const handleSendMessage = async (customText?: string) => {
    const textToSend = customText || input;
    if (!textToSend.trim() || loading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      sender: "user",
      text: textToSend.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMessage]);
    if (!customText) setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/ai/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: textToSend.trim() }),
      });

      const data = await res.json();

      if (res.ok && data.answer) {
        const aiReply: Message = {
          id: `ai-${Date.now()}`,
          sender: "ai",
          text: data.answer,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          provider: data.provider || "Gemini 2.5 Flash",
        };
        setMessages((prev) => [...prev, aiReply]);
      } else {
        throw new Error(data.error || "Failed to receive AI response.");
      }
    } catch (err: any) {
      const errorMsg: Message = {
        id: `err-${Date.now()}`,
        sender: "ai",
        text: `⚠️ **Notice:** ${err.message || "Failed to reach AI endpoint"}. Configure \`GEMINI_API_KEY\` in your \`.env.local\` to enable live generation.`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        sender: "ai",
        text: "Conversation cleared. How can I assist you with Iwaju Marketing today?",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
  };

  const suggestions = [
    "Explain how the lead scraper works",
    "How do I use the Pipeline Kanban?",
    "Write a cold email for a real estate MD",
    "How do I add my Gemini API key?",
  ];

  return (
    <>
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2.5 px-4 py-3 rounded-full bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-600 text-slate-950 font-bold text-sm shadow-xl shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:scale-105 active:scale-95 transition-all duration-200 group border border-emerald-400/30"
          aria-label="Open Iwaju AI Assistant"
        >
          <div className="relative">
            <Sparkles className="w-5 h-5 text-slate-950 group-hover:rotate-45 transition-transform" />
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-white animate-ping" />
          </div>
          <span className="tracking-wide">Ask AI</span>
          <span className="hidden sm:inline-block text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-950/20 text-slate-950 border border-slate-950/20">
            Gemini
          </span>
        </button>
      )}

      {isOpen && (
        <div
          className={`fixed bottom-6 right-6 z-50 w-[92vw] sm:w-[420px] bg-slate-950/95 border border-slate-800 rounded-2xl shadow-2xl backdrop-blur-2xl flex flex-col transition-all duration-200 overflow-hidden ${
            isMinimized ? "h-14" : "h-[540px] max-h-[82vh]"
          }`}
        >
          <div className="px-4 py-3 border-b border-slate-800/80 bg-slate-900/80 flex items-center justify-between select-none">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-emerald-400 to-indigo-500 flex items-center justify-center shadow-sm">
                <Sparkles className="w-4 h-4 text-slate-950" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-xs font-bold text-white tracking-tight">Iwaju AI Copilot</h3>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                </div>
                <p className="text-[10px] text-slate-400">Powered by Gemini 2.5</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {!isMinimized && (
                <button
                  onClick={clearChat}
                  title="Clear chat history"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                title={isMinimized ? "Expand" : "Minimize"}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              >
                {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                title="Close chat"
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {!isMinimized && (
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex gap-2.5 ${
                      m.sender === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    {m.sender === "ai" && (
                      <div className="w-6 h-6 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0 mt-0.5">
                        <Bot className="w-3.5 h-3.5" />
                      </div>
                    )}
                    <div
                      className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 leading-relaxed ${
                        m.sender === "user"
                          ? "bg-emerald-600 text-white rounded-br-none shadow-sm"
                          : "bg-slate-900 border border-slate-800 text-slate-200 rounded-bl-none"
                      }`}
                    >
                      <div className="whitespace-pre-wrap font-sans">{m.text}</div>
                      <div
                        className={`text-[9px] mt-1 flex items-center justify-between gap-2 ${
                          m.sender === "user" ? "text-emerald-200" : "text-slate-400"
                        }`}
                      >
                        <span>{m.timestamp}</span>
                        {m.provider && <span className="font-mono">{m.provider}</span>}
                      </div>
                    </div>
                    {m.sender === "user" && (
                      <div className="w-6 h-6 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center justify-center shrink-0 mt-0.5">
                        <User className="w-3.5 h-3.5" />
                      </div>
                    )}
                  </div>
                ))}

                {loading && (
                  <div className="flex gap-2.5 items-center text-slate-400">
                    <div className="w-6 h-6 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
                      <Bot className="w-3.5 h-3.5" />
                    </div>
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl px-3.5 py-2 text-xs flex items-center gap-1.5 text-slate-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce" />
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce [animation-delay:0.2s]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce [animation-delay:0.4s]" />
                      <span className="ml-1 text-[11px]">Thinking with Gemini...</span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {messages.length <= 2 && (
                <div className="px-3 pb-2 flex gap-1.5 overflow-x-auto no-scrollbar">
                  {suggestions.map((s, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(s)}
                      className="shrink-0 text-[10px] px-2.5 py-1 rounded-full bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}

              <div className="p-3 border-t border-slate-800/80 bg-slate-900/60">
                <div className="relative flex items-center">
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder="Ask about this site, prospecting, copy..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-3 pr-10 py-2.5 text-xs text-slate-100 placeholder-slate-400 focus:outline-none focus:border-emerald-500/70"
                    disabled={loading}
                  />
                  <button
                    onClick={() => handleSendMessage()}
                    disabled={!input.trim() || loading}
                    className="absolute right-1.5 p-1.5 rounded-lg bg-emerald-500 text-slate-950 hover:bg-emerald-400 disabled:opacity-40 disabled:pointer-events-none transition-colors"
                    aria-label="Send message"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-400 px-1">
                  <span>Press Enter to send</span>
                  <span>Direct Gemini API hook</span>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
