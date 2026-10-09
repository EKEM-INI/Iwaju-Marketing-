"use client";

import React, { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { ToastProvider } from "@/components/ui/Toast";
import { AuthProvider } from "@/components/auth/AuthContext";
import { LoginGate } from "@/components/auth/LoginGate";
import { FloatingAskAI } from "@/components/ai/FloatingAskAI";
import { X } from "lucide-react";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <AuthProvider>
      <LoginGate>
        <ToastProvider>
          <div className="relative isolate flex h-screen flex-col overflow-hidden bg-background font-sans text-foreground antialiased">
            {/* Slim top header */}
            <Header onMobileMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)} />

            <div className="flex min-h-0 flex-1">
              {/* Desktop icon rail */}
              <Sidebar variant="rail" className="hidden md:flex" />

              {/* Mobile navigation drawer */}
              {mobileMenuOpen && (
                <div className="fixed inset-0 z-50 flex md:hidden">
                  <div
                    className="fixed inset-0 bg-black/60 transition-opacity"
                    onClick={() => setMobileMenuOpen(false)}
                  />
                  <div className="relative z-10 flex w-64 max-w-[85vw] flex-col border-r border-border bg-background shadow-lg">
                    <div className="flex h-12 items-center justify-between border-b border-border px-4">
                      <span className="text-sm font-medium">Navigation</span>
                      <button
                        onClick={() => setMobileMenuOpen(false)}
                        className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        aria-label="Close menu"
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                    <Sidebar variant="full" onNavigate={() => setMobileMenuOpen(false)} />
                  </div>
                </div>
              )}

              {/* Main content */}
              <main className="flex min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden px-4 pb-4 pt-4 md:px-6 md:pb-6 md:pt-6">
                <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6">
                  {children}
                </div>
              </main>
            </div>

            <FloatingAskAI />
          </div>
        </ToastProvider>
      </LoginGate>
    </AuthProvider>
  );
}
