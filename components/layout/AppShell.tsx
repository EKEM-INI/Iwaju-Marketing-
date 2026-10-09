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
          <div className="flex h-screen bg-black text-zinc-100 overflow-hidden font-sans antialiased selection:bg-zinc-800 selection:text-white relative">
            <Sidebar className="hidden lg:flex" />

            {/* Mobile Sidebar Overlay */}
            {mobileMenuOpen && (
              <div className="fixed inset-0 z-50 lg:hidden flex">
                <div
                  className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
                  onClick={() => setMobileMenuOpen(false)}
                />
                <div className="relative flex flex-col w-72 max-w-[85vw] bg-black border-r border-zinc-800 z-10 shadow-2xl">
                  <button
                    onClick={() => setMobileMenuOpen(false)}
                    className="absolute top-4 right-4 p-2 rounded-lg text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800"
                    aria-label="Close menu"
                  >
                    <X className="w-5 h-5" />
                  </button>
                  <Sidebar onNavigate={() => setMobileMenuOpen(false)} />
                </div>
              </div>
            )}

            {/* Main Stage Content */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-black">
              <Header onMobileMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)} />
              <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 lg:p-8 bg-black">
                <div className="max-w-7xl mx-auto space-y-6">
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
