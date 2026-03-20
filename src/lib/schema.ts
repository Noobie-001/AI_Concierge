import { z } from "zod";

export const proposalSourceSchema = z.enum(["openai", "demo"]);

export const createProposalRequestSchema = z.object({
  prompt: z
    .string()
    .trim()
    .min(12, "Please provide a little more detail for the event brief.")
    .max(500, "Keep the request under 500 characters so the planner stays focused."),
});

export const eventProposalSchema = z.object({
  venueName: z.string().trim().min(2).max(120),
  location: z.string().trim().min(2).max(120),
  estimatedCost: z.string().trim().min(2).max(80),
  whyItFits: z.string().trim().min(24).max(500),
  highlights: z.array(z.string().trim().min(2).max(80)).min(2).max(4),
});

export type ProposalSource = z.infer<typeof proposalSourceSchema>;
export type CreateProposalRequest = z.infer<typeof createProposalRequestSchema>;
export type EventProposal = z.infer<typeof eventProposalSchema>;

export type StoredProposal = EventProposal & {
  id: number;
  prompt: string;
  source: ProposalSource;
  createdAt: string;
};
