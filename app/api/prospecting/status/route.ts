import { NextRequest, NextResponse } from "next/server";
import { APOLLO_ORGANIZATIONS_URL, apolloKey } from "@/lib/apollo";

/**
 * Apollo health, read on every request.
 *
 * A plain GET route handler is static in Next, so without force-dynamic this answer is baked at
 * build time and served from the cache: the badge keeps saying "no key" after a key is added, and
 * keeps saying "connected" after one is removed.
 *
 * The health check is a real organization search with per_page=1 rather than Apollo's
 * /v1/auth/health, which was probed and answers healthy:true for a key Apollo then rejects as
 * invalid on every endpoint that matters. A green light that cannot fail is worse than no light.
 */
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const key = apolloKey() || "";
  const googleMapsKey = process.env.GOOGLE_MAPS_API_KEY?.trim() || "";

  let apolloHealthy = false;
  let apolloMessage =
    "APOLLO_API_KEY is not visible to this build, so no live sourcing can run here. Add it in Vercel environment variables and redeploy, or put it in .env.local and restart the dev server.";

  if (key) {
    // The first cold call from a fresh container can fail on connection setup. One retry, so a
    // blip cannot report "Apollo is down" on a screen whose whole job is to say whether it is up.
    let attempt = 0;
    while (attempt < 2) {
      attempt += 1;
      try {
        const res = await fetch(APOLLO_ORGANIZATIONS_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": key },
          body: JSON.stringify({
            api_key: key,
            q_organization_keyword_tags: ["real estate"],
            page: 1,
            per_page: 1,
          }),
          cache: "no-store",
        });
        const data = await res.json().catch(() => null);

        if (res.ok) {
          apolloHealthy = true;
          const matches = Array.isArray(data?.organizations) ? data.organizations.length : 0;
          apolloMessage = `Connected & Authenticated${matches ? ` (${matches} company returned for a test search)` : ""}`;
        } else if (res.status === 401 || res.status === 403) {
          apolloMessage = `Apollo refused this key (HTTP ${res.status}${
            data?.error ? `: ${String(data.error).slice(0, 160)}` : ""
          }). Copy the key again from Apollo -> Settings -> Integrations -> API Keys; an OAuth token is not the same thing.`;
        } else if (res.status === 429) {
          apolloMessage = "Apollo rate-limited or out of credits for this key (HTTP 429).";
        } else {
          apolloMessage = `Apollo answered HTTP ${res.status}${data?.error ? `: ${String(data.error).slice(0, 160)}` : ""}.`;
        }
        break;
      } catch (e: any) {
        if (attempt === 2) {
          apolloMessage = `Apollo could not be reached from this deployment: ${e?.message || "network error"}.`;
        }
      }
    }
  }

  return NextResponse.json(
    {
      apollo: {
        configured: Boolean(key),
        healthy: apolloHealthy,
        message: apolloMessage,
        maskedKey: key ? `${key.slice(0, 4)}...${key.slice(-4)}` : null,
      },
      googleMaps: {
        configured: Boolean(googleMapsKey),
        maskedKey: googleMapsKey
          ? `${googleMapsKey.slice(0, 4)}...${googleMapsKey.slice(-4)}`
          : null,
      },
      servedBy: req.headers.get("host") || "unknown host",
    },
    { headers: { "Cache-Control": "no-store, must-revalidate" } }
  );
}
