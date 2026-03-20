import type Database from "better-sqlite3";
import { getStore } from "@netlify/blobs";
import { mkdirSync } from "node:fs";
import path from "node:path";
import {
  storedProposalSchema,
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
const netlifyStoreName = "ai-event-concierge";
const netlifyHistoryKey = "proposal-history";

const globalForDatabase = globalThis as typeof globalThis & {
  conciergeDatabase?: Database.Database;
};

function getDatabase() {
  if (!globalForDatabase.conciergeDatabase) {
    throw new Error("Local SQLite database has not been initialized.");
  }

  return globalForDatabase.conciergeDatabase;
}

async function initializeLocalDatabase() {
  if (!globalForDatabase.conciergeDatabase) {
    const { default: BetterSqlite3 } = await import("better-sqlite3");

    mkdirSync(path.dirname(databasePath), { recursive: true });

    const database = new BetterSqlite3(databasePath);
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

  return getDatabase();
}

function isNetlifyBlobsRuntime() {
  return Boolean(
    process.env.NETLIFY === "true" ||
      process.env.NETLIFY_BLOBS_CONTEXT ||
      globalThis.netlifyBlobsContext,
  );
}

function getNetlifyStore() {
  return getStore(netlifyStoreName);
}

function mapProposalRow(row: ProposalRow): StoredProposal {
  return storedProposalSchema.parse({
    id: row.id,
    prompt: row.prompt,
    source: proposalSourceSchema.parse(row.source),
    createdAt: row.created_at,
    venueName: row.venue_name,
    location: row.location,
    estimatedCost: row.estimated_cost,
    whyItFits: row.why_it_fits,
    highlights: JSON.parse(row.highlights_json),
  });
}

async function listSQLiteProposals() {
  const rows = (await initializeLocalDatabase())
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

async function saveSQLiteProposal(input: {
  prompt: string;
  proposal: EventProposal;
  source: ProposalSource;
}) {
  const createdAt = new Date().toISOString();
  const database = await initializeLocalDatabase();
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

async function listNetlifyProposals() {
  const proposals = (await getNetlifyStore().get(netlifyHistoryKey, {
    type: "json",
  })) as unknown;

  if (!Array.isArray(proposals)) {
    return [];
  }

  return proposals
    .map((proposal) => storedProposalSchema.parse(proposal))
    .sort((left, right) => {
      if (left.createdAt === right.createdAt) {
        return right.id - left.id;
      }

      return right.createdAt.localeCompare(left.createdAt);
    });
}

async function saveNetlifyProposal(input: {
  prompt: string;
  proposal: EventProposal;
  source: ProposalSource;
}) {
  const createdProposal = storedProposalSchema.parse({
    id: Date.now() * 1000 + Math.floor(Math.random() * 1000),
    prompt: input.prompt,
    source: input.source,
    createdAt: new Date().toISOString(),
    ...input.proposal,
  });

  const existingProposals = await listNetlifyProposals();
  await getNetlifyStore().setJSON(netlifyHistoryKey, [
    createdProposal,
    ...existingProposals,
  ]);

  return createdProposal;
}

export async function listProposals() {
  if (isNetlifyBlobsRuntime()) {
    try {
      return await listNetlifyProposals();
    } catch (error) {
      console.error("Netlify proposal history could not be loaded.", error);
      return [];
    }
  }

  return listSQLiteProposals();
}

export async function saveProposal(input: {
  prompt: string;
  proposal: EventProposal;
  source: ProposalSource;
}) {
  if (isNetlifyBlobsRuntime()) {
    return saveNetlifyProposal(input);
  }

  return saveSQLiteProposal(input);
}
