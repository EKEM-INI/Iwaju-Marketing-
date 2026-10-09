import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { AppShell } from "@/components/layout/AppShell";

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
    <html
      lang="en"
      className={`dark ${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}
    >
      <body className="font-sans bg-background text-foreground min-h-full">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
