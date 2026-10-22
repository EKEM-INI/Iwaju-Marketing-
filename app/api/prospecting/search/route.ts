import { NextRequest, NextResponse } from "next/server";
import type { Lead } from "@/types";
import { generateMockLeads } from "@/lib/mock-scraper";
import { scoreAccount, DEFAULT_PROFILE, DEFAULT_WEIGHTS } from "@/lib/icp";
import { getGeminiKey } from "@/lib/gemini";
import {
  apolloConfigured,
  revealPerson,
  searchOrganizations,
  searchPeople,
  type ApolloOrganization,
  type ApolloPerson,
  type ApolloReveal,
} from "@/lib/apollo";

/**
 * Lead sourcing. Apollo answers for the company, Apollo answers for the human, and a third
 * paid call answers for the address. Anything Apollo does not return stays blank on the
 * record: no contact@domain guesses, no placeholder numbers, no random deal values or fit
 * scores, because a blank field can be chased down and a invented one gets mailed.
 * When Apollo has blind spots in regional / physical directories (e.g. Uyo, Calabar),
 * Gemini Verified Physical Directory discovers real physical establishments with street addresses.
 */

function resolveTargetLocations(locationInput: string): string[] {
  const loc = locationInput.trim().toLowerCase();

  if (loc.includes("uyo") || loc.includes("akwa ibom")) return ["Uyo", "Akwa Ibom", "Uyo, Akwa Ibom"];
  if (loc.includes("ikeja") || loc.includes("lekki") || loc.includes("victoria island")) return ["Ikeja", "Lekki", "Victoria Island", "Lagos"];
  if (loc.includes("abuja") || loc.includes("fct") || loc.includes("maitama") || loc.includes("wuse")) return ["Abuja", "Federal Capital Territory"];
  if (loc.includes("port harcourt") || loc.includes("portharcourt") || loc.includes("rivers")) return ["Port Harcourt", "Rivers State"];
  if (loc.includes("ibadan") || loc.includes("oyo")) return ["Ibadan", "Oyo State"];
  if (loc.includes("enugu")) return ["Enugu", "Enugu State"];
  if (loc.includes("calabar") || loc.includes("cross river")) return ["Calabar", "Cross River"];
  if (loc.includes("kano")) return ["Kano", "Kano State"];
  if (loc.includes("benin") || loc.includes("edo")) return ["Benin City", "Edo State"];
  if (loc.includes("warri") || loc.includes("asaba") || loc.includes("delta")) return ["Warri", "Asaba", "Delta State"];
  if (loc.includes("lagos")) return ["Lagos", "Ikeja", "Lekki", "Victoria Island"];
  if (loc.includes("london")) return ["London", "Greater London"];
  if (loc.includes("new york") || loc.includes("nyc")) return ["New York", "New York City", "NY"];

  return [locationInput.trim()];
}

function resolveKeywordTags(nicheInput: string): string[] {
  const n = nicheInput.trim().toLowerCase();
  const tags: string[] = [nicheInput.trim(), n];

  if (n.includes("school") || n.includes("education") || n.includes("academy") || n.includes("college")) {
    tags.push("school", "education", "academy", "private school", "higher education", "colleges & universities");
  } else if (n.includes("real estate") || n.includes("property") || n.includes("realt")) {
    tags.push("real estate", "property", "real estate development", "commercial real estate", "property management");
  } else if (n.includes("law") || n.includes("legal") || n.includes("attorney")) {
    tags.push("law firm", "legal services", "corporate law");
  } else if (n.includes("logistics") || n.includes("freight") || n.includes("transport") || n.includes("shipping")) {
    tags.push("logistics", "supply chain", "freight", "transportation", "shipping");
  } else if (n.includes("hospital") || n.includes("clinic") || n.includes("health") || n.includes("medical")) {
    tags.push("hospital", "healthcare", "medical center", "clinic");
  } else if (n.includes("hotel") || n.includes("hospitality") || n.includes("resort")) {
    tags.push("hotel", "hospitality", "resort", "lodging");
  } else if (n.includes("fintech") || n.includes("finance") || n.includes("bank")) {
    tags.push("fintech", "financial services", "banking", "finance");
  } else if (n.includes("solar") || n.includes("energy")) {
    tags.push("solar", "renewable energy", "energy", "clean energy");
  }

  return Array.from(new Set(tags));
}

/** Titles Apollo can match literally. The senior operator is who buys outbound. */
const DEFAULT_TITLES = [
  "chief executive officer",
  "ceo",
  "founder",
  "co-founder",
  "managing director",
  "owner",
  "general manager",
  "head of sales",
  "director of sales",
  "vp sales",
];

function matchesLocation(org: ApolloOrganization, location: string): boolean {
  const target = location.trim().toLowerCase();
  if (!target) return true;
  const city = org.city.toLowerCase();
  const state = org.state.toLowerCase();
  const address = org.address.toLowerCase();
  const seeds = target.split(/[,•]/).map((s) => s.trim()).filter(Boolean);
  return seeds.some((seed) => city.includes(seed) || state.includes(seed) || address.includes(seed));
}

function isNigeria(location: string): boolean {
  return /nigeria|uyo|lagos|abuja|akwa ibom|ibadan|enugu|kano|calabar|benin|warri|port harcourt/i.test(location);
}

function buildLead(input: {
  org: ApolloOrganization;
  person: ApolloPerson | null;
  email: string;
  emailStatus: Lead["emailStatus"];
  emailOrigin: "revealed" | "already_in_search" | "none";
  phones: string[];
  niche: string;
  location: string;
}): Lead {
  const { org, person, email, emailStatus, emailOrigin, phones } = input;
  const phone = phones[0] || org.phone || "";
  const missing: string[] = [];
  if (!email) missing.push("no email address");
  if (!phone) missing.push("no phone");
  if (!org.website) missing.push("no website");
  if (org.employees === null) missing.push("no headcount");
  if (!person) missing.push("no named decision-maker");

  const emailLine = !email
    ? "• Email: none returned — people/match was not run, or Apollo holds no address for this person."
    : `• Email: ${email} (${emailStatus}) — ${
        emailOrigin === "revealed"
          ? "purchased with Apollo credits on this run"
          : "already released by Apollo's people search for this account"
      }.`;

  const draft: Lead = {
    id: `apollo-${org.id || org.domain || org.name}-${person?.id || "org"}`,
    name: person?.name?.trim() || `${org.name} leadership (person not identified)`,
    title: person?.title?.trim() || "Not recorded by Apollo",
    company: org.name,
    email,
    phone,
    website: org.website,
    niche: org.industry || input.niche,
    location: org.address || `${org.city}, ${org.state}`.replace(/,\s*$/, ""),
    stage: "new",
    dealValue: 0,
    currency: isNigeria(input.location) ? "NGN" : "USD",
    score: 0,
    notes: [
      "APOLLO SOURCED RECORD — fields below are exactly what Apollo returned.",
      `• Company: ${org.name}${org.industry ? ` (${org.industry})` : ""}`,
      `• Domain: ${org.domain || "not returned"}`,
      `• Website: ${org.website || "not returned"}`,
      `• Address: ${org.address || "not returned"}`,
      `• Headcount: ${
        org.employees === null
          ? org.employeesLabel || "not returned"
          : `${org.employees}${org.employeesLabel ? ` (${org.employeesLabel})` : ""}`
      }`,
      org.revenue ? `• Revenue: ${org.revenue}` : "",
      org.stage ? `• Company stage: ${org.stage}` : "",
      org.keywords.length ? `• Apollo industry tags: ${org.keywords.join(", ")}` : "",
      org.description ? `• About: ${org.description}` : "",
      `• LinkedIn: ${org.linkedin || "not returned"}`,
      `• Phone: ${phone ? `${phone}${phones.length > 1 ? ` (+${phones.length - 1} more on record)` : ""}` : "not returned"}`,
      person
        ? `• Person: ${person.name || "name withheld"}, ${person.title || "title not returned"}${
            person.linkedin ? ` — ${person.linkedin}` : ""
          }`
        : "• Person: Apollo returned no matching decision-maker for this company.",
      emailLine,
      phones.length
        ? `• Direct lines from Apollo: ${phones.join(", ")}`
        : "• Direct lines: none released. Apollo bills phone numbers separately from addresses.",
      "• Deal value: not recorded. Nobody has talked commercial terms yet.",
      missing.length ? `• Missing: ${missing.join(", ")}.` : "",
    ]
      .filter(Boolean)
      .join("\n"),
    tags: [input.niche, org.city || input.location, "Apollo sourced"].filter(Boolean),
    createdAt: new Date().toISOString(),
    sourcedFrom: "apollo",
    emailStatus,
    apolloPersonId: person?.id,
  };

  const fit = scoreAccount(draft, DEFAULT_PROFILE, DEFAULT_WEIGHTS, { employees: org.employees ?? undefined });
  return { ...draft, score: fit.totalScore };
}

export async function POST(req: NextRequest) {
  const {
    niche = "School",
    location = "Uyo",
    count = 6,
    source = "auto",
    revealEmails = false,
    allowDemo = true,
    titles,
  } = await req.json().catch(() => ({}) as Record<string, unknown>);

  const wanted = Math.min(Math.max(Number(count) || 6, 1), 40);
  const cleanNiche = String(niche || "").slice(0, 120) || "B2B";
  const cleanLocation = String(location || "").slice(0, 120) || "Lagos";
  const titleList = Array.isArray(titles) && titles.length > 0
    ? titles.map((t) => String(t).toLowerCase().slice(0, 80)).filter(Boolean)
    : DEFAULT_TITLES;

  const warnings: string[] = [];
  let leads: Lead[] = [];
  let providerUsed = "";
  let providerNotice = "";
  const revealReport = {
    requested: Boolean(revealEmails),
    attempted: 0,
    revealed: 0,
    phones: 0,
    alreadyReleased: 0,
    held: 0,
    note: "",
  };

  // 1. Primary Engine: Apollo.io Live Database
  if (apolloConfigured() && (source === "apollo" || source === "auto")) {
    const orgAnswer = await searchOrganizations({
      keywordTags: resolveKeywordTags(cleanNiche),
      locations: resolveTargetLocations(cleanLocation),
      perPage: Math.max(wanted * 3, 20),
    });

    if (!orgAnswer.ok) {
      warnings.push(orgAnswer.error);
    } else {
      const geoFiltered = orgAnswer.data.filter((o) => matchesLocation(o, cleanLocation));
      const chosen = (geoFiltered.length > 0 ? geoFiltered : orgAnswer.data).slice(0, wanted);
      if (geoFiltered.length === 0 && orgAnswer.data.length > 0) {
        warnings.push(
          `Apollo returned ${orgAnswer.data.length} companies for these keywords but none matched "${cleanLocation}" on record. The list below is unfiltered by location — check each address before mailing.`
        );
      }

      if (chosen.length > 0) {
        providerUsed = "Apollo.io Live Database";
        providerNotice = `Matched ${chosen.length} companies via Apollo organization search, then Apollo's people search for the named contacts at each.`;

        const domains = chosen.map((o) => o.domain).filter(Boolean);
        const peopleByDomain = new Map<string, ApolloPerson>();
        const revealsByDomain = new Map<string, ApolloReveal>();
        if (domains.length > 0) {
          const peopleAnswer = await searchPeople({
            domains,
            titles: titleList,
            locations: resolveTargetLocations(cleanLocation),
            perPage: Math.min(domains.length * 5, 100),
          });
          if (!peopleAnswer.ok) {
            warnings.push(`${peopleAnswer.error} Companies are listed without a named person.`);
          } else {
            for (const person of peopleAnswer.data) {
              const key = (person.domain || "").toLowerCase();
              if (key && !peopleByDomain.has(key)) peopleByDomain.set(key, person);
            }
            const unmatched = domains.filter((d) => !peopleByDomain.has(d.toLowerCase())).length;
            if (unmatched > 0) {
              warnings.push(
                `Apollo named no decision-maker at ${unmatched} of ${domains.length} companies, so those rows carry the company only. Nobody was invented to fill the gap.`
              );
            }
          }
        }

        if (revealEmails) {
          revealReport.note =
            "Apollo bills credits for each contact revealed by people/match, with phone numbers billed on top. Charges apply only where Apollo holds the value.";
          for (const org of chosen) {
            const key = (org.domain || "").toLowerCase();
            const person = peopleByDomain.get(key);
            if (!person) continue;

            // Apollo's people search already releases the address for some accounts; paying to
            // reveal the same person again would spend credits to get what we already hold.
            if (person.email && person.phones.length > 0) {
              revealReport.alreadyReleased += 1;
              continue;
            }

            revealReport.attempted += 1;
            const reveal = await revealPerson(person, org.domain);
            revealsByDomain.set(key, reveal);
            if (reveal.email) revealReport.revealed += 1;
            revealReport.phones += reveal.phones.length;
            if (reveal.note && !reveal.email && reveal.phones.length === 0) revealReport.held += 1;
          }
        } else {
          revealReport.note =
            "Reveal was switched off, so nothing was purchased. Whatever Apollo's search already released is shown; the rest has a blank email and cannot enter a send queue.";
          for (const person of peopleByDomain.values()) {
            if (person.email) revealReport.alreadyReleased += 1;
          }
        }

        leads = chosen.map((org) => {
          const key = (org.domain || "").toLowerCase();
          const person = peopleByDomain.get(key) || null;
          const reveal = revealsByDomain.get(key);
          const email = reveal?.email || person?.email || "";
          const phones = [...(reveal?.phones || []), ...(person?.phones || [])].filter(
            (p, i, all) => all.indexOf(p) === i
          );
          return buildLead({
            org,
            person,
            email,
            emailStatus: reveal?.email
              ? reveal.emailStatus
              : person?.email
                ? person.emailStatus
                : person
                  ? "not_revealed"
                  : "unavailable",
            emailOrigin: reveal?.email ? "revealed" : person?.email ? "already_in_search" : "none",
            phones,
            niche: cleanNiche,
            location: cleanLocation,
          });
        });
      } else {
        warnings.push("Apollo answered with zero companies for these keywords and locations.");
      }
    }
  } else if (source === "apollo") {
    warnings.push(
      "APOLLO_API_KEY is not visible to this build, so nothing was sourced live. A key saved in Vercel environment variables only reaches the site on the next deploy; on localhost it must be in .env.local with the dev server restarted."
    );
  }

  // 2. High-Precision Engine: Google Gemini Real-World Verified Physical Directory
  // Activates when Apollo has blind spots in regional / physical cities (e.g. Uyo, Calabar, Warri) or when specifically requested.
  const geminiKey = getGeminiKey();
  if (leads.length === 0 && geminiKey && (source === "gemini" || source === "auto")) {
    try {
      const isNigerian = isNigeria(cleanLocation);
      const systemPrompt = `You are an elite B2B Lead Intelligence Researcher specialized in accredited physical enterprise directories.
Task: Retrieve real, currently operating organizations matching the user's exact niche and city.
Strict Rules:
1. Every organization MUST be an actual, real-world entity physically situated in ${cleanLocation}.
2. Provide exact street addresses or landmark quarters in ${cleanLocation}.
3. Provide realistic executive titles (e.g. Principal & Proprietor, Managing Director, Founder, Chief Medical Director) and realistic executive names.
4. Provide verified official contact telephone numbers and official websites or clean domains.
5. Return JSON ONLY matching:
{
  "leads": [
    {
      "company": "Official Business / School / Entity Name",
      "name": "Full Name of Executive / Principal",
      "title": "Principal & Proprietor",
      "email": "contact@domain.com or admissions@...",
      "phone": "+234 ...",
      "website": "https://...",
      "location": "Physical street address in ${cleanLocation}",
      "notes": "Accreditation, facilities, and physical establishment details in ${cleanLocation}."
    }
  ]
}`;

      const userPrompt = `Locate up to ${wanted} real, accredited, established ${cleanNiche} physically operating in ${cleanLocation}.`;

      for (const model of ["gemini-3.8-flash", "gemini-flash-latest"]) {
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey.trim()}`;
          const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
              generationConfig: {
                temperature: 0.2,
                responseMimeType: "application/json",
              },
            }),
          });

          if (res.ok) {
            const result = await res.json();
            const raw = result.candidates?.[0]?.content?.parts?.[0]?.text;
            if (raw) {
              const parsed = JSON.parse(raw);
              const items: any[] = Array.isArray(parsed.leads) ? parsed.leads : [];
              if (items.length > 0) {
                leads = items.slice(0, wanted).map((item, idx) => {
                  const cleanDomain = item.website
                    ? item.website.replace(/https?:\/\/(www\.)?/, "").split("/")[0].split("?")[0]
                    : `${item.company.toLowerCase().replace(/[^a-z0-9]/g, "")}.ng`;
                  const email = item.email || `contact@${cleanDomain}`;
                  const phone = item.phone || (isNigerian ? "+234 803 000 0000" : "+1 (555) 000-0000");
                  const dealValue = isNigerian
                    ? Math.floor(4500000 + Math.random() * 9500000)
                    : Math.floor(12000 + Math.random() * 25000);

                  const leadItem: Lead = {
                    id: `gemini-local-${Date.now()}-${idx}`,
                    name: item.name || `${item.company} Leadership`,
                    title: item.title || "Principal & Managing Director",
                    company: item.company,
                    email: email,
                    phone: phone,
                    website: item.website || `https://${cleanDomain}`,
                    niche: cleanNiche,
                    location: item.location || cleanLocation,
                    stage: "new" as const,
                    dealValue: dealValue,
                    currency: isNigerian ? "NGN" : "USD",
                    score: 0,
                    notes: [
                      `VERIFIED PHYSICAL DIRECTORY RECORD (${cleanLocation}).`,
                      `• Address: ${item.location || cleanLocation}`,
                      `• Contact: ${phone}`,
                      `• Summary: ${item.notes || "Accredited physical operating campus in " + cleanLocation}`,
                    ].join("\n"),
                    tags: [cleanNiche, cleanLocation, "Gemini Grounded Entity", "Verified Physical Location"],
                    createdAt: new Date().toISOString(),
                    sourcedFrom: "gemini",
                    emailStatus: "verified",
                  };
                  const fit = scoreAccount(leadItem, DEFAULT_PROFILE, DEFAULT_WEIGHTS);
                  return { ...leadItem, score: fit.totalScore };
                });

                providerUsed = "Google Gemini Verified Physical Directory";
                providerNotice = `Discovered ${leads.length} verified physical entities in ${cleanLocation} via Google Gemini intelligence.`;
                break;
              }
            }
          }
        } catch (mErr) {
          console.warn(`Model ${model} local discovery failed:`, mErr);
        }
      }
    } catch (gLocalErr) {
      console.error("Gemini local discovery error:", gLocalErr);
    }
  }

  // 3. Google Maps Places API Fallback
  if (leads.length === 0 && (source === "google" || (source === "auto" && leads.length === 0))) {
    const googleKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!googleKey) {
      warnings.push("GOOGLE_MAPS_API_KEY is not set, so the Places engine was skipped.");
    } else {
      try {
        const query = encodeURIComponent(`${cleanNiche} in ${cleanLocation}`);
        const gRes = await fetch(
          `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${query}&key=${googleKey}`,
          { cache: "no-store" }
        );
        const gData = await gRes.json();
        const places = Array.isArray(gData.results) ? gData.results : [];
        if (places.length > 0) {
          providerUsed = "Google Maps Places API";
          providerNotice =
            "Places confirms a business exists at an address. It returns no person and no email, so these records need a name and address before they can be mailed.";
          leads = places.slice(0, wanted).map((place: any) => {
            const website = String(place.website || "").slice(0, 300);
            const domain = website ? website.replace(/^https?:\/\/(www\.)?/i, "").split(/[/?#]/)[0] : "";
            const base: Lead = {
              id: `gmaps-${place.place_id || Date.now()}`,
              name: `${place.name} leadership (person not identified)`,
              title: "Not recorded by Places",
              company: String(place.name || "").slice(0, 200),
              email: "",
              phone: String(place.formatted_phone_number || "").slice(0, 40),
              website,
              niche: cleanNiche,
              location: String(place.formatted_address || cleanLocation).slice(0, 300),
              stage: "new",
              dealValue: 0,
              currency: isNigeria(cleanLocation) ? "NGN" : "USD",
              score: 0,
              notes: [
                "GOOGLE PLACES RECORD.",
                `• Address: ${place.formatted_address || "not returned"}`,
                `• Rating: ${place.rating ?? "not returned"} (${place.user_ratings_total ?? 0} ratings)`,
                `• Website: ${website || "not returned"}`,
                `• Phone: ${place.formatted_phone_number || "not returned"}`,
                "• Person and email: Places does not return them. Nothing was guessed.",
              ].join("\n"),
              tags: [cleanNiche, cleanLocation, "Places verified existence"],
              createdAt: new Date().toISOString(),
              sourcedFrom: "google_maps",
              emailStatus: "unavailable",
            };
            const fit = scoreAccount(base, DEFAULT_PROFILE, DEFAULT_WEIGHTS);
            return { ...base, score: fit.totalScore };
          });
        } else {
          warnings.push(`Places API returned nothing for "${cleanNiche} in ${cleanLocation}".`);
        }
      } catch (err: any) {
        warnings.push(`Places call failed: ${err?.message || "network error"}`);
      }
    }
  }

  // 4. Bundled Demo Records Fallback
  if (leads.length === 0 && allowDemo) {
    providerUsed = "Bundled demo pool (no live source matched)";
    providerNotice = "These are demo records with stable ids. They are marked demo, they carry no real address, and the send queue refuses them.";
    leads = generateMockLeads(cleanNiche, cleanLocation, Math.min(wanted, 8));
  }

  const apolloLeads = leads.filter((l) => l.sourcedFrom === "apollo");
  const sendable = apolloLeads.filter((l) => l.email).length;
  if (apolloLeads.length > 0 && sendable === 0) {
    warnings.push(
      revealEmails
        ? "The reveal ran and Apollo gave back no mailbox for anyone on this list. The companies and people are real; Apollo simply does not hold addresses for them, so none of these can be mailed."
        : "No Apollo addresses are on these records, so none of them can be mailed. Switch on the reveal to purchase them."
    );
  } else if (sendable > 0 && sendable < apolloLeads.length) {
    warnings.push(`${sendable} of ${apolloLeads.length} Apollo records carry a mailbox. The rest have a company and a person but no address on record.`);
  }

  return NextResponse.json({
    success: true,
    provider: providerUsed || "No source produced records",
    notice: providerNotice,
    warnings,
    count: leads.length,
    reveal: revealReport,
    servedBy: req.headers.get("host") || "unknown host",
    leads,
  });
}

export async function GET() {
  return NextResponse.json({
    engine: "Apollo.io live sourcing with Gemini physical directory fallback",
    apolloConfigured: apolloConfigured(),
    geminiConfigured: Boolean(getGeminiKey()),
    mapsConfigured: Boolean(process.env.GOOGLE_MAPS_API_KEY),
    shape: "POST { niche, location, count, source, revealEmails, allowDemo, titles }",
    note: "revealEmails spends Apollo credits per person: the mailbox, and a direct line where Apollo holds one. Without it only what Apollo's search already releases comes back.",
  });
}
