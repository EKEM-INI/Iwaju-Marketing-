import { Lead, PipelineStage, ScrapingLog } from "@/types";
import { sampleLeadsFor } from "@/lib/lead-pool";

/**
 * The prospecting screen shows a crawl running. Nothing here verifies anything:
 * the records produced are the bundled sample pool, so the wording must not
 * claim MX checks, handshake tests or deliverability percentages that never ran.
 */
export function generateScrapingLogs(niche: string, location: string): ScrapingLog[] {
  const cleanNiche = niche.trim() || "B2B";
  const cleanLoc = location.trim() || "Lagos";

  return [
    {
      id: "log-1",
      timestamp: new Date().toLocaleTimeString(),
      text: `Matching the bundled sample pool against [${cleanNiche}] in [${cleanLoc}]...`,
      status: "info",
    },
    {
      id: "log-2",
      timestamp: new Date().toLocaleTimeString(),
      text: `No live source key detected on this request — results are demo records, not freshly sourced.`,
      status: "warning",
    },
    {
      id: "log-3",
      timestamp: new Date().toLocaleTimeString(),
      text: `Ranking demo accounts by niche and region overlap...`,
      status: "info",
    },
    {
      id: "log-4",
      timestamp: new Date().toLocaleTimeString(),
      text: `Nothing here has been deliverability-checked. Verify before any message goes out.`,
      status: "warning",
    },
    {
      id: "log-5",
      timestamp: new Date().toLocaleTimeString(),
      text: `Sample accounts ready. They are saved into the same pipeline store the rest of the app reads.`,
      status: "success",
    },
  ];
}

/**
 * Deterministic on purpose. The same query returns the same records with the
 * same ids, so prospecting, the pipeline board, outreach and campaigns all end
 * up pointing at one copy of a company rather than three look-alikes.
 */
export function generateMockLeads(
  niche: string,
  location: string,
  count: number = 6,
  stage: PipelineStage = "new"
): Lead[] {
  return sampleLeadsFor(niche, location, count, stage);
}
