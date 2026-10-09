# Iwaju Marketing — B2B Lead Generation & Autonomous Agentic CRM

Production-ready executive CRM and **agentic-first sales intelligence engine** inspired by Comp AI architecture. Built with **Next.js (App Router)**, **React**, **Tailwind CSS**, and **Lucide React**.

Deployed and optimized for 100% compatibility with **Vercel**.

---

## ⚡ Core Modules & Architecture

### 1. Autonomous AI Mode (`/autonomous`) — *Comp AI Architecture*
- **"The agent is not a feature of the CRM; the CRM is where the agent keeps its notes."**
- **One-Sentence Agent Composer**: Plain-English agent dispatcher that compiles tools and enqueues background tasks.
- **4-Worker Autonomous Fleet**:
  - `scout.ts`: Corporate DNS & MX crawler with zero bounce risk.
  - `enricher.ts`: Signature block & LinkedIn identity extractor.
  - `evidence.ts`: Strict evidence validator (no confidence scores; observed facts only).
  - `dispatch.ts`: Self-managed follow-up scheduler on `dueAt` intervals.
- **Strict Evidence Ledger**: Verifiable factual observations write to database; weak evidence holds for human review.
- **Live Terminal Task Stream**: Real-time ticker showing active lease loops and tool invocations.

### 2. Executive Command Center (`/`)
- Live KPI cards: Total Leads, Active Outreach In-Flight, Discovery Meetings Booked, Conversion Rate, and Closed Revenue.
- Funnel Velocity visual progress bar showing stage breakdown (New -> Contacted -> Meeting -> Closed).
- Dual Mode Switcher between **Executive CRM** and **Autonomous AI Mode**.

### 3. Lead Prospecting Radar (`/prospecting`)
- High-speed lead discovery simulator with customizable Target Niche and Geography.
- DeepCrawler animated terminal with DNS lookup, domain crawling, SMTP MX ping verification, and decision-maker extraction.
- Lead qualification scoring (0–100) with Tier A+ Elite badges.

### 4. Pipeline CRM Kanban Board (`/pipeline`)
- 4-column visual board: **New Lead** | **Contacted** | **Meeting Booked** | **Closed Won**.
- Live column-level financial summation (in ₦ or $).
- Quick stage transition controls (`<` and `>`).

### 5. Cold Outreach Copy Engine (`/outreach`)
- High-converting B2B cold email frameworks with dynamic token interpolation.
- 1-click clipboard copy for subject line and email body with toast notifications.

---

## 🛠 Tech Stack

- **Framework**: Next.js 14 (App Router)
- **UI Library**: React 18, Tailwind CSS (Comp AI minimalist pitch-black palette)
- **Icons**: Lucide React
- **Agent Intelligence**: Google Gemini 3.8 Flash & Comp AI Eve Task Dispatcher

---

## 🚀 Getting Started Locally

```bash
# Clone the repository
git clone https://github.com/EKEM-INI/Iwaju-Marketing-.git
cd Iwaju-Marketing-

# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.
