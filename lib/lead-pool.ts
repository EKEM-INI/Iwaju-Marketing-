import type { Lead, PipelineStage } from "@/types";

/**
 * One catalog of prospect records for the whole app.
 *
 * Every entry has a fixed id, so the same company is the same record no matter
 * whether it arrives through prospecting, the bulk seed, or the campaign contact
 * picker. That stability is what lets `upsertLeads` merge instead of duplicating.
 *
 * These are bundled demo records, not sourced data. They are labelled as such on
 * the note field so no downstream agent can present them as Apollo results.
 */
export const SAMPLE_SOURCE = "bundled sample pool";

interface PoolEntry {
  id: string;
  name: string;
  title: string;
  company: string;
  email: string;
  phone: string;
  website: string;
  niche: string;
  location: string;
  keywords: string[];
  dealValue: number;
  currency: string;
  score: number;
  tags: string[];
  discoveredDaysAgo: number;
}

const HOURS = 3600000;
const DAYS = 24 * HOURS;

export const SAMPLE_POOL: PoolEntry[] = [
  {
    id: "pool-01",
    name: "Toluwa Adeniran",
    title: "Principal Partner",
    company: "Adeniran & Cole Solicitors",
    email: "t.adeniran@adenirancole.ng",
    phone: "+234 802 551 3390",
    website: "https://www.adenirancole.ng",
    niche: "Corporate Law",
    location: "Lagos",
    keywords: ["law", "legal", "lawyer", "solicitor", "chambers", "corporate", "lagos", "nigeria"],
    dealValue: 9800000,
    currency: "NGN",
    score: 81,
    tags: ["Law Firms", "Lagos"],
    discoveredDaysAgo: 9,
  },
  {
    id: "pool-02",
    name: "Chinelo Nwankwo",
    title: "Head of Commercial",
    company: "Meridian Estate Partners",
    email: "chinelo.n@meridianestate.ng",
    phone: "+234 809 442 7715",
    website: "https://www.meridianestate.ng",
    niche: "Real Estate",
    location: "Lekki, Lagos",
    keywords: ["real", "estate", "property", "land", "developer", "housing", "lagos", "nigeria"],
    dealValue: 16400000,
    currency: "NGN",
    score: 88,
    tags: ["Real Estate", "Lagos"],
    discoveredDaysAgo: 6,
  },
  {
    id: "pool-03",
    name: "Ibrahim Sule",
    title: "Managing Director",
    company: "Sahel Grain Processing Ltd",
    email: "ibrahim@sahelgrain.com",
    phone: "+234 703 118 6642",
    website: "https://www.sahelgrain.com",
    niche: "Agro-Processing",
    location: "Kano",
    keywords: ["agro", "agriculture", "grain", "food", "processing", "farming", "commodity", "kano", "nigeria"],
    dealValue: 12200000,
    currency: "NGN",
    score: 76,
    tags: ["Agribusiness", "Kano"],
    discoveredDaysAgo: 14,
  },
  {
    id: "pool-04",
    name: "Ngozi Eze",
    title: "Chief Executive Officer",
    company: "Clearline Payments Nigeria",
    email: "ngozi.eze@clearlinepay.com",
    phone: "+234 815 776 2093",
    website: "https://www.clearlinepay.com",
    niche: "FinTech & Payments",
    location: "Victoria Island, Lagos",
    keywords: ["fintech", "payments", "banking", "wallet", "saas", "software", "lagos", "nigeria"],
    dealValue: 21000000,
    currency: "NGN",
    score: 93,
    tags: ["FinTech", "Lagos"],
    discoveredDaysAgo: 4,
  },
  {
    id: "pool-05",
    name: "Peter Okoro",
    title: "Operations Director",
    company: "Delta Freight & Offshore Services",
    email: "p.okoro@deltaoffshore.ng",
    phone: "+234 806 330 5518",
    website: "https://www.deltaoffshore.ng",
    niche: "Logistics & Freight",
    location: "Port Harcourt",
    keywords: ["logistics", "freight", "shipping", "maritime", "offshore", "supply", "port harcourt", "nigeria"],
    dealValue: 18750000,
    currency: "NGN",
    score: 85,
    tags: ["Logistics", "Port Harcourt"],
    discoveredDaysAgo: 11,
  },
  {
    id: "pool-06",
    name: "Halima Yusuf",
    title: "Chief Operating Officer",
    company: "Brightgrid Solar Systems",
    email: "halima@brightgridsolar.ng",
    phone: "+234 813 604 9927",
    website: "https://www.brightgridsolar.ng",
    niche: "Renewable Energy",
    location: "Abuja",
    keywords: ["solar", "renewable", "energy", "power", "grid", "clean", "abuja", "nigeria"],
    dealValue: 14300000,
    currency: "NGN",
    score: 87,
    tags: ["CleanTech", "Abuja"],
    discoveredDaysAgo: 7,
  },
  {
    id: "pool-07",
    name: "Ade Bakare",
    title: "Founder & Headteacher",
    company: "Greenfield British Academy",
    email: "ade.bakare@greenfieldacademy.ng",
    phone: "+234 804 229 7160",
    website: "https://www.greenfieldacademy.ng",
    niche: "Private Education",
    location: "Ibadan",
    keywords: ["school", "education", "academy", "learning", "k12", "ibadan", "nigeria"],
    dealValue: 6100000,
    currency: "NGN",
    score: 71,
    tags: ["Education", "Ibadan"],
    discoveredDaysAgo: 19,
  },
  {
    id: "pool-08",
    name: "Zara Bello",
    title: "General Manager",
    company: "Palm Court Hotels & Resorts",
    email: "zara.bello@palmcourthotels.com",
    phone: "+234 705 993 2441",
    website: "https://www.palmcourthotels.com",
    niche: "Hospitality",
    location: "Calabar",
    keywords: ["hotel", "hospitality", "resort", "travel", "tourism", "calabar", "nigeria"],
    dealValue: 8900000,
    currency: "NGN",
    score: 74,
    tags: ["Hospitality", "Calabar"],
    discoveredDaysAgo: 23,
  },
  {
    id: "pool-09",
    name: "Dr. Emeka Ifeadike",
    title: "Medical Director",
    company: "Cedar Crest Diagnostics",
    email: "e.ifeadike@cedarcrestdx.ng",
    phone: "+234 812 447 0036",
    website: "https://www.cedarcrestdx.ng",
    niche: "Healthcare",
    location: "Enugu",
    keywords: ["health", "clinic", "hospital", "diagnostics", "medical", "lab", "enugu", "nigeria"],
    dealValue: 10600000,
    currency: "NGN",
    score: 79,
    tags: ["Healthcare", "Enugu"],
    discoveredDaysAgo: 16,
  },
  {
    id: "pool-10",
    name: "Blessing Tom",
    title: "Director of Partnerships",
    company: "Uyo Manufacturing Group",
    email: "blessing.tom@uyomanufacturing.ng",
    phone: "+234 808 551 3372",
    website: "https://www.uyomanufacturing.ng",
    niche: "Manufacturing",
    location: "Uyo",
    keywords: ["manufacturing", "factory", "industrial", "production", "packaging", "uyo", "nigeria"],
    dealValue: 13200000,
    currency: "NGN",
    score: 77,
    tags: ["Manufacturing", "Uyo"],
    discoveredDaysAgo: 12,
  },
  {
    id: "pool-11",
    name: "Kunle Oyeniyi",
    title: "Managing Partner",
    company: "Stonebridge Capital Advisory",
    email: "kunley@stonebridgecap.co.uk",
    phone: "+44 20 7946 0812",
    website: "https://www.stonebridgecap.co.uk",
    niche: "Private Equity",
    location: "London",
    keywords: ["private", "equity", "capital", "investment", "venture", "advisory", "finance", "london", "uk"],
    dealValue: 42000,
    currency: "GBP",
    score: 90,
    tags: ["PE / VC", "London"],
    discoveredDaysAgo: 5,
  },
  {
    id: "pool-12",
    name: "Marcus Feld",
    title: "VP of Revenue Operations",
    company: "Northwind Staffing Group",
    email: "marcus.feld@northwindstaffing.com",
    phone: "+1 (312) 555-0148",
    website: "https://www.northwindstaffing.com",
    niche: "Staffing & Recruiting",
    location: "Chicago",
    keywords: ["staffing", "recruiting", "hr", "hiring", "workforce", "chicago", "usa"],
    dealValue: 28000,
    currency: "USD",
    score: 82,
    tags: ["Staffing", "Chicago"],
    discoveredDaysAgo: 8,
  },
  {
    id: "pool-13",
    name: "Priya Raghavan",
    title: "Chief Executive Officer",
    company: "Bluewave Health Logistics",
    email: "priya.r@bluewavehealth.ae",
    phone: "+971 4 555 0193",
    website: "https://www.bluewavehealth.ae",
    niche: "Healthcare Logistics",
    location: "Dubai",
    keywords: ["health", "logistics", "supply", "pharma", "distribution", "dubai", "uae"],
    dealValue: 33000,
    currency: "AED",
    score: 84,
    tags: ["Healthcare", "Dubai"],
    discoveredDaysAgo: 10,
  },
  {
    id: "pool-14",
    name: "Daniel Okafor",
    title: "Head of Growth",
    company: "Kobo Learning Platform",
    email: "daniel@kobolearning.com",
    phone: "+234 810 662 4475",
    website: "https://www.kobolearning.com",
    niche: "EdTech",
    location: "Yaba, Lagos",
    keywords: ["edtech", "software", "saas", "learning", "platform", "startup", "lagos", "nigeria"],
    dealValue: 7400000,
    currency: "NGN",
    score: 80,
    tags: ["EdTech", "Lagos"],
    discoveredDaysAgo: 13,
  },
  {
    id: "pool-15",
    name: "Fatima Garba",
    title: "Chief Financial Officer",
    company: "Ironlane Construction Nigeria",
    email: "fatima.garba@ironlane.ng",
    phone: "+234 701 338 9924",
    website: "https://www.ironlane.ng",
    niche: "Construction",
    location: "Abuja",
    keywords: ["construction", "building", "engineering", "infrastructure", "civil", "abuja", "nigeria"],
    dealValue: 19800000,
    currency: "NGN",
    score: 86,
    tags: ["Construction", "Abuja"],
    discoveredDaysAgo: 6,
  },
  {
    id: "pool-16",
    name: "Samuel Adeleke",
    title: "Founder",
    company: "Lagos Fresh Retail",
    email: "samuel@lagosfresh.ng",
    phone: "+234 902 447 1183",
    website: "https://www.lagosfresh.ng",
    niche: "Retail & E-Commerce",
    location: "Ikeja, Lagos",
    keywords: ["retail", "ecommerce", "commerce", "grocery", "consumer", "shop", "lagos", "nigeria"],
    dealValue: 8200000,
    currency: "NGN",
    score: 73,
    tags: ["Retail", "Lagos"],
    discoveredDaysAgo: 17,
  },
  {
    id: "pool-17",
    name: "Rachel Mensah",
    title: "Director of Client Success",
    company: "Anchor Assurance Brokers",
    email: "rachel.mensah@anchorassurance.gh",
    phone: "+233 302 550 118",
    website: "https://www.anchorassurance.gh",
    niche: "Insurance",
    location: "Accra",
    keywords: ["insurance", "broker", "assurance", "underwriting", "risk", "accra", "ghana"],
    dealValue: 15000,
    currency: "USD",
    score: 78,
    tags: ["Insurance", "Accra"],
    discoveredDaysAgo: 15,
  },
  {
    id: "pool-18",
    name: "Victor Ekanem",
    title: "Technical Director",
    company: "Peninsula Oilfield Services",
    email: "v.ekanem@peninsulaoilfield.ng",
    phone: "+234 807 226 5541",
    website: "https://www.peninsulaoilfield.ng",
    niche: "Oil & Gas Services",
    location: "Warri",
    keywords: ["oil", "gas", "energy", "petroleum", "field", "services", "warri", "nigeria"],
    dealValue: 23400000,
    currency: "NGN",
    score: 89,
    tags: ["Energy", "Warri"],
    discoveredDaysAgo: 3,
  },
  {
    id: "pool-19",
    name: "Aisha Kalu",
    title: "Head of Marketing",
    company: "Southbank Creative Studio",
    email: "aisha@southbankcreative.ng",
    phone: "+234 814 993 2270",
    website: "https://www.southbankcreative.ng",
    niche: "Marketing & Media",
    location: "Benin City",
    keywords: ["marketing", "media", "creative", "agency", "brand", "advertising", "benin", "nigeria"],
    dealValue: 5400000,
    currency: "NGN",
    score: 69,
    tags: ["Agency", "Benin City"],
    discoveredDaysAgo: 21,
  },
  {
    id: "pool-20",
    name: "Thomas Berger",
    title: "Chief Executive Officer",
    company: "Ridgeline Security Systems",
    email: "t.berger@ridgelinesec.com",
    phone: "+1 (206) 555-0117",
    website: "https://www.ridgelinesec.com",
    niche: "Security & Facilities",
    location: "Seattle",
    keywords: ["security", "facilities", "guarding", "systems", "surveillance", "seattle", "usa"],
    dealValue: 24000,
    currency: "USD",
    score: 75,
    tags: ["Security", "Seattle"],
    discoveredDaysAgo: 18,
  },
];

const STAGES: PipelineStage[] = ["new", "contacted", "meeting", "closed"];

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 2);
}

function matchScore(entry: PoolEntry, queryTokens: string[]): number {
  if (queryTokens.length === 0) return 0;
  const haystack = [...entry.keywords, ...tokenize(entry.niche), ...tokenize(entry.location)];
  let score = 0;
  for (const token of queryTokens) {
    if (haystack.some((h) => h === token)) score += 3;
    else if (haystack.some((h) => h.includes(token) || token.includes(h))) score += 1;
  }
  return score;
}

export function leadFromPoolEntry(entry: PoolEntry, stage: PipelineStage = "new", now = Date.now()): Lead {
  return {
    id: entry.id,
    name: entry.name,
    title: entry.title,
    company: entry.company,
    email: entry.email,
    phone: entry.phone,
    website: entry.website,
    niche: entry.niche,
    location: entry.location,
    stage,
    dealValue: entry.dealValue,
    currency: entry.currency,
    score: entry.score,
    notes: `Sample record from the bundled ${SAMPLE_SOURCE}. Not verified, not sourced from Apollo — treat every field as unproven until checked.`,
    tags: [...entry.tags, "Sample Data"],
    createdAt: new Date(now - entry.discoveredDaysAgo * DAYS).toISOString(),
    sourcedFrom: "demo",
  };
}

/** Deterministic selection: same query always yields the same records, with the same ids. */
export function sampleLeadsFor(niche: string, location: string, count = 6, stage: PipelineStage = "new"): Lead[] {
  const query = [...tokenize(niche || ""), ...tokenize(location || "")];
  const now = Date.now();
  return SAMPLE_POOL.map((entry) => ({ entry, score: matchScore(entry, query) }))
    .sort((a, b) => b.score - a.score || a.entry.id.localeCompare(b.entry.id))
    .slice(0, Math.max(0, count))
    .map(({ entry }) => leadFromPoolEntry(entry, stage, now));
}

/**
 * Spread a batch across stages without inventing new people — the ids still come
 * from the pool, so a seeded record and a prospected record are the same record.
 */
export function sampleLeadsAcrossStages(count: number): Lead[] {
  const now = Date.now();
  return Array.from({ length: Math.max(0, count) }, (_, i) => {
    const entry = SAMPLE_POOL[i % SAMPLE_POOL.length];
    return leadFromPoolEntry(entry, STAGES[i % STAGES.length], now);
  });
}
