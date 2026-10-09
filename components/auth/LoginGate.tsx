"use client";

import React, { useState } from "react";
import { useAuth } from "./AuthContext";
import {
  Zap,
  Mail,
  Lock,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  Eye,
  EyeOff,
  RefreshCw,
} from "lucide-react";

export function LoginGate({ children }: { children: React.ReactNode }) {
  const { user, loginWithGoogle, registerWithEmail, verifyEmailCode, resendVerificationCode, isLoading } = useAuth();
  
  const [authMethod, setAuthMethod] = useState<"google" | "email">("google");
  const [emailMode, setEmailMode] = useState<"register" | "verify">("register");

  // Form states
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [deliveryIssue, setDeliveryIssue] = useState<{ isRestricted?: boolean; error?: string; code?: string } | null>(null);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-zinc-100">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center shadow-2xl">
            <Zap className="w-5 h-5 text-white fill-current animate-pulse" />
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-500 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-ping" />
            <span>Verifying session security...</span>
          </div>
        </div>
      </div>
    );
  }

  if (user) {
    return <>{children}</>;
  }

  const handleGoogleLogin = async () => {
    setSubmitting(true);
    setErrorMsg("");
    try {
      await loginWithGoogle();
    } catch {
      setErrorMsg("Failed to sign in with Google account.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEmailRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setDeliveryIssue(null);

    if (password !== confirmPassword) {
      setErrorMsg("Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      setErrorMsg("Password must be at least 6 characters.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await registerWithEmail(email, password, name);
      if (res.success) {
        setEmailMode("verify");
      } else {
        setErrorMsg(res.error || "Failed to dispatch verification code.");
        if (res.details) {
          setDeliveryIssue({
            isRestricted: res.details.isRestricted,
            error: res.error,
            code: res.details.code,
          });
          setEmailMode("verify");
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error creating account";
      setErrorMsg(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSubmitting(true);
    try {
      const res = await verifyEmailCode(email, verificationCode);
      if (!res.success) {
        setErrorMsg(res.error || "Invalid verification code.");
      }
    } catch {
      setErrorMsg("Verification failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    setErrorMsg("");
    setDeliveryIssue(null);
    setSubmitting(true);
    try {
      const res = await resendVerificationCode(email);
      if (res.details?.isRestricted) {
        setDeliveryIssue({
          isRestricted: true,
          error: res.error,
          code: res.details.code,
        });
      }
    } catch {
      setErrorMsg("Failed to resend code.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-zinc-100 flex flex-col font-sans selection:bg-zinc-800 selection:text-white">
      {/* Top Bar */}
      <header className="px-6 py-4 flex items-center justify-between border-b border-zinc-900 bg-black">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center">
            <Zap className="w-3.5 h-3.5 text-white fill-current" />
          </div>
          <div>
            <span className="font-semibold text-sm tracking-tight text-white">Iwaju Agentic CRM</span>
            <span className="text-[10px] text-zinc-500 font-mono ml-2">v2.4-dark</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-zinc-950 text-zinc-400 border border-zinc-800 flex items-center gap-1.5">
            <ShieldCheck className="w-3 h-3 text-zinc-400" />
            <span>End-to-End Encrypted</span>
          </span>
        </div>
      </header>

      {/* Main Login Card */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-zinc-950 border border-zinc-800 rounded-xl p-6 sm:p-7 space-y-5 shadow-2xl">
          <div className="space-y-1">
            <h1 className="text-lg font-semibold text-white tracking-tight">Sign in to console</h1>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Access your autonomous sales agents, pipeline intelligence, and verified evidence ledgers.
            </p>
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-950/30 border border-red-900/50 rounded-lg flex items-start gap-2 text-xs text-red-300">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Method Switcher Tabs */}
          <div className="grid grid-cols-2 p-0.5 bg-zinc-900 rounded-lg border border-zinc-800 text-xs font-medium">
            <button
              type="button"
              onClick={() => { setAuthMethod("google"); setErrorMsg(""); }}
              className={`py-1.5 rounded-md transition-all ${
                authMethod === "google"
                  ? "bg-zinc-800 text-white font-semibold shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Google SSO
            </button>
            <button
              type="button"
              onClick={() => { setAuthMethod("email"); setErrorMsg(""); }}
              className={`py-1.5 rounded-md transition-all ${
                authMethod === "email"
                  ? "bg-zinc-800 text-white font-semibold shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Email &amp; Password
            </button>
          </div>

          {/* A. GOOGLE SSO */}
          {authMethod === "google" && (
            <div className="space-y-3 pt-1">
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={submitting}
                className="w-full py-2.5 px-4 rounded-lg bg-white hover:bg-zinc-200 text-black font-semibold text-xs flex items-center justify-center gap-2.5 transition-all active:scale-98 cursor-pointer disabled:opacity-50"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>{submitting ? "Signing in..." : "Continue with Google"}</span>
              </button>

              <div className="p-3 bg-zinc-900/60 border border-zinc-800/80 rounded-lg text-[11px] text-zinc-400 font-mono text-center">
                Instant one-click workspace authorization
              </div>
            </div>
          )}

          {/* B. EMAIL & PASSWORD REGISTRATION */}
          {authMethod === "email" && emailMode === "register" && (
            <form onSubmit={handleEmailRegister} className="space-y-3 pt-1">
              <div>
                <label className="text-zinc-400 font-mono text-[10px] uppercase">Full Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Alex Morgan"
                  className="w-full mt-1 px-3 py-2 bg-black border border-zinc-800 rounded-lg text-white text-xs focus:outline-none focus:border-zinc-500"
                />
              </div>

              <div>
                <label className="text-zinc-400 font-mono text-[10px] uppercase">Work Email</label>
                <div className="relative mt-1">
                  <Mail className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="alex@company.com"
                    className="w-full pl-9 pr-3 py-2 bg-black border border-zinc-800 rounded-lg text-white text-xs focus:outline-none focus:border-zinc-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-zinc-400 font-mono text-[10px] uppercase">Password</label>
                <div className="relative mt-1">
                  <Lock className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-2.5" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    className="w-full pl-9 pr-9 py-2 bg-black border border-zinc-800 rounded-lg text-white text-xs focus:outline-none focus:border-zinc-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-zinc-500 hover:text-zinc-300"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-zinc-400 font-mono text-[10px] uppercase">Confirm Password</label>
                <div className="relative mt-1">
                  <KeyRound className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-2.5" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat password"
                    className="w-full pl-9 pr-3 py-2 bg-black border border-zinc-800 rounded-lg text-white text-xs focus:outline-none focus:border-zinc-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 bg-white text-black font-semibold rounded-lg hover:bg-zinc-200 transition-all text-xs cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <span>{submitting ? "Sending verification..." : "Create Account & Send Code"}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </form>
          )}

          {/* C. EMAIL CODE VERIFICATION */}
          {authMethod === "email" && emailMode === "verify" && (
            <form onSubmit={handleVerifyCode} className="space-y-4 pt-1">
              <div className="text-center space-y-1">
                <div className="w-9 h-9 rounded-lg bg-zinc-900 border border-zinc-800 text-white flex items-center justify-center mx-auto">
                  <Mail className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-semibold text-white">Check Your Email</h3>
                <p className="text-[11px] text-zinc-400">
                  We sent a 6-digit verification code to: <br />
                  <span className="text-zinc-200 font-mono font-medium">{email}</span>
                </p>
              </div>

              {deliveryIssue && (
                <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-lg text-xs space-y-2 text-left">
                  <div className="flex items-center gap-1.5 text-amber-400 font-mono text-[11px]">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>Resend Delivery Status</span>
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    {deliveryIssue.error}
                  </p>
                  {deliveryIssue.code && (
                    <div className="pt-2 border-t border-zinc-800 flex items-center justify-between text-[11px]">
                      <span className="text-zinc-500 font-mono">Testing Code:</span>
                      <span className="font-mono font-bold text-white bg-black px-2 py-0.5 rounded border border-zinc-800">
                        {deliveryIssue.code}
                      </span>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block text-center mb-1">
                  6-Digit Verification Code
                </label>
                <input
                  type="text"
                  maxLength={6}
                  required
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/[^0-9]/g, ""))}
                  placeholder="000000"
                  className="w-full text-center text-lg tracking-widest font-mono py-2 bg-black border border-zinc-800 rounded-lg text-white focus:outline-none focus:border-zinc-500"
                />
              </div>

              <button
                type="submit"
                disabled={submitting || verificationCode.length < 6}
                className="w-full py-2.5 bg-white text-black font-semibold rounded-lg hover:bg-zinc-200 transition-all text-xs cursor-pointer disabled:opacity-50"
              >
                {submitting ? "Verifying..." : "Verify Code & Enter"}
              </button>

              <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-1">
                <button
                  type="button"
                  onClick={() => setEmailMode("register")}
                  className="hover:text-white"
                >
                  ← Edit email
                </button>
                <button
                  type="button"
                  onClick={handleResend}
                  className="text-zinc-300 hover:text-white flex items-center gap-1 font-mono"
                >
                  <RefreshCw className="w-3 h-3" /> Resend
                </button>
              </div>
            </form>
          )}

          {/* Security Features */}
          <div className="pt-3 border-t border-zinc-900 space-y-1.5 text-[11px] text-zinc-500">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3 h-3 text-zinc-400 shrink-0" />
              <span>Full dark mode CRM workspace</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3 h-3 text-zinc-400 shrink-0" />
              <span>Integrated autonomous sales agent fleet</span>
            </div>
          </div>
        </div>
      </main>

      {/* Minimal Dark Footer */}
      <footer className="px-6 py-4 text-center text-[11px] font-mono text-zinc-600 border-t border-zinc-900">
        Iwaju Marketing OS © {new Date().getFullYear()} • Agentic Sales CRM
      </footer>
    </div>
  );
}
