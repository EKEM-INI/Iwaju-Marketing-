import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/layout/AppShell";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Iwaju Marketing | B2B Lead Generation & Pipeline CRM",
  description:
    "Executive-grade B2B outbound engine: Deep lead prospecting, visual pipeline Kanban, and AI cold outreach generator.",
  keywords: [
    "B2B Lead Generation",
    "Sales Pipeline CRM",
    "Outreach Engine",
    "Cold Email Generator",
    "Iwaju Marketing",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-[#080c14] text-slate-100 min-h-screen antialiased selection:bg-emerald-500/30 selection:text-emerald-200`}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
