import { Lead, ScrapingLog } from "@/types";

const NIGERIAN_FIRST_NAMES = [
  "Olumide", "Chidiebere", "Amina", "Babajide", "Folake", "Emeka", "Zainab", 
  "Damilola", "Kelechi", "Adeola", "Ngozi", "Tariq", "Ini-Obong", "Edidiong", 
  "Somto", "Yetunde", "Babatunde", "Chidinma", "Farouk", "Bolanle"
];

const NIGERIAN_LAST_NAMES = [
  "Adeyemi", "Okonkwo", "Bello", "Eze", "Balogun", "Danjuma", "Akpan", 
  "Olawale", "Nwosu", "Ibrahim", "Ogundipe", "Bassey", "Effiong", "Suleiman", 
  "Adegoke", "Okafor", "Sanusi", "Adewale", "Soyinka", "Chukwuma"
];

const GLOBAL_FIRST_NAMES = [
  "Alexander", "Marcus", "Elena", "Sophia", "Julian", "Claire", "David", 
  "Rachel", "Lucas", "Victoria", "Oliver", "Samantha", "Nathan", "Grace"
];

const GLOBAL_LAST_NAMES = [
  "Sterling", "Vance", "Chen", "Reynolds", "Kowalski", "Mercer", "Harrington", 
  "Sinclair", "Vanderbilt", "Blackwood", "Ashford", "Montgomery"
];

const EXECUTIVE_TITLES = [
  "Managing Director",
  "Chief Executive Officer",
  "Partner & Principal",
  "Head of Growth & Commercial",
  "VP of Business Development",
  "Chief Operating Officer",
  "Director of Client Acquisitions",
];

export function generateScrapingLogs(niche: string, location: string): ScrapingLog[] {
  const cleanNiche = niche.trim() || "B2B";
  const cleanLoc = location.trim() || "Lagos";

  return [
    {
      id: "log-1",
      timestamp: new Date().toLocaleTimeString(),
      text: `Initializing Iwaju DeepCrawler v4.8 targeting [${cleanNiche}] in [${cleanLoc}]...`,
      status: "info",
    },
    {
      id: "log-2",
      timestamp: new Date().toLocaleTimeString(),
      text: `Querying regional registry, business directories & LinkedIn sales navigator indices...`,
      status: "info",
    },
    {
      id: "log-3",
      timestamp: new Date().toLocaleTimeString(),
      text: `Discovered 42 active commercial domain endpoints matching "${cleanNiche}" footprint in ${cleanLoc}.`,
      status: "info",
    },
    {
      id: "log-4",
      timestamp: new Date().toLocaleTimeString(),
      text: `Executing MX record ping & SMTP handshake verification on discovered domains...`,
      status: "warning",
    },
    {
      id: "log-5",
      timestamp: new Date().toLocaleTimeString(),
      text: `98.2% deliverability rate verified. Extracting C-Level decision-maker nodes & direct phone lines...`,
      status: "info",
    },
    {
      id: "log-6",
      timestamp: new Date().toLocaleTimeString(),
      text: `Calculated high-intent pipeline scoring. Yielding top qualified prospects ready for pipeline injection.`,
      status: "success",
    },
  ];
}

export function generateMockLeads(niche: string, location: string, count: number = 6): Lead[] {
  const cleanNiche = niche.trim() || "Real Estate";
  const cleanLoc = location.trim() || "Lagos";
  const isNigerian =
    /lagos|abuja|uyo|portharcourt|port harcourt|ibadan|enugu|kano|calabar|asaba|nigeria/i.test(
      cleanLoc
    );

  const firstNames = isNigerian ? NIGERIAN_FIRST_NAMES : GLOBAL_FIRST_NAMES;
  const lastNames = isNigerian ? NIGERIAN_LAST_NAMES : GLOBAL_LAST_NAMES;

  const leads: Lead[] = [];

  const companyPrefixes = [
    "Apex", "Prime", "Vanguard", "Summit", "Sterling", "Nexus", 
    "Frontier", "Crown", "Optima", "Heritage", "Zenith", "Novus", "Bluecrest"
  ];

  const companySuffixes = [
    "Group", "Capital", "Holdings", "Partners", "Ventures", "Advisors", 
    "Solutions", "Enterprises", "Consulting", "Dynamics"
  ];

  for (let i = 0; i < count; i++) {
    const firstName = firstNames[(i + Math.floor(Math.random() * 5)) % firstNames.length];
    const lastName = lastNames[(i + Math.floor(Math.random() * 5)) % lastNames.length];
    const prefix = companyPrefixes[(i * 3 + Math.floor(Math.random() * 3)) % companyPrefixes.length];
    const suffix = companySuffixes[(i * 2 + Math.floor(Math.random() * 2)) % companySuffixes.length];
    
    // Construct realistic company name incorporating niche
    const shortNiche = cleanNiche.split(" ")[0];
    const company = `${prefix} ${shortNiche} ${suffix}`;
    const cleanCompanyDomain = `${prefix.toLowerCase()}${shortNiche.toLowerCase().replace(/[^a-z]/g, "")}.com`;

    const title = EXECUTIVE_TITLES[i % EXECUTIVE_TITLES.length];
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${cleanCompanyDomain}`;
    
    // Phone numbers
    let phone: string;
    if (isNigerian) {
      const prefixes = ["0803", "0806", "0814", "0708", "0818", "0902", "0805"];
      const p = prefixes[i % prefixes.length];
      const randomSuffix = Math.floor(100000 + Math.random() * 900000);
      phone = `+234 ${p.slice(1)} ${randomSuffix.toString().slice(0, 3)} ${randomSuffix.toString().slice(3)}`;
    } else {
      const randomNum = Math.floor(1000000 + Math.random() * 9000000);
      phone = `+1 (415) ${randomNum.toString().slice(0, 3)}-${randomNum.toString().slice(3)}`;
    }

    const website = `https://www.${cleanCompanyDomain}`;
    
    // Deal values
    const dealValue = isNigerian
      ? Math.floor(4500000 + Math.random() * 18000000) // ₦4.5M - ₦22.5M
      : Math.floor(12000 + Math.random() * 45000); // $12K - $57K
    
    const currency = isNigerian ? "NGN" : "USD";
    const score = Math.floor(75 + Math.random() * 23); // 75 - 98 high qualification score

    const tags = [cleanNiche, cleanLoc, score > 90 ? "High Intent" : "Verified Contact"];

    leads.push({
      id: `lead-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 7)}`,
      name: `${firstName} ${lastName}`,
      title,
      company,
      email,
      phone,
      website,
      niche: cleanNiche,
      location: cleanLoc,
      stage: "new",
      dealValue,
      currency,
      score,
      notes: `Discovered via Iwaju Scraping Engine. Domain verified with 100% MX validation. Target decision-maker identified: ${title}.`,
      tags,
      createdAt: new Date().toISOString(),
    });
  }

  return leads;
}
