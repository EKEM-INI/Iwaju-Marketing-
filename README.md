# Iwaju Marketing — B2B Lead Generation & Pipeline CRM Dashboard

Production-ready executive dashboard for B2B outbound lead generation, pipeline Kanban management, and personalized cold outreach. Built with **Next.js (App Router)**, **React**, **Tailwind CSS**, and **Lucide React**.

Deployed and optimized for 100% compatibility with **Vercel**.

---

## ⚡ Core Modules & Architecture

1. **Executive Command Center (`/`)**
   - Live KPI cards: Total Leads, Active Outreach In-Flight, Discovery Meetings Booked, Conversion Rate, and Closed Revenue.
   - Funnel Velocity visual progress bar showing stage breakdown (New -> Contacted -> Meeting -> Closed).
   - Real-time audit activity feed logging crawler discoveries and CRM updates.

2. **Lead Prospecting Engine (`/prospecting`)**
   - High-speed lead discovery simulator with customizable Target Niche (e.g., Real Estate, Corporate Law, FinTech) and Geography (e.g., Lagos, Abuja, Uyo, London).
   - DeepCrawler animated terminal with DNS lookup, domain crawling, SMTP MX ping verification, and decision-maker extraction.
   - Lead qualification scoring (0–100) with Tier A+ Elite badges.
   - Individual and bulk "Save to Pipeline" actions.

3. **Pipeline CRM Kanban Board (`/pipeline`)**
   - 4-column visual board: **New Lead** | **Contacted** | **Meeting Booked** | **Closed Won**.
   - Live column-level financial summation (in ₦ or $).
   - Quick stage transition controls (`<` and `>`).
   - Detailed lead drawer modal for contact inspection, notes editing, and deal value management.

4. **Cold Outreach Copy Engine (`/outreach`)**
   - High-converting B2B cold email frameworks:
     - *Cold Outreach Intro (Value First)*
     - *Value Proposition & Case Study Proof*
     - *Follow-Up #1 (The Gentle Bump)*
     - *Direct Meeting Closer (High Intent)*
   - Dynamic interpolation of `{{firstName}}`, `{{companyName}}`, `{{niche}}`, `{{location}}`.
   - 1-click clipboard copy for subject line and email body with toast notifications.
   - "Send & Advance" button that automatically shifts the lead to the "Contacted" CRM stage.

---

## 🛠 Tech Stack

- **Framework**: [Next.js 14 (App Router)](https://nextjs.org/)
- **UI Library**: React 18, Tailwind CSS (Executive dark obsidian palette `#080c14` with Emerald `#10b981` accents)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Persistence**: SSR-safe `localStorage` persistence with seed hydration. Zero external database configuration required for instant deployment.

---

## 🚀 Getting Started Locally

```bash
# Clone the repository and navigate into the folder
cd "IWAJU MARKETING"

# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## ☁️ Deploying to Vercel

1. Push this repository to GitHub or GitLab.
2. In Vercel, click **"Add New Project"** and import the repository.
3. Keep default settings:
   - Framework Preset: **Next.js**
   - Root Directory: `./`
4. Click **Deploy**. Vercel will build and deploy the production bundle immediately.
