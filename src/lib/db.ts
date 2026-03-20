import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";
import {
  eventProposalSchema,
  proposalSourceSchema,
  type EventProposal,
  type ProposalSource,
  type StoredProposal,
} from "@/lib/schema";

type ProposalRow = {
  id: number;
  prompt: string;
  venue_name: string;
  location: string;
  estimated_cost: string;
  why_it_fits: string;
  highlights_json: string;
  source: string;
  created_at: string;
};

const databasePath = path.join(process.cwd(), "data", "concierge.db");

const globalForDatabase = globalThis as typeof globalThis & {
  conciergeDatabase?: Database.Database;
};

function getDatabase() {
  if (!globalForDatabase.conciergeDatabase) {
    mkdirSync(path.dirname(databasePath), { recursive: true });

    const database = new Database(databasePath);
    database.pragma("journal_mode = WAL");
    database.exec(`
      CREATE TABLE IF NOT EXISTS proposals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        prompt TEXT NOT NULL,
        venue_name TEXT NOT NULL,
        location TEXT NOT NULL,
        estimated_cost TEXT NOT NULL,
        why_it_fits TEXT NOT NULL,
        highlights_json TEXT NOT NULL,
        source TEXT NOT NULL,
        created_at TEXT NOT NULL
      )
    `);

    globalForDatabase.conciergeDatabase = database;
  }

  return globalForDatabase.conciergeDatabase;
}

function mapProposalRow(row: ProposalRow): StoredProposal {
  const proposal = eventProposalSchema.parse({
    venueName: row.venue_name,
    location: row.location,
    estimatedCost: row.estimated_cost,
    whyItFits: row.why_it_fits,
    highlights: JSON.parse(row.highlights_json),
  });

  return {
    id: row.id,
    prompt: row.prompt,
    source: proposalSourceSchema.parse(row.source),
    createdAt: row.created_at,
    ...proposal,
  };
}

export function listProposals() {
  const rows = getDatabase()
    .prepare(
      `
        SELECT
          id,
          prompt,
          venue_name,
          location,
          estimated_cost,
          why_it_fits,
          highlights_json,
          source,
          created_at
        FROM proposals
        ORDER BY created_at DESC, id DESC
      `,
    )
    .all() as ProposalRow[];

  return rows.map(mapProposalRow);
}

export function saveProposal(input: {
  prompt: string;
  proposal: EventProposal;
  source: ProposalSource;
}) {
  const createdAt = new Date().toISOString();
  const database = getDatabase();
  const insertResult = database
    .prepare(
      `
        INSERT INTO proposals (
          prompt,
          venue_name,
          location,
          estimated_cost,
          why_it_fits,
          highlights_json,
          source,
          created_at
        ) VALUES (
          @prompt,
          @venueName,
          @location,
          @estimatedCost,
          @whyItFits,
          @highlightsJson,
          @source,
          @createdAt
        )
      `,
    )
    .run({
      prompt: input.prompt,
      venueName: input.proposal.venueName,
      location: input.proposal.location,
      estimatedCost: input.proposal.estimatedCost,
      whyItFits: input.proposal.whyItFits,
      highlightsJson: JSON.stringify(input.proposal.highlights),
      source: input.source,
      createdAt,
    });

  const createdProposal = database
    .prepare(
      `
        SELECT
          id,
          prompt,
          venue_name,
          location,
          estimated_cost,
          why_it_fits,
          highlights_json,
          source,
          created_at
        FROM proposals
        WHERE id = ?
      `,
    )
    .get(insertResult.lastInsertRowid) as ProposalRow;

  return mapProposalRow(createdProposal);
}
