"use client";

import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { AUTH_USER_KEY, REGISTERED_ACCOUNTS_KEY, setAccountScope } from "@/lib/account-scope";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  provider: "google" | "email";
  emailVerified: boolean;
  lastLogin: string;
}

export interface StoredAccount {
  id: string;
  name: string;
  email: string;
  /** WebCrypto SHA-256 over `salt:password`. Legacy rows carried a base64 value instead. */
  hash?: string;
  salt?: string;
  passwordHash?: string;
  verified: boolean;
  verificationCode?: string;
  avatar?: string;
  createdAt: string;
}

interface RegisterResult {
  code: string;
  emailSent: boolean;
  error?: string;
  isRestricted?: boolean;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  googleConfigured: boolean;
  googleClientId: string | null;
  renderGoogleButton: (el: HTMLElement | null) => void;
  registerWithEmail: (name: string, email: string, password: string) => Promise<RegisterResult>;
  verifyEmailCode: (email: string, code: string) => Promise<boolean>;
  loginWithEmail: (email: string, password: string) => Promise<boolean>;
  resendVerificationCode: (email: string) => Promise<RegisterResult>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const NOT_CONFIGURED_MESSAGE =
  "Google sign-in is not available yet: NEXT_PUBLIC_GOOGLE_CLIENT_ID is not set in this build. Add it in Vercel Project Settings -> Environment Variables (it is inlined at build time, so redeploy after adding it), or continue with email and password below.";

function readAccounts(): StoredAccount[] {
  try {
    const raw = localStorage.getItem(REGISTERED_ACCOUNTS_KEY);
    return raw ? (JSON.parse(raw) as StoredAccount[]) : [];
  } catch {
    return [];
  }
}

function writeAccounts(accounts: StoredAccount[]): void {
  localStorage.setItem(REGISTERED_ACCOUNTS_KEY, JSON.stringify(accounts));
}

function startSession(account: Omit<AuthUser, "lastLogin">): AuthUser {
  const user: AuthUser = { ...account, lastLogin: new Date().toISOString() };
  // Scope first: the moment this state lands, pages mount and read storage.
  setAccountScope(user.id);
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  return user;
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function randomSalt(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return toHex(bytes);
}

async function hashPassword(password: string, salt: string): Promise<string> {
  if (!crypto?.subtle) throw new Error("This browser cannot hash passwords (no WebCrypto), so password sign-up is unavailable here.");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${salt}:${password}`));
  return toHex(new Uint8Array(digest));
}

function parseJwt(token: string): any | null {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

const GSI_SRC = "https://accounts.google.com/gsi/client";

function loadGsi(clientId: string): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error(NOT_CONFIGURED_MESSAGE));
  if ((window as any).google?.accounts?.id) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${GSI_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Google's sign-in script could not load.")));
      return;
    }
    const script = document.createElement("script");
    script.src = GSI_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Google's sign-in script could not load. Check your network or a blocking extension."));
    document.head.appendChild(script);
  });
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() || null;
  const googleConfigured = Boolean(clientId);
  const gsiReady = useRef(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(AUTH_USER_KEY);
      if (stored) {
        const restored = JSON.parse(stored) as AuthUser;
        setAccountScope(restored.id);
        setUser(restored);
      } else {
        setAccountScope(null);
      }
    } catch (err) {
      console.error("Failed to restore authentication session:", err);
      setAccountScope(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Renders Google's own button. The identity only ever comes from the credential Google
   * hands back - there is no local stand-in, because a made-up session would claim a
   * sign-in that never happened and would let one browser pretend to be another person.
   */
  const renderGoogleButton = (el: HTMLElement | null) => {
    if (!el || !clientId) return;
    const google = (window as any).google?.accounts?.id;
    if (!google) {
      loadGsi(clientId)
        .then(() => renderGoogleButton(el))
        .catch((err) => {
          el.textContent = err?.message || "Google sign-in could not start.";
        });
      return;
    }
    if (!gsiReady.current) {
      google.initialize({
        client_id: clientId,
        auto_select: false,
        callback: (response: any) => {
          const payload = response?.credential ? parseJwt(response.credential) : null;
          if (!payload?.sub) {
            el.textContent = "Google did not return a credential, so no session was started.";
            return;
          }
          setUser(
            startSession({
              id: `google-${payload.sub}`,
              name: payload.name || "Google account",
              email: payload.email || "",
              avatar: payload.picture || undefined,
              provider: "google",
              emailVerified: payload.email_verified === true,
            })
          );
        },
      });
      gsiReady.current = true;
    }
    el.replaceChildren();
    google.renderButton(el, { theme: "outline", size: "large", text: "signin_with", width: 300 });
  };

  const registerWithEmail = async (name: string, email: string, password: string): Promise<RegisterResult> => {
    const normalizedEmail = email.trim().toLowerCase();
    const accounts = readAccounts();

    const existing = accounts.find((a) => a.email.toLowerCase() === normalizedEmail);
    if (existing && existing.verified) {
      throw new Error("An account with this email already exists. Please sign in.");
    }

    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const salt = randomSalt();

    const newAccount: StoredAccount = {
      id: `acc-${Date.now()}`,
      name: name.trim(),
      email: normalizedEmail,
      salt,
      hash: await hashPassword(password, salt),
      verified: false,
      verificationCode,
      avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name.trim())}&backgroundColor=059669,10b981`,
      createdAt: new Date().toISOString(),
    };

    writeAccounts([...accounts.filter((a) => a.email.toLowerCase() !== normalizedEmail), newAccount]);

    let emailSent = false;
    let emailError: string | undefined;
    let isRestricted = false;

    try {
      const res = await fetch("/api/auth/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail, code: verificationCode, name: name.trim() }),
      });
      const data = await res.json();
      if (data.success) emailSent = true;
      else {
        emailError = data.error;
        isRestricted = Boolean(data.isRestrictedAccount);
      }
    } catch (err: any) {
      emailError = err.message || "Failed to contact email dispatch API.";
    }

    return { code: verificationCode, emailSent, error: emailError, isRestricted };
  };

  const verifyEmailCode = async (email: string, code: string): Promise<boolean> => {
    const normalizedEmail = email.trim().toLowerCase();
    const accounts = readAccounts();
    const account = accounts.find((a) => a.email.toLowerCase() === normalizedEmail);
    if (!account) throw new Error("Account not found. Please register again.");
    if (account.verificationCode !== code.trim()) {
      throw new Error("Invalid verification code. Please check your email inbox and enter the 6-digit code.");
    }

    account.verified = true;
    delete account.verificationCode;
    writeAccounts(accounts);

    setUser(
      startSession({
        id: account.id,
        name: account.name,
        email: account.email,
        avatar: account.avatar,
        provider: "email",
        emailVerified: true,
      })
    );
    return true;
  };

  const loginWithEmail = async (email: string, password: string): Promise<boolean> => {
    const normalizedEmail = email.trim().toLowerCase();
    const accounts = readAccounts();
    const account = accounts.find((a) => a.email.toLowerCase() === normalizedEmail);
    if (!account) throw new Error("No account found with this email. Please create an account first.");

    if (account.hash && account.salt) {
      if ((await hashPassword(password, account.salt)) !== account.hash) {
        throw new Error("Incorrect password. Please verify and try again.");
      }
    } else if (account.passwordHash === btoa(password)) {
      // Rows written before hashing existed were reversible base64. Upgrade on the
      // one request where the plaintext is legitimately available.
      account.salt = randomSalt();
      account.hash = await hashPassword(password, account.salt);
      delete account.passwordHash;
      writeAccounts(accounts);
    } else {
      throw new Error("Incorrect password. Please verify and try again.");
    }

    if (!account.verified) throw new Error("Email has not been verified yet. Please complete verification.");

    setUser(
      startSession({
        id: account.id,
        name: account.name,
        email: account.email,
        avatar: account.avatar,
        provider: "email",
        emailVerified: true,
      })
    );
    return true;
  };

  const resendVerificationCode = async (email: string): Promise<RegisterResult> => {
    const normalizedEmail = email.trim().toLowerCase();
    const accounts = readAccounts();
    const account = accounts.find((a) => a.email.toLowerCase() === normalizedEmail);
    if (!account) throw new Error("Account not found.");

    const newCode = Math.floor(100000 + Math.random() * 900000).toString();
    account.verificationCode = newCode;
    writeAccounts(accounts);

    let emailSent = false;
    let emailError: string | undefined;
    let isRestricted = false;

    try {
      const res = await fetch("/api/auth/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail, code: newCode, name: account.name }),
      });
      const data = await res.json();
      if (data.success) emailSent = true;
      else {
        emailError = data.error;
        isRestricted = Boolean(data.isRestrictedAccount);
      }
    } catch (err: any) {
      emailError = err.message;
    }

    return { code: newCode, emailSent, error: emailError, isRestricted };
  };

  const logout = () => {
    localStorage.removeItem(AUTH_USER_KEY);
    setAccountScope(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        googleConfigured,
        googleClientId: clientId,
        renderGoogleButton,
        registerWithEmail,
        verifyEmailCode,
        loginWithEmail,
        resendVerificationCode,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
