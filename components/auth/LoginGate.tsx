"use client";

import React, { useState } from "react";
import { useAuth } from "./AuthContext";
import {
  Zap,
  ShieldCheck,
  Lock,
  Mail,
  KeyRound,
  Eye,
  EyeOff,
  User,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  RefreshCw,
  Sparkles,
} from "lucide-react";

export function LoginGate({ children }: { children: React.ReactNode }) {
  const {
    user,
    isLoading,
    loginWithGoogle,
    registerWithEmail,
    verifyEmailCode,
    loginWithEmail,
    resendVerificationCode,
  } = useAuth();

  const [authMethod, setAuthMethod] = useState<"google" | "email">("google");
  const [emailMode, setEmailMode] = useState<"signin" | "register" | "verify">("signin");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [deliveryIssue, setDeliveryIssue] = useState<{
    error?: string;
    code?: string;
    isRestricted?: boolean;
  } | null>(null);

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
    setSubmitting(true);
    setErrorMsg(null);
    try {
      await loginWithGoogle();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to sign in with Google.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setDeliveryIssue(null);

    if (!name.trim()) return setErrorMsg("Please enter your full name.");
    if (!email.trim() || !email.includes("@")) return setErrorMsg("Please enter a valid work email.");
    if (password.length < 6) return setErrorMsg("Password must be at least 6 characters long.");
    if (password !== confirmPassword) return setErrorMsg("Passwords do not match.");

    setSubmitting(true);
    try {
      const res = await registerWithEmail(name, email, password);
      setEmailMode("verify");

      if (res.emailSent) {
        setSuccessMsg(`We sent a 6-digit verification code to ${email}. Please check your inbox and spam folder.`);
      } else {
        setDeliveryIssue({
          error: res.error,
          code: res.code,
          isRestricted: res.isRestricted,
        });
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to initiate registration.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!verificationCode.trim()) return setErrorMsg("Please enter the 6-digit verification code.");

    setSubmitting(true);
    try {
      await verifyEmailCode(email, verificationCode);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to verify code.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!email.trim()) return setErrorMsg("Please enter your email.");
    if (!password) return setErrorMsg("Please enter your password.");

    setSubmitting(true);
    try {
      await loginWithEmail(email, password);
    } catch (err: any) {
      setErrorMsg(err.message || "Incorrect credentials.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    setErrorMsg(null);
    setDeliveryIssue(null);
    try {
      const res = await resendVerificationCode(email);
      if (res.emailSent) {
        setSuccessMsg(`A fresh verification code has been dispatched to ${email}!`);
      } else {
        setDeliveryIssue({
          error: res.error,
          code: res.code,
          isRestricted: res.isRestricted,
        });
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to resend code.");
    }
  };

  return (
    <div className="min-h-screen bg-[#080c14] text-slate-100 flex flex-col font-sans selection:bg-emerald-500/30 selection:text-emerald-200 relative overflow-hidden">
      {/* Background Neon Blurs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-emerald-600/15 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -right-40 w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 left-1/3 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl" />
      </div>

      {/* Top Navbar */}
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
            <p className="text-[11px] text-slate-400 font-medium">B2B Outbound Revenue Engine</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            Authorized Access Only
          </span>
        </div>
      </header>

      {/* Main Authentication Card */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md bg-slate-900/85 border border-slate-800 rounded-2xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl space-y-6">
          <div className="text-center space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Lock className="w-3 h-3 text-emerald-400" />
              Executive Access Console
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Sign In to Iwaju
            </h1>
            <p className="text-xs text-slate-400">
              Choose your preferred sign in method to access pipelines and lead radars.
            </p>
          </div>

          {/* Authentication Method Selector (Tabs) */}
          <div className="grid grid-cols-2 p-1 bg-slate-950 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => {
                setAuthMethod("google");
                setErrorMsg(null);
                setDeliveryIssue(null);
              }}
              className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
                authMethod === "google"
                  ? "bg-slate-800 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <span>Google Account</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setAuthMethod("email");
                setErrorMsg(null);
                setDeliveryIssue(null);
              }}
              className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
                authMethod === "email"
                  ? "bg-slate-800 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Mail className="w-3.5 h-3.5 text-emerald-400" />
              <span>Email & Password</span>
            </button>
          </div>

          {errorMsg && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-xs flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* METHOD 1: GOOGLE LOGIN */}
          {authMethod === "google" && (
            <div className="space-y-4 pt-1">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={submitting}
                className="w-full flex items-center justify-center gap-3 py-3.5 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-bold text-sm transition-all shadow-lg hover:shadow-xl active:scale-98 disabled:opacity-75"
              >
                {submitting ? (
                  <div className="w-5 h-5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                )}
                <span>{submitting ? "Connecting to Google..." : "Continue with Google"}</span>
              </button>

              <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl space-y-1.5 text-xs text-slate-400">
                <div className="flex items-center gap-1.5 text-emerald-400 font-semibold text-[11px]">
                  <Sparkles className="w-3.5 h-3.5" />
                  Official Google Identity OAuth
                </div>
                <p className="text-[11px] leading-relaxed">
                  Authenticates directly using Google Identity Services. Verified tokens unlock full CRM pipeline and Gemini Outbound features.
                </p>
              </div>
            </div>
          )}

          {/* METHOD 2: EMAIL & PASSWORD FLOW */}
          {authMethod === "email" && (
            <div className="space-y-4">
              {emailMode !== "verify" && (
                <div className="flex items-center justify-between border-b border-slate-800 pb-2 text-xs">
                  <div className="flex gap-4">
                    <button
                      type="button"
                      onClick={() => {
                        setEmailMode("signin");
                        setErrorMsg(null);
                        setDeliveryIssue(null);
                      }}
                      className={`font-bold pb-1 transition-colors relative ${
                        emailMode === "signin"
                          ? "text-emerald-400 border-b-2 border-emerald-500"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      Sign In
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEmailMode("register");
                        setErrorMsg(null);
                        setDeliveryIssue(null);
                      }}
                      className={`font-bold pb-1 transition-colors relative ${
                        emailMode === "register"
                          ? "text-emerald-400 border-b-2 border-emerald-500"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      Create Account
                    </button>
                  </div>
                </div>
              )}

              {/* A. SIGN IN */}
              {emailMode === "signin" && (
                <form onSubmit={handleEmailSignIn} className="space-y-3.5">
                  <div>
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      Work Email
                    </label>
                    <div className="relative mt-1">
                      <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@company.com"
                        className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      Password
                    </label>
                    <div className="relative mt-1">
                      <KeyRound className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-9 pr-9 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 font-bold text-xs rounded-xl transition-all shadow-glow active:scale-98 disabled:opacity-50"
                  >
                    {submitting ? "Authenticating..." : "Sign In to Pipeline"}
                  </button>

                  <p className="text-center text-[11px] text-slate-400 pt-1">
                    Don't have an account yet?{" "}
                    <button
                      type="button"
                      onClick={() => setEmailMode("register")}
                      className="text-emerald-400 font-semibold hover:underline"
                    >
                      Create one here
                    </button>
                  </p>
                </form>
              )}

              {/* B. REGISTER FORM */}
              {emailMode === "register" && (
                <form onSubmit={handleRegister} className="space-y-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      Full Name
                    </label>
                    <div className="relative mt-1">
                      <User className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Cyril Charles"
                        className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      Business Email
                    </label>
                    <div className="relative mt-1">
                      <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@agency.com"
                        className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      Create Password
                    </label>
                    <div className="relative mt-1">
                      <KeyRound className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Min 6 characters"
                        className="w-full pl-9 pr-9 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      Confirm Password
                    </label>
                    <div className="relative mt-1">
                      <KeyRound className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Repeat password"
                        className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 font-bold text-xs rounded-xl transition-all shadow-glow active:scale-98 disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    <span>{submitting ? "Sending Verification Code..." : "Send Verification Code"}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </form>
              )}

              {/* C. EMAIL VERIFICATION CODE STEP */}
              {emailMode === "verify" && (
                <form onSubmit={handleVerifyCode} className="space-y-4 animate-in fade-in">
                  <div className="text-center space-y-1">
                    <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto">
                      <Mail className="w-5 h-5" />
                    </div>
                    <h3 className="text-sm font-bold text-white">Check Your Email</h3>
                    <p className="text-[11px] text-slate-400">
                      We have dispatched a 6-digit security code to: <br />
                      <span className="text-emerald-300 font-semibold">{email}</span>
                    </p>
                  </div>

                  {/* If email delivery had a restriction or API issue */}
                  {deliveryIssue && (
                    <div className="p-3 bg-amber-500/10 border border-amber-500/25 rounded-xl text-xs space-y-2 text-left">
                      <div className="flex items-center gap-1.5 text-amber-400 font-semibold text-[11px]">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>Email Delivery Feedback</span>
                      </div>
                      <p className="text-[11px] text-slate-300 leading-relaxed">
                        {deliveryIssue.error}
                      </p>
                      {deliveryIssue.isRestricted && (
                        <p className="text-[10px] text-amber-300/80">
                          Tip: On Resend's free tier, emails can only be sent to the email address registered with your Resend account, or add your verified domain on resend.com.
                        </p>
                      )}
                      {deliveryIssue.code && (
                        <div className="pt-2 border-t border-amber-500/20 flex items-center justify-between text-[11px]">
                          <span className="text-slate-400">Testing Code:</span>
                          <span className="font-mono font-bold text-emerald-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                            {deliveryIssue.code}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {!deliveryIssue && (
                    <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-center space-y-1">
                      <p className="text-xs text-slate-300">
                        Please open your email inbox, find your verification code, and enter it below:
                      </p>
                    </div>
                  )}

                  <div>
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block text-center mb-1">
                      Enter 6-Digit Code
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      required
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value.replace(/[^0-9]/g, ""))}
                      placeholder="e.g. 583921"
                      className="w-full text-center text-lg tracking-widest font-mono py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting || verificationCode.length < 6}
                    className="w-full py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 font-bold text-xs rounded-xl transition-all shadow-glow active:scale-98 disabled:opacity-50"
                  >
                    {submitting ? "Verifying..." : "Verify Email & Complete Sign In"}
                  </button>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                    <button
                      type="button"
                      onClick={() => setEmailMode("register")}
                      className="hover:underline text-slate-400"
                    >
                      ← Back to edit email
                    </button>
                    <button
                      type="button"
                      onClick={handleResend}
                      className="text-emerald-400 hover:underline flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" /> Resend Code
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* Checklist */}
          <div className="pt-4 border-t border-slate-800/80 space-y-2 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Choose Google SSO or Verified Email & Password</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Verification codes delivered directly to inbox</span>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 px-6 py-4 text-center text-xs text-slate-500 border-t border-slate-900">
        Iwaju Marketing OS © {new Date().getFullYear()} • Powered by Gemini AI & Next.js
      </footer>
    </div>
  );
}
