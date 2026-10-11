import { NextResponse } from "next/server";
import { resolveContact, type ContactResolution, type EvidenceItem } from "@/lib/verification";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_CONTACTS = 40;

export async function GET() {
  return NextResponse.json({
    status: "ok",
    agent: "Contact Resolution & Identity",
    method: "live DNS MX lookup, domain comparison, address-syntax and placeholder detection",
    writesRecords: false,
    runtime: "nodejs",
  });
}

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const input = Array.isArray(body?.contacts) ? body.contacts : Array.isArray(body?.leads) ? body.leads : null;

  if (!input || input.length === 0) {
    return NextResponse.json(
      { error: "Provide contacts (or leads) to resolve. This agent does not find people; it judges records you already hold." },
      { status: 400 }
    );
  }

  const slice = input.slice(0, MAX_CONTACTS);
  const results = await Promise.all(
    slice.map(async (lead: any, index: number) => {
      const resolution: ContactResolution = await resolveContact({
        name: lead?.name,
        title: lead?.title,
        email: lead?.email,
        phone: lead?.phone,
        company: lead?.company,
        website: lead?.website,
      });
      return {
        leadId: String(lead?.id ?? `index-${index}`),
        company: String(lead?.company ?? ""),
        ...resolution,
      };
    })
  );

  const summary = {
    submitted: input.length,
    processed: results.length,
    resolved: results.filter((r) => r.verdict === "resolved").length,
    needsEvidence: results.filter((r) => r.verdict === "needs_evidence").length,
    contradicted: results.filter((r) => r.verdict === "contradicted").length,
    noHumanContact: results.filter((r) => !r.personIsHuman).length,
    personalChannel: results.filter((r) => r.channelClass === "personal").length,
    mxCheckedDomains: results.filter((r) => r.evidence.some((e: EvidenceItem) => e.method === "mx_lookup" && e.confidence > 0)).length,
  };

  return NextResponse.json({
    success: true,
    agent: "Contact Resolution & Identity",
    note: "Verification evidence only. No record was modified; nothing was auto-applied.",
    summary,
    results,
  });
}
