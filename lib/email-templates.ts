import { EmailTemplate } from "@/types";

export const EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    id: "cold-intro",
    name: "Cold Outreach Intro (Value First)",
    category: "Cold Intro",
    description: "Low-friction icebreaker focusing on industry benchmarks and an untapped revenue lever.",
    subject: "Quick question regarding {{companyName}}'s pipeline in {{location}}",
    body: `Hi {{firstName}},

I came across {{companyName}} while reviewing leading {{niche}} firms in {{location}}. Really impressed by your market presence and recent momentum.

Most {{niche}} executives I speak with in {{location}} tell me their #1 bottleneck isn't closing deals—it's having a predictable, automated pipeline of high-intent enterprise prospects booking onto their calendar every week.

At Iwaju Marketing, we built a dedicated outbound acquisition system specifically tailored for {{niche}} leaders. In the last 90 days, we've helped similar teams add ₦12M–₦35M in qualified pipeline without relying on word-of-mouth or expensive ads.

Would you be opposed to a brief 10-minute walk-through this Thursday to see the exact acquisition framework we deployed?

Best regards,
Tunde Balogun
Growth Lead | Iwaju Marketing`,
  },
  {
    id: "value-prop",
    name: "Value Proposition & Case Study Proof",
    category: "Value Proposition",
    description: "Proof-heavy outreach detailing specific ROI metrics and risk-reversal.",
    subject: "How a {{niche}} team in {{location}} unlocked +340% qualified leads",
    body: `Hi {{firstName}},

Reaching out because {{companyName}} seems poised for significant expansion in the {{niche}} space across {{location}}.

Last quarter, we partnered with a peer organization facing high customer acquisition costs. By implementing our multi-touch outbound pipeline engine:
- Discovered 850+ verified high-ticket decision-makers
- Achieved a 38.4% open-to-meeting conversion rate
- Closed 4 enterprise retainers within 45 days

Given your current position in {{location}}, we've already mapped out a custom list of 40+ qualified prospective accounts for {{companyName}}.

Can I send over the 1-page breakdown and data sample for you to review?

Warm regards,
Tunde Balogun
Head of Strategy | Iwaju Marketing`,
  },
  {
    id: "follow-up-1",
    name: "Follow-Up #1 (The Gentle Bump)",
    category: "Follow-up",
    description: "Short, respectful nudge sent 3-4 days after initial outreach.",
    subject: "Re: Quick question regarding {{companyName}}'s pipeline in {{location}}",
    body: `Hi {{firstName}},

I know your schedule at {{companyName}} is packed, so keeping this super brief.

Did you have a chance to review my note regarding automated B2B lead generation for your {{niche}} team in {{location}}?

If your calendar is booked this week, no worries at all. Feel free to grab a quick slot that suits you best here: https://cal.com/iwajumarketing/intro

Thanks,
Tunde Balogun
Iwaju Marketing`,
  },
  {
    id: "meeting-closer",
    name: "Direct Meeting Closer (High Intent)",
    category: "Meeting Closer",
    description: "Direct proposition for leads with high engagement score (Score 85+).",
    subject: "{{firstName}}, 10 mins this week for {{companyName}}?",
    body: `Hi {{firstName}},

Cutting straight to the point: We have a pre-qualified list of 15+ high-net-worth clients actively looking for {{niche}} solutions in {{location}}.

We'd love to pass these opportunities directly into {{companyName}}'s pipeline on a performance-aligned structure.

Are you open for a quick 10-minute sync this Wednesday at 2:00 PM or Thursday at 11:00 AM?

Best,
Tunde Balogun
Iwaju Marketing`,
  },
];

export function interpolateTemplate(
  template: EmailTemplate,
  variables: {
    firstName: string;
    companyName: string;
    niche: string;
    location: string;
  }
): { subject: string; body: string } {
  let subject = template.subject;
  let body = template.body;

  const replaceMap: Record<string, string> = {
    "{{firstName}}": variables.firstName || "there",
    "{{companyName}}": variables.companyName || "your company",
    "{{niche}}": variables.niche || "B2B",
    "{{location}}": variables.location || "your region",
  };

  for (const [key, val] of Object.entries(replaceMap)) {
    subject = subject.replaceAll(key, val);
    body = body.replaceAll(key, val);
  }

  return { subject, body };
}
