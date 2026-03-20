import { zodTextFormat } from "openai/helpers/zod";
import { getOpenAIClient } from "@/lib/openai";
import {
  eventProposalSchema,
  type EventProposal,
  type ProposalSource,
} from "@/lib/schema";

const SYSTEM_PROMPT = `
You are AI Event Concierge, a corporate offsite planner.

Turn each event brief into exactly one structured venue proposal.
Follow these rules:
- Return only the JSON schema supplied by the caller.
- Recommend one strong-fit venue or venue-style property for the brief.
- Keep estimatedCost in concise USD language, for example "$3,600 - $4,000 total".
- Write whyItFits as 2 to 4 practical sentences grounded in the user's group size, duration, budget, and atmosphere.
- Keep highlights short and specific.
- If the budget is tight, stay realistic while still proposing the best-fit option.
- Do not add markdown, disclaimers, or extra keys.
`.trim();

type GeneratedProposal = {
  proposal: EventProposal;
  source: ProposalSource;
};

type VenuePreset = {
  keywords: string[];
  venueName: string;
  location: string;
  theme: string;
  lodgingRate: number;
  mealRate: number;
  meetingPackage: number;
  highlights: string[];
};

const venuePresets: VenuePreset[] = [
  {
    keywords: ["mountain", "mountains", "hills", "nature", "retreat", "outdoor"],
    venueName: "Blue Pine Lodge",
    location: "Asheville, North Carolina",
    theme: "mountain retreat",
    lodgingRate: 150,
    mealRate: 58,
    meetingPackage: 750,
    highlights: [
      "Scenic strategy sessions",
      "Overnight lodge rooms",
      "Private breakout areas",
    ],
  },
  {
    keywords: ["beach", "coast", "ocean", "seaside", "waterfront"],
    venueName: "Shoreline Summit House",
    location: "San Diego, California",
    theme: "beachside offsite",
    lodgingRate: 195,
    mealRate: 68,
    meetingPackage: 1200,
    highlights: [
      "Walkable waterfront setting",
      "Workshop-ready main room",
      "Team dinner options nearby",
    ],
  },
  {
    keywords: ["wellness", "mindful", "quiet", "reset", "spa"],
    venueName: "Cedar Mesa Retreat Center",
    location: "Sedona, Arizona",
    theme: "wellness-focused retreat",
    lodgingRate: 175,
    mealRate: 60,
    meetingPackage: 900,
    highlights: [
      "Calm desert setting",
      "Focused leadership time",
      "Balanced work and recharge rhythm",
    ],
  },
  {
    keywords: ["sales kickoff", "kickoff", "conference", "urban", "city", "launch"],
    venueName: "Atelier Conference Loft",
    location: "Austin, Texas",
    theme: "high-energy city offsite",
    lodgingRate: 165,
    mealRate: 62,
    meetingPackage: 1400,
    highlights: [
      "Large presentation room",
      "Central hotel access",
      "Evening team social options",
    ],
  },
];

const defaultPreset: VenuePreset = {
  keywords: [],
  venueName: "Hudson House Offsite Club",
  location: "Hudson Valley, New York",
  theme: "classic executive retreat",
  lodgingRate: 170,
  mealRate: 60,
  meetingPackage: 950,
  highlights: [
    "Private meeting spaces",
    "Comfortable overnight stay",
    "Easy team agenda flow",
  ],
};

export async function generateEventProposal(prompt: string): Promise<GeneratedProposal> {
  const client = getOpenAIClient();

  if (!client) {
    if (process.env.ALLOW_DEMO_MODE === "true") {
      return {
        proposal: buildDemoProposal(prompt),
        source: "demo",
      };
    }

    throw new Error(
      "Missing OPENAI_API_KEY. Add it to .env.local for live AI proposals, or set ALLOW_DEMO_MODE=true for a local demo fallback.",
    );
  }

  const response = await client.responses.parse({
    model: process.env.OPENAI_MODEL ?? "gpt-5-mini",
    reasoning: { effort: "low" },
    instructions: SYSTEM_PROMPT,
    input: `Corporate offsite brief: ${prompt}`,
    max_output_tokens: 500,
    text: {
      format: zodTextFormat(eventProposalSchema, "event_proposal"),
    },
  });

  if (!response.output_parsed) {
    throw new Error("OpenAI returned an empty structured response.");
  }

  return {
    proposal: eventProposalSchema.parse(response.output_parsed),
    source: "openai",
  };
}

function buildDemoProposal(prompt: string): EventProposal {
  const normalizedPrompt = prompt.toLowerCase();
  const preset =
    venuePresets.find((item) =>
      item.keywords.some((keyword) => normalizedPrompt.includes(keyword)),
    ) ?? defaultPreset;

  const attendeeCount = extractCount(
    prompt,
    /(\d+)\s*[- ]?\s*(?:person|people|guests|guest|attendees|attendee|team members|team member)/i,
  );
  const durationDays = extractCount(prompt, /(\d+)\s*[- ]?\s*(?:day|days)/i);
  const budget = extractBudget(prompt);

  const attendees = attendeeCount ?? 12;
  const days = durationDays ?? 2;
  const nights = Math.max(days - 1, 1);

  let totalEstimate =
    attendees * nights * preset.lodgingRate +
    attendees * days * preset.mealRate +
    preset.meetingPackage;

  if (budget) {
    if (totalEstimate > budget * 1.05) {
      totalEstimate = roundToFifty(budget * 1.02);
    } else if (totalEstimate < budget * 0.7) {
      totalEstimate = roundToFifty(budget * 0.84);
    }
  }

  const estimatedCost = formatUsdRange(totalEstimate);
  const budgetLine = budget
    ? `The projected spend stays close to the stated budget of ${formatUsd(budget)} while still covering lodging, meeting space, and shared meals.`
    : "The estimate reflects a realistic mid-market corporate offsite budget with lodging, meeting space, and shared meals built in.";

  return {
    venueName: preset.venueName,
    location: preset.location,
    estimatedCost,
    whyItFits: `${preset.venueName} gives your ${attendees}-person team a focused ${preset.theme} setting for ${days} day${days === 1 ? "" : "s"}. ${budgetLine} It works especially well when the goal is to balance structured sessions with comfortable downtime in one easy-to-manage location.`,
    highlights: preset.highlights,
  };
}

function extractCount(input: string, pattern: RegExp) {
  const match = input.match(pattern);
  return match ? Number.parseInt(match[1] ?? "", 10) : null;
}

function extractBudget(input: string) {
  const directDollarMatch = input.match(/\$\s*(\d+(?:[.,]\d+)?)\s*(k)?/i);
  if (directDollarMatch) {
    return normalizeBudgetValue(directDollarMatch[1] ?? "", directDollarMatch[2]);
  }

  const budgetLabelMatch = input.match(
    /budget(?: of| around| is| under| near)?\s*(\d+(?:[.,]\d+)?)\s*(k)?/i,
  );

  if (budgetLabelMatch) {
    return normalizeBudgetValue(budgetLabelMatch[1] ?? "", budgetLabelMatch[2]);
  }

  return null;
}

function normalizeBudgetValue(value: string, hasKiloSuffix?: string) {
  const numericValue = Number.parseFloat(value.replace(/,/g, ""));
  if (Number.isNaN(numericValue)) {
    return null;
  }

  return hasKiloSuffix ? numericValue * 1000 : numericValue;
}

function roundToFifty(value: number) {
  return Math.max(250, Math.round(value / 50) * 50);
}

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(roundToFifty(value));
}

function formatUsdRange(value: number) {
  const lowerBound = roundToFifty(value * 0.94);
  const upperBound = roundToFifty(value * 1.06);
  return `${formatUsd(lowerBound)} - ${formatUsd(upperBound)} total`;
}
