import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/layout/AppShell";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Iwaju Marketing | B2B Lead Generation & Autonomous Agentic CRM",
  description:
    "Executive-grade B2B outbound engine: Deep lead prospecting, visual pipeline Kanban, and Comp AI autonomous agent fleet.",
  keywords: [
    "B2B Lead Generation",
    "Sales Pipeline CRM",
    "Autonomous Sales Agent",
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
      <body className={`${inter.className} bg-black text-zinc-100 min-h-screen antialiased selection:bg-zinc-800 selection:text-white`}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
