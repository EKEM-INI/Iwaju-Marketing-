"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  provider: "google";
  lastLogin: string;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  loginWithGoogle: (customEmail?: string, customName?: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = "iwaju_auth_user_v1";

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
      const defaultName = customName || "Google Workspace Member";
      const defaultEmail = customEmail || "user@google.com";

      const authenticatedUser: AuthUser = {
        id: `google-${Date.now()}`,
        name: defaultName,
        email: defaultEmail,
        avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(defaultName)}&backgroundColor=059669,10b981,047857`,
        provider: "google",
        lastLogin: new Date().toISOString(),
      };

      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authenticatedUser));
      setUser(authenticatedUser);
    } catch (error) {
      console.error("Google authentication error:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, loginWithGoogle, logout }}>
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
