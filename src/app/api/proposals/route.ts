import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { listProposals, saveProposal } from "@/lib/db";
import { generateEventProposal } from "@/lib/proposals";
import { createProposalRequestSchema } from "@/lib/schema";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ proposals: await listProposals() });
}

export async function POST(request: Request) {
  try {
    const payload = createProposalRequestSchema.parse(await request.json());
    const generatedProposal = await generateEventProposal(payload.prompt);
    const storedProposal = await saveProposal({
      prompt: payload.prompt,
      proposal: generatedProposal.proposal,
      source: generatedProposal.source,
    });

    return NextResponse.json({ proposal: storedProposal }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? "Please enter a valid event brief." },
        { status: 400 },
      );
    }

    const message =
      error instanceof Error
        ? error.message
        : "We could not create a venue proposal right now.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
