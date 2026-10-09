"use client";

import React, { useState } from "react";
import { useAuth } from "./AuthContext";
import { Zap, ShieldCheck, Lock, CheckCircle2 } from "lucide-react";

export function LoginGate({ children }: { children: React.ReactNode }) {
  const { user, isLoading, loginWithGoogle } = useAuth();
  const [signingIn, setSigningIn] = useState(false);
  const [customEmail, setCustomEmail] = useState("");
  const [customName, setCustomName] = useState("");
  const [showAccountChooser, setShowAccountChooser] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#080c14] flex flex-col items-center justify-center text-slate-100">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-glow animate-pulse">
            <Zap className="w-6 h-6 text-slate-950 fill-current" />
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>Verifying session security...</span>
          </div>
        </div>
      </div>
    );
  }

  if (user) {
    return <>{children}</>;
  }

  const handleGoogleSignIn = async () => {
    setSigningIn(true);
    try {
      await loginWithGoogle(
        customEmail.trim() || undefined,
        customName.trim() || undefined
      );
    } catch (err) {
      console.error(err);
    } finally {
      setSigningIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#080c14] text-slate-100 flex flex-col font-sans selection:bg-emerald-500/30 selection:text-emerald-200 relative overflow-hidden">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-emerald-600/15 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -right-40 w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 left-1/3 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl" />
      </div>

      <header className="relative z-10 px-6 py-5 flex items-center justify-between border-b border-slate-800/80 bg-slate-950/60 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-glow">
            <Zap className="w-5 h-5 text-slate-950 fill-current" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-lg tracking-tight text-white">Iwaju</span>
              <span className="text-xs uppercase font-extrabold tracking-widest text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                OS
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">B2B Lead & Pipeline Engine</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            Google SSO Required
          </span>
        </div>
      </header>

      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md bg-slate-900/80 border border-slate-800 rounded-2xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Lock className="w-3 h-3 text-emerald-400" />
              Restricted Outbound Console
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Sign In with Google
            </h1>
            <p className="text-xs sm:text-sm text-slate-400">
              Access live B2B lead scraping, Kanban CRM pipelines, and the AI outreach generator.
            </p>
          </div>

          <div className="space-y-4 pt-2">
            <button
              onClick={handleGoogleSignIn}
              disabled={signingIn}
              className="w-full flex items-center justify-center gap-3 py-3.5 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-bold text-sm transition-all duration-200 shadow-lg hover:shadow-xl active:scale-98 disabled:opacity-75 disabled:pointer-events-none group"
            >
              {signingIn ? (
                <div className="w-5 h-5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
              )}
              <span>{signingIn ? "Connecting to Google..." : "Continue with Google"}</span>
            </button>

            <div className="pt-1 text-center">
              <button
                type="button"
                onClick={() => setShowAccountChooser(!showAccountChooser)}
                className="text-[11px] text-slate-400 hover:text-slate-200 underline underline-offset-2 transition-colors"
              >
                {showAccountChooser ? "Hide profile fields" : "Customize test Google account credentials"}
              </button>
            </div>

            {showAccountChooser && (
              <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2 text-xs">
                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-bold">Google Name</label>
                  <input
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="e.g. Cyril Charles"
                    className="w-full mt-1 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-bold">Google Email</label>
                  <input
                    type="email"
                    value={customEmail}
                    onChange={(e) => setCustomEmail(e.target.value)}
                    placeholder="e.g. cyrilcharles2020@gmail.com"
                    className="w-full mt-1 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-800/80 space-y-2 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Verified Google identity session token</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Full access to Apollo & Google Maps lead radars</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Floating "Ask AI" Assistant with Gemini 2.5 included</span>
            </div>
          </div>
        </div>
      </main>

      <footer className="relative z-10 px-6 py-4 text-center text-xs text-slate-500 border-t border-slate-900">
        Iwaju Marketing OS © {new Date().getFullYear()} • Powered by Gemini AI & Next.js
      </footer>
    </div>
  );
}
