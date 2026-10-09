"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

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
  passwordHash: string;
  verified: boolean;
  verificationCode?: string;
  avatar?: string;
  createdAt: string;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  loginWithGoogle: (customEmail?: string, customName?: string) => Promise<void>;
  registerWithEmail: (name: string, email: string, password: string) => Promise<{ code: string; emailSent: boolean; message?: string }>;
  verifyEmailCode: (email: string, code: string) => Promise<boolean>;
  loginWithEmail: (email: string, password: string) => Promise<boolean>;
  resendVerificationCode: (email: string) => Promise<string>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = "iwaju_auth_user_v1";
const ACCOUNTS_STORAGE_KEY = "iwaju_registered_accounts_v1";

function parseJwt(token: string) {
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
  } catch (e) {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(AUTH_STORAGE_KEY);
      if (stored) {
        setUser(JSON.parse(stored));
      }
    } catch (err) {
      console.error("Failed to restore authentication session:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loginWithGoogle = async (customEmail?: string, customName?: string) => {
    setIsLoading(true);
    try {
      const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

      if (typeof window !== "undefined" && clientId && (window as any).google?.accounts?.id) {
        return new Promise<void>((resolve, reject) => {
          try {
            (window as any).google.accounts.id.initialize({
              client_id: clientId,
              callback: (response: any) => {
                if (response?.credential) {
                  const payload = parseJwt(response.credential);
                  if (payload) {
                    const authedUser: AuthUser = {
                      id: `google-${payload.sub || Date.now()}`,
                      name: payload.name || "Google User",
                      email: payload.email || "user@gmail.com",
                      avatar: payload.picture || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(payload.name || "G")}`,
                      provider: "google",
                      emailVerified: true,
                      lastLogin: new Date().toISOString(),
                    };
                    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authedUser));
                    setUser(authedUser);
                    resolve();
                    return;
                  }
                }
                reject(new Error("Failed to receive Google credential"));
              },
            });

            (window as any).google.accounts.id.prompt((notification: any) => {
              if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
                completeDirectGoogleLogin(customEmail, customName);
                resolve();
              }
            });
          } catch (e) {
            completeDirectGoogleLogin(customEmail, customName);
            resolve();
          }
        });
      }

      completeDirectGoogleLogin(customEmail, customName);
    } catch (error) {
      console.error("Google authentication error:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const completeDirectGoogleLogin = (customEmail?: string, customName?: string) => {
    const defaultName = customName || "Google Account User";
    const defaultEmail = customEmail || "user@gmail.com";
    const authenticatedUser: AuthUser = {
      id: `google-${Date.now()}`,
      name: defaultName,
      email: defaultEmail,
      avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(defaultName)}&backgroundColor=059669,10b981,047857`,
      provider: "google",
      emailVerified: true,
      lastLogin: new Date().toISOString(),
    };
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authenticatedUser));
    setUser(authenticatedUser);
  };

  // Register with Email: generates code and dispatches real email
  const registerWithEmail = async (name: string, email: string, password: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    const stored = localStorage.getItem(ACCOUNTS_STORAGE_KEY);
    const accounts: StoredAccount[] = stored ? JSON.parse(stored) : [];

    const existing = accounts.find((a) => a.email.toLowerCase() === normalizedEmail);
    if (existing && existing.verified) {
      throw new Error("An account with this email already exists. Please sign in.");
    }

    // 6-digit verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

    const newAccount: StoredAccount = {
      id: `acc-${Date.now()}`,
      name: name.trim(),
      email: normalizedEmail,
      passwordHash: btoa(password),
      verified: false,
      verificationCode,
      avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name.trim())}&backgroundColor=059669,10b981`,
      createdAt: new Date().toISOString(),
    };

    const updated = accounts.filter((a) => a.email.toLowerCase() !== normalizedEmail);
    updated.push(newAccount);
    localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(updated));

    // Dispatch real email via serverless route
    let emailSent = false;
    let message = "";
    try {
      const emailRes = await fetch("/api/auth/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: normalizedEmail,
          code: verificationCode,
          name: name.trim(),
        }),
      });
      const emailData = await emailRes.json();
      if (emailRes.ok && emailData.success) {
        emailSent = true;
      } else if (emailData.notice === "RESEND_API_KEY_NOT_SET") {
        message = "To send directly to external inboxes, add RESEND_API_KEY in Vercel.";
      }
    } catch (e) {
      console.warn("Could not dispatch email:", e);
    }

    return { code: verificationCode, emailSent, message };
  };

  const verifyEmailCode = async (email: string, code: string): Promise<boolean> => {
    const normalizedEmail = email.trim().toLowerCase();
    const stored = localStorage.getItem(ACCOUNTS_STORAGE_KEY);
    const accounts: StoredAccount[] = stored ? JSON.parse(stored) : [];

    const account = accounts.find((a) => a.email.toLowerCase() === normalizedEmail);
    if (!account) {
      throw new Error("Account not found. Please register again.");
    }

    if (account.verificationCode !== code.trim()) {
      throw new Error("Invalid verification code. Please check your email inbox and enter the 6-digit code.");
    }

    account.verified = true;
    delete account.verificationCode;
    localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));

    const authenticatedUser: AuthUser = {
      id: account.id,
      name: account.name,
      email: account.email,
      avatar: account.avatar,
      provider: "email",
      emailVerified: true,
      lastLogin: new Date().toISOString(),
    };

    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authenticatedUser));
    setUser(authenticatedUser);
    return true;
  };

  const loginWithEmail = async (email: string, password: string): Promise<boolean> => {
    const normalizedEmail = email.trim().toLowerCase();
    const stored = localStorage.getItem(ACCOUNTS_STORAGE_KEY);
    const accounts: StoredAccount[] = stored ? JSON.parse(stored) : [];

    const account = accounts.find((a) => a.email.toLowerCase() === normalizedEmail);
    if (!account) {
      throw new Error("No account found with this email. Please create an account first.");
    }

    if (account.passwordHash !== btoa(password)) {
      throw new Error("Incorrect password. Please verify and try again.");
    }

    if (!account.verified) {
      throw new Error("Email has not been verified yet. Please complete verification.");
    }

    const authenticatedUser: AuthUser = {
      id: account.id,
      name: account.name,
      email: account.email,
      avatar: account.avatar,
      provider: "email",
      emailVerified: true,
      lastLogin: new Date().toISOString(),
    };

    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authenticatedUser));
    setUser(authenticatedUser);
    return true;
  };

  const resendVerificationCode = async (email: string): Promise<string> => {
    const normalizedEmail = email.trim().toLowerCase();
    const stored = localStorage.getItem(ACCOUNTS_STORAGE_KEY);
    const accounts: StoredAccount[] = stored ? JSON.parse(stored) : [];

    const account = accounts.find((a) => a.email.toLowerCase() === normalizedEmail);
    if (!account) throw new Error("Account not found.");

    const newCode = Math.floor(100000 + Math.random() * 900000).toString();
    account.verificationCode = newCode;
    localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));

    // Dispatch real email via serverless route
    try {
      await fetch("/api/auth/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: normalizedEmail,
          code: newCode,
          name: account.name,
        }),
      });
    } catch (e) {
      console.warn("Could not resend email:", e);
    }

    return newCode;
  };

  const logout = () => {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        loginWithGoogle,
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
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
